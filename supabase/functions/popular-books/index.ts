// popular-books — returns a flat list of popular books for the client to use as
// an instant in-memory autocomplete index. The client filters this locally on
// every keystroke; only when local hits are thin does it fall back to search-books.
//
// Sources combined:
// 1. novel_analyses — actually-analyzed books (highest signal)
// 2. search_cache — books that have appeared in popular search results
//
// Deduped by (title|author), capped at 800. Cached aggressively at the edge.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

interface PopularBook {
  title: string;
  author: string;
  popularity: number; // 0..1000
  normTitle: string;
  normAuthor: string;
}

// Module-scope memo so warm invocations skip the DB entirely.
let cachedPayload: { results: PopularBook[]; etag: string } | null = null;
let cachedAt = 0;
const MEMO_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ---------- Rate limiting (memo-miss path only) ----------
// popular-books is public/unauthenticated and returns up to 10k rows built
// from two DB scans (limit 6000 + limit 3000). The 5-minute in-process memo
// absorbs almost all real traffic for free, but every other public function
// in this project (search-books, all Gemini functions) rate-limits its real
// cost path — this one didn't, leaving the only DB-scanning public endpoint
// without an abuse/DoS backstop (e.g. a scripted client sending
// no-cache/Cache-Control headers to force a fresh scan on every request).
// Same rate_limit_events table + count_recent_events RPC + salted IP hash
// pattern as search-books, for consistency and easy purging.
const ROUTE = "popular-books";
const RATE_LIMIT = 20; // fresh (memo-miss) DB scans per hour per IP

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

async function hashIp(ip: string): Promise<string> {
  const salt =
    Deno.env.get("RATE_LIMIT_SALT") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    "fallback-salt";
  return sha256Hex(salt + ip);
}

function normalize(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const t0 = performance.now();
  try {
    const now = Date.now();
    if (cachedPayload && now - cachedAt < MEMO_TTL_MS) {
      return new Response(JSON.stringify({ results: cachedPayload.results, source: "memo" }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300, s-maxage=300",
          ETag: cachedPayload.etag,
        },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // -------- Memo miss: rate-limit before running the two DB scans --------
    const ip = getClientIp(req);
    const ipHash = await hashIp(ip);
    try {
      const { data: count } = await supabase.rpc("count_recent_events", {
        p_ip_hash: ipHash,
        p_route: ROUTE,
        p_window_seconds: 3600,
        p_prefetch_only: false,
      });
      if (typeof count === "number" && count >= RATE_LIMIT) {
        console.log(JSON.stringify({ fn: "popular-books", cache: "rate_limited" }));
        // Prefer serving a stale memo over a hard failure — this is a public
        // autocomplete index, not a security-sensitive endpoint, so staying
        // seamless for the client matters more than strict freshness here.
        if (cachedPayload) {
          return new Response(JSON.stringify({ results: cachedPayload.results, source: "stale-rate-limited" }), {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=60",
              ETag: cachedPayload.etag,
            },
          });
        }
        return new Response(JSON.stringify({ results: [], error: "rate_limited" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "3600" },
        });
      }
    } catch { /* fail open — don't block legitimate traffic if the rate DB is unavailable */ }

    supabase
      .from("rate_limit_events")
      .insert({ ip_hash: ipHash, route: ROUTE, is_prefetch: false })
      .then(() => {}).catch(() => {});

    // Pull analyzed books (strong signal) + cached search results in parallel.
    const [analysesRes, cacheRes] = await Promise.all([
      supabase
        .from("novel_analyses")
        .select("title, author, hit_count")
        .order("hit_count", { ascending: false })
        .limit(6000),
      supabase
        .from("search_cache")
        .select("results, hit_count")
        .order("hit_count", { ascending: false })
        .limit(3000),
    ]);

    const dedupe = new Map<string, PopularBook>();

    // Analyzed books carry the highest weight.
    for (const row of analysesRes.data ?? []) {
      const title = (row as any).title?.trim();
      const author = (row as any).author?.trim() ?? "";
      if (!title) continue;
      const key = `${normalize(title)}|${normalize(author)}`;
      const pop = 600 + Math.min(400, ((row as any).hit_count ?? 0) * 20);
      const existing = dedupe.get(key);
      if (!existing || existing.popularity < pop) {
        dedupe.set(key, { title, author, popularity: pop, normTitle: normalize(title), normAuthor: normalize(author) });
      }
    }

    // Cached search results — use their inherent popularity score.
    for (const row of cacheRes.data ?? []) {
      const items = ((row as any).results ?? []) as Array<{
        title?: string;
        author?: string;
        score?: number;
      }>;
      for (const it of items) {
        const title = it.title?.trim();
        const author = it.author?.trim() ?? "";
        if (!title) continue;
        const key = `${normalize(title)}|${normalize(author)}`;
        const pop = Math.min(550, Math.round((it.score ?? 0) / 2));
        const existing = dedupe.get(key);
        if (!existing) dedupe.set(key, { title, author, popularity: pop, normTitle: normalize(title), normAuthor: normalize(author) });
        else if (existing.popularity < pop) existing.popularity = pop;
      }
    }

    const results = Array.from(dedupe.values())
      .filter((b) => b.title.length > 1)
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 10000);

    const etag = `W/"pop-${results.length}-${now}"`;
    cachedPayload = { results, etag };
    cachedAt = now;

    console.log(JSON.stringify({
      fn: "popular-books",
      total: results.length,
      analyses: analysesRes.data?.length ?? 0,
      cache_rows: cacheRes.data?.length ?? 0,
      ms: Math.round(performance.now() - t0),
    }));

    return new Response(JSON.stringify({ results, source: "fresh" }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        // 5min fresh, then serve stale for an hour while revalidating in the
        // background — repeat visits paint the autocomplete index instantly.
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=3600",
        ETag: etag,
      },
    });
  } catch (err) {
    console.error("popular-books error:", err);
    return new Response(JSON.stringify({ results: [], error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
