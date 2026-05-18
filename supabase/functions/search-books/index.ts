// search-books — popularity-ranked, Latinized book search
//
// Backend EM notes (this revision):
// - Server-side search_cache table: same query from any user → ~30ms instead of ~400ms.
// - Cache key for ✓ Cached badge now matches analyze-novel's buildCacheKey exactly.
// - Typo tolerance: zero-result fallback retries Open Library with fuzzy operator.
// - Author-prefix mode: single-word queries also fan out to author= search in parallel.
// - Structured timing logs so we can spot regressions (ol_fetch / cache / total).
// - Cache-Control switched to `private` (browser sends Authorization → public was a no-op).

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ---------- Latinization ----------

const CYRILLIC_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  і: "i", ї: "yi", є: "ye", ґ: "g",
};

const GREEK_MAP: Record<string, string> = {
  α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th",
  ι: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p",
  ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o",
};

function transliterate(s: string): string {
  let out = "";
  for (const ch of s) {
    const lower = ch.toLowerCase();
    const isUpper = ch !== lower;
    const mapped = CYRILLIC_MAP[lower] ?? GREEK_MAP[lower] ?? null;
    if (mapped !== null) {
      out += isUpper && mapped.length > 0
        ? mapped[0].toUpperCase() + mapped.slice(1)
        : mapped;
    } else {
      out += ch;
    }
  }
  return out;
}

