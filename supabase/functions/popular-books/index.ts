// popular-books — returns a flat list of popular books for the client to use as
// an instant in-memory autocomplete index ("Tier 1" in Index.tsx — covers ~80%
// of searches with zero network round-trip). The client filters this locally
// on every keystroke; only when local hits are thin does it fall back to
// search-books.
//
// Sources combined:
// 1. novel_analyses — actually-analyzed books (highest signal)
// 2. search_cache — books that have appeared in popular search results
// 3. canon_books — the daily-curated Must-Read/Classics list (added
//    2026-08-30 daily_novel_viz_feat pass; see note below)
// 4. seed_book_list — the seed-cache warmup list (added same pass)
//
// Deduped by (title|author). Cached aggressively at the edge.
//
// 2026-08-30 (daily_novel_viz_feat): found live that this endpoint — the ONLY
// zero-network path in the whole search-to-visualization pipeline, per
// Index.tsx's own "Tier 1" comment — only ever drew from novel_analyses (442
// rows at time of writing, pre-launch) and search_cache (7 rows, 24h TTL,
// usually near-empty). Meanwhile canon_books (835 rows) and seed_book_list
// (2118 rows) — the entire output of the separate daily-must-read-and-classic
// and seed-cache curation efforts, specifically built so "as many books as
// possible, starting with the Classics" are available — were invisible to
// this fast path. A curated classic with no real user traffic yet fell all
// the way through to the slower Tier-2 network search (search-books, subject
// to OL/GB latency and rate limits) instead of being instant like it should
// be. Wiring both tables in directly closes the gap between two months of
// curation work and the feature that's supposed to surface it fastest.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { raceRateLimitCount } from "../_shared/rate-limit.ts";

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
// from four DB sources (novel_analyses limit 6000, search_cache limit 3000,
// canon_books + seed_book_list both paginated via fetchAllRows). The 5-minute in-process memo
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

// seed_book_list stores each entry as a single free-text "Title by Author"
// string (not separate columns — see round 2026-08-25's DB-backed-list
// migration). Split on the LAST " by " so a title that itself legitimately
// contains the word "by" (rare, but real English titles exist) still splits
// correctly on the actual author boundary rather than an earlier false hit.
function splitSeedEntry(entry: string): { title: string; author: string } {
  const lower = entry.toLowerCase();
  const idx = lower.lastIndexOf(" by ");
  if (idx === -1) return { title: entry.trim(), author: "" };
  return { title: entry.slice(0, idx).trim(), author: entry.slice(idx + 4).trim() };
}

// 2026-08-30, same-day follow-up: found live IMMEDIATELY after first
// deploying the canon_books/seed_book_list wiring below — a plain
// `.limit(5000)` on seed_book_list (2118 rows at time of writing, > 1000)
// silently came back truncated to only the first ~1000 rows by insertion
// order, even though the request explicitly asked for up to 5000. This is
// PostgREST's `db-max-rows` server-side ceiling: it hard-caps every query's
// *returned* row count regardless of what `Range`/`.limit()` the client
// requests, and — critically — it does NOT error or flag anything when it
// truncates; the response just silently has fewer rows than asked for.
// Confirmed live: "My Life in France" (seed_book_list id 1160) and "The
// Places in Between" (id 1774) were both missing from the live popular-books
// response right after the naive-limit version deployed, despite both rows
// definitely existing in the table (verified via direct SQL). canon_books
// (835 rows, under 1000) wasn't affected THIS time, but will hit the exact
// same silent-truncation wall once the daily canon curation task pushes it
// past 1000 rows (~current growth rate: ~1 month away) if left as a plain
// .limit() call — so both tables are paginated the same way here, not just
// the one that broke first.
async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  maxRows = 10000,
): Promise<T[]> {
  const PAGE_SIZE = 1000; // stay at/under the likely db-max-rows ceiling per page
  const out: T[] = [];
  for (let from = 0; from < maxRows; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) break; // best-effort: return whatever pages succeeded before a failure
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break; // last page — fewer rows than requested means we're done
  }
  return out;
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
      const count = await raceRateLimitCount(supabase.rpc("count_recent_events", {
        p_ip_hash: ipHash,
        p_route: ROUTE,
        p_window_seconds: 3600,
        p_prefetch_only: false,
      }));
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

    // Pull analyzed books (strong signal) + cached search results + the two
    // curated coverage tables in parallel. canon_books/seed_book_list are
    // both service-role-only (deny-all RLS) — this function already uses the
    // service-role client for the other two tables, so no policy change
    // needed. The curated tables are paginated via fetchAllRows (see its
    // comment above) rather than a plain .limit(), since both are large
    // enough to hit PostgREST's silent per-query row ceiling.
    const [analysesRes, cacheRes, canonRows, seedRows] = await Promise.all([
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
      fetchAllRows<{ title: string; author: string }>((from, to) =>
        supabase.from("canon_books").select("title, author").range(from, to)
      ),
      fetchAllRows<{ entry: string }>((from, to) =>
        supabase.from("seed_book_list").select("entry").range(from, to)
      ),
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

    // Curated Must-Read/Classics list (2026-08-30): flat popularity, deliberately
    // below any real analyzed/cached signal — curated existence isn't the same
    // as confirmed real-world popularity — but well above zero so these titles
    // now actually surface in the instant Tier-1 index instead of being
    // invisible until the slower network fallback. Only raises an existing
    // entry's popularity floor (keeps whichever title/author string a
    // higher-priority source already contributed) — never overwrites a
    // stronger analyzed/cached hit.
    for (const row of canonRows) {
      const title = (row as any).title?.trim();
      const author = (row as any).author?.trim() ?? "";
      if (!title) continue;
      const key = `${normalize(title)}|${normalize(author)}`;
      const pop = 500;
      const existing = dedupe.get(key);
      if (!existing) dedupe.set(key, { title, author, popularity: pop, normTitle: normalize(title), normAuthor: normalize(author) });
      else if (existing.popularity < pop) existing.popularity = pop;
    }

    // Seed-cache warmup list (2026-08-30): same treatment, slightly below
    // canon_books' floor since this list is a broader popular-books warmup
    // set rather than a hand-curated canon, and a few entries are the raw
    // "Title by Author" free-text form (parsed via splitSeedEntry above),
    // which is a little noisier than canon_books' clean columns.
    for (const row of seedRows) {
      const entry = (row as any).entry?.trim();
      if (!entry) continue;
      const { title, author } = splitSeedEntry(entry);
      if (!title) continue;
      const key = `${normalize(title)}|${normalize(author)}`;
      const pop = 480;
      const existing = dedupe.get(key);
      if (!existing) dedupe.set(key, { title, author, popularity: pop, normTitle: normalize(title), normAuthor: normalize(author) });
      else if (existing.popularity < pop) existing.popularity = pop;
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
      canon_rows: canonRows.length,
      seed_rows: seedRows.length,
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