function isLatin(s: string): boolean {
  if (!s) return false;
  const non = s.replace(/[\u0000-\u024F\s.,'"()\-–—&]/g, "");
  return non.length === 0;
}

function pickLatinAuthor(primary: string | undefined, alts: string[] | undefined): string {
  if (primary && isLatin(primary)) return primary;
  if (alts && alts.length > 0) {
    const latinAlt = alts.find((a) => a && isLatin(a));
    if (latinAlt) return latinAlt;
  }
  if (primary) return transliterate(primary);
  return "Unknown";
}

// ---------- Cache key (must mirror analyze-novel's buildCacheKey EXACTLY) ----------
// analyze-novel builds: `${CACHE_VERSION}|${title}||${author}` with both sides lowercased,
// trimmed, and whitespace-collapsed. CACHE_VERSION is "v2".
const CACHE_VERSION = "v2";
function buildAnalysisCacheKey(title: string, author: string): string {
  const t = title.trim().toLowerCase().replace(/\s+/g, " ");
  const a = (author ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return `${CACHE_VERSION}|${t}||${a}`;
}

// Server-side search cache key — normalized query string only.
function buildSearchCacheKey(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

const MEMORY_CACHE_TTL_MS = 10 * 60 * 1000;
const MEMORY_CACHE_MAX = 256;

type MemoryCacheEntry = {
  results: Ranked[];
  cachedAt: number;
};

const memorySearchCache = new Map<string, MemoryCacheEntry>();

function getMemoryCache(queryKey: string): Ranked[] | null {
  const hit = memorySearchCache.get(queryKey);
  if (!hit) return null;
  if (Date.now() - hit.cachedAt > MEMORY_CACHE_TTL_MS) {
    memorySearchCache.delete(queryKey);
    return null;
  }
  memorySearchCache.delete(queryKey);
  memorySearchCache.set(queryKey, hit);
  return hit.results;
}

function setMemoryCache(queryKey: string, results: Ranked[]) {
  memorySearchCache.set(queryKey, { results, cachedAt: Date.now() });
  if (memorySearchCache.size <= MEMORY_CACHE_MAX) return;
  const oldestKey = memorySearchCache.keys().next().value;
  if (oldestKey) memorySearchCache.delete(oldestKey);
}

function findPrefixMemoryCache(queryKey: string): Ranked[] | null {
  for (let len = queryKey.length - 1; len >= 2; len--) {
    const stem = queryKey.slice(0, len);
    const stemResults = getMemoryCache(stem);
    if (!stemResults?.length) continue;
    const filtered = stemResults.filter((r) => {
      const title = buildSearchCacheKey(r.title);
      const author = buildSearchCacheKey(r.author);
      return title.startsWith(queryKey) ||
        author.startsWith(queryKey) ||
        title.includes(` ${queryKey}`) ||
        author.includes(` ${queryKey}`) ||
        title.includes(queryKey) ||
        author.includes(queryKey);
    });
    if (filtered.length > 0) return filtered;
  }
  return null;
}

// ---------- Ranking ----------

interface OLDoc {
  key: string;
  title?: string;
  author_name?: string[];
  author_alternative_name?: string[];
  first_publish_year?: number;
  edition_count?: number;
  ratings_count?: number;
  ia_count?: number;
  has_fulltext?: boolean;
  language?: string[];
}

interface Ranked {
  key: string;
  title: string;
  author: string;
  year?: number;
  score: number;
  cached: boolean;
  shelfBoost: boolean;
}

function lexicalScore(query: string, title: string, author: string): number {
  const q = buildSearchCacheKey(query);
  const t = buildSearchCacheKey(title);
  const a = buildSearchCacheKey(author);

  let score = 0;

  if (t === q) score += 500;
  if (a === q) score += 220;

  if (t.startsWith(q)) score += 260;
  else if (t.includes(` ${q}`)) score += 180;
  else if (t.includes(q)) score += 90;

  if (a.startsWith(q)) score += 120;
  else if (a.includes(` ${q}`)) score += 80;
  else if (a.includes(q)) score += 35;

  const qTokens = q.split(" ").filter(Boolean);
  if (qTokens.length > 1) {
    const titleWords = t.split(" ");
    const authorWords = a.split(" ");
    const titleMatches = qTokens.filter((token) => titleWords.some((w) => w.startsWith(token))).length;
    const authorMatches = qTokens.filter((token) => authorWords.some((w) => w.startsWith(token))).length;
    score += titleMatches * 55 + authorMatches * 20;
  }

  score -= Math.max(0, t.length - q.length) * 0.12;
  return score;
}

function popularityScore(d: OLDoc): number {
  const editions = Math.log2(1 + (d.edition_count ?? 0)) * 4;
  const ratings = Math.log2(1 + (d.ratings_count ?? 0)) * 6;
  const archive = Math.log2(1 + (d.ia_count ?? 0)) * 2;
  const englishBonus = d.language?.includes("eng") ? 8 : 0;
  const noSignal =
    (d.edition_count ?? 0) === 0 &&
    (d.ratings_count ?? 0) === 0 &&
    (d.ia_count ?? 0) === 0;
  const penalty = noSignal ? -30 : 0;
  return editions + ratings + archive + englishBonus + penalty;
}

const OL_FIELDS =
  "key,title,author_name,author_alternative_name,first_publish_year,edition_count,ratings_count,ia_count,language";

async function olFetch(url: string): Promise<OLDoc[]> {
  const res = await fetch(url, { headers: { "User-Agent": "novelviz-search/1.1" } });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  const json = await res.json();
  return (json?.docs ?? []) as OLDoc[];
}

// ---------- Handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const t0 = performance.now();
  const timings: Record<string, number> = {};

  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const limit = Math.min(10, Math.max(1, Number(url.searchParams.get("limit") ?? 6)));

    if (q.length < 2) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const queryKey = buildSearchCacheKey(q);

    const memoryResults = getMemoryCache(queryKey);
    if (memoryResults) {
      timings.total = Math.round(performance.now() - t0);
      console.log(JSON.stringify({ fn: "search-books", cache: "memory", q: queryKey, timings }));
      return new Response(JSON.stringify({ results: memoryResults.slice(0, limit) }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "private, max-age=300",
          "X-Cache": "MEMORY",
        },
      });
    }

    const memoryPrefixResults = findPrefixMemoryCache(queryKey);
    if (memoryPrefixResults) {
      setMemoryCache(queryKey, memoryPrefixResults);
      timings.total = Math.round(performance.now() - t0);
      console.log(JSON.stringify({ fn: "search-books", cache: "memory-prefix", q: queryKey, timings }));
      return new Response(JSON.stringify({ results: memoryPrefixResults.slice(0, limit) }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "private, max-age=300",
          "X-Cache": "MEMORY-PREFIX",
        },
      });
    }

    // -------- Server cache lookup (cross-user, 24h TTL enforced by purge job) --------
    // NOTE: no .gte() filter here — it forces a worse index path. TTL handled by purge.
    const cacheT0 = performance.now();
    const { data: cacheRow } = await adminClient
      .from("search_cache")
      .select("results, last_accessed_at")
      .eq("query_key", queryKey)
      .maybeSingle();
    timings.cache_read = Math.round(performance.now() - cacheT0);

    // Treat as fresh only if updated in the last 24h. Otherwise fall through to refetch.
    const isFresh = cacheRow?.last_accessed_at &&
      Date.now() - new Date(cacheRow.last_accessed_at as string).getTime() < 24 * 60 * 60 * 1000;

    if (cacheRow?.results && isFresh) {
      const results = cacheRow.results as Ranked[];
      setMemoryCache(queryKey, results);

      if (Math.random() < 0.1) {
        const bump = adminClient
          .from("search_cache")
          .update({ last_accessed_at: new Date().toISOString() })
          .eq("query_key", queryKey);
        // @ts-ignore — Deno EdgeRuntime
        if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
          // @ts-ignore
          EdgeRuntime.waitUntil(bump.then(() => {}).catch((e) => console.error("cache bump:", e)));
        } else {
          bump.then(() => {}).catch((e) => console.error("cache bump:", e));
        }
      }

      timings.total = Math.round(performance.now() - t0);
      console.log(JSON.stringify({ fn: "search-books", cache: "hit", q: queryKey, timings }));

      return new Response(JSON.stringify({ results: results.slice(0, limit) }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "private, max-age=300",
          "X-Cache": "HIT",
        },
      });
    }

    // -------- Cache miss: fetch from Open Library (with typo + author-prefix fallbacks) --------
    const olT0 = performance.now();
    const baseUrl =
      `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=30&fields=${OL_FIELDS}`;

    // Single-word query → also fan out to author= search in parallel (P1 author-prefix mode).
    const isSingleWord = !q.includes(" ") && q.length >= 3;
    const authorUrl = isSingleWord
      ? `https://openlibrary.org/search.json?author=${encodeURIComponent(q)}&limit=20&fields=${OL_FIELDS}`
      : null;

    let docs: OLDoc[];
    try {
      const fetches: Promise<OLDoc[]>[] = [olFetch(baseUrl)];
      if (authorUrl) fetches.push(olFetch(authorUrl).catch(() => [] as OLDoc[]));
      const arrays = await Promise.all(fetches);
      docs = arrays.flat();

      // Typo fallback: if base returned nothing usable, retry with fuzzy operator
      if (docs.filter((d) => d.title && isLatin(d.title)).length === 0) {
        const fuzzyUrl =
          `https://openlibrary.org/search.json?q=${encodeURIComponent(q + "~")}&limit=20&fields=${OL_FIELDS}`;
        try {
          const fuzzy = await olFetch(fuzzyUrl);
          docs = docs.concat(fuzzy);
          timings.fuzzy_used = 1;
        } catch (_e) { /* ignore */ }
      }
    } catch (e) {
      console.error(JSON.stringify({ fn: "search-books", error: "ol_fetch_failed", message: String(e) }));
      return new Response(JSON.stringify({ results: [], error: "upstream_failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    timings.ol_fetch = Math.round(performance.now() - olT0);

    // First pass — Latinize, dedupe, score
    const seen = new Set<string>();
    const candidates: Ranked[] = [];
    for (const d of docs) {
      if (!d.title) continue;
      if (!isLatin(d.title)) continue;
      const author = pickLatinAuthor(d.author_name?.[0], d.author_alternative_name);
      const dedupKey = `${d.title.toLowerCase()}::${author.toLowerCase()}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      candidates.push({
        key: d.key,
        title: d.title,
        author,
        year: d.first_publish_year,
        score: lexicalScore(q, d.title, author) + popularityScore(d),
        cached: false,
        shelfBoost: false,
      });
    }

    // Analysis-cache lookup only. Avoid per-user shelf work on every keystroke.
    const analysisT0 = performance.now();
    const analysisKeys = candidates.map((c) => buildAnalysisCacheKey(c.title, c.author));
    const { data: cachedAnalysisRows } = analysisKeys.length > 0
      ? await adminClient.from("novel_analyses").select("cache_key").in("cache_key", analysisKeys)
      : { data: [] as Array<{ cache_key: string }> };
    timings.analysis_lookup = Math.round(performance.now() - analysisT0);

    const cachedSet = new Set<string>();
    for (const r of (cachedAnalysisRows ?? [])) cachedSet.add(r.cache_key as string);

    // Keep cache boost modest so popularity + lexical relevance still dominate.
    for (const c of candidates) {
      const ck = buildAnalysisCacheKey(c.title, c.author);
      if (cachedSet.has(ck)) {
        c.cached = true;
        c.score += 18;
      }
    }

    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.year ?? 0) - (a.year ?? 0);
    });

    const baseResults = candidates.slice(0, Math.max(limit, 8)).map((c) => ({
      ...c,
      shelfBoost: false,
    }));

    setMemoryCache(queryKey, baseResults);

    // Persist to server cache (background).
    const writeCache = adminClient
      .from("search_cache")
      .upsert(
        { query_key: queryKey, results: baseResults, hit_count: 0, last_accessed_at: new Date().toISOString() },
        { onConflict: "query_key" },
      );
    // @ts-ignore — Deno EdgeRuntime
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(writeCache.then(() => {}).catch((e) => console.error("cache write:", e)));
    } else {
      writeCache.then(() => {}).catch((e) => console.error("cache write:", e));
    }

    const finalResults = baseResults.slice(0, limit);

    // Opportunistic purge (~1% of misses)
    if (Math.random() < 0.01) {
      adminClient.rpc("purge_old_search_cache").then(() => {}).catch(() => {});
    }

    timings.total = Math.round(performance.now() - t0);
    console.log(JSON.stringify({ fn: "search-books", cache: "miss", q: queryKey, timings, n: finalResults.length }));

    return new Response(JSON.stringify({ results: finalResults }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=300",
        "X-Cache": "MISS",
      },
    });
  } catch (err) {
    console.error(JSON.stringify({ fn: "search-books", error: "handler", message: String(err) }));
    return new Response(JSON.stringify({ results: [], error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

