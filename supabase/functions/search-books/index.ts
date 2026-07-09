// search-books — popularity-ranked, Latinized book search
//
// Backend EM notes (this revision):
// - Server-side search_cache table: same query from any user → ~30ms instead of ~400ms.
// - Cache key for ✓ Cached badge now matches analyze-novel's buildCacheKey exactly.
// - Typo tolerance: zero-result fallback retries Open Library with fuzzy operator.
// - Author-prefix mode: single-word queries also fan out to author= search in parallel.
// - Structured timing logs so we can spot regressions (ol_fetch / cache / total).
// - Cache-Control switched to `private` (browser sends Authorization → public was a no-op).
// - Miss-path rate limiting (2026-07-03): this endpoint was the last of the
//   high-traffic functions with zero abuse protection — every cache miss hit
//   Open Library + Google Books directly with no ceiling, so a scripted client
//   could exhaust free-tier upstream quota or use it as a cost-free enumeration
//   oracle. Gated to 60 misses/hour/IP via the shared rate_limit_events table;
//   cache hits (the vast majority of real traffic) are unaffected.
// - Coverage pass (2026-07-05): primary OL result cap raised 30→40 and GB
//   maxResults raised 20→30. Both were flagged as fixed caps limiting
//   per-query candidate depth in the 2026-07-04 pipeline audit but left
//   untouched then to avoid stacking two unverified changes in one pass.
//   Both APIs are free/unmetered per-request (no Gemini cost impact) and
//   already timeout-bounded (3s GB / 5s OL) + run in parallel, so this only
//   trades a small amount of upstream payload size for a wider ranking pool
//   on ambiguous/popular queries — e.g. a query matching 35 editions of the
//   same work previously lost the tail past 30 before ranking ever saw them.
// - Canonical-title fix (2026-07-06): OL groups every translation/edition of
//   a classic under one "work" record, and that work's single `title` field
//   is often the ORIGINAL-LANGUAGE title, not the famous English one. Two
//   distinct sub-cases, both verified live against real Open Library data:
//   (1) non-Latin-SCRIPT titles (e.g. the 1063-edition "Odyssey" work is
//   titled "Ὀδύσσεια", Greek) were hard-dropped by isLatin() before scoring
//   ever ran, so search fell back on a much weaker stand-alone stub; (2)
//   Latin-script-but-foreign-LANGUAGE titles (e.g. the 188-edition "Magic
//   Mountain" work is titled "Der Zauberberg" — German, but plain Latin
//   letters, so isLatin() actually passed it fine) scored ~0 lexical
//   relevance against an English query and got buried under near-irrelevant
//   junk instead of being filtered out. Both need the same underlying data:
//   OL's search API accepts `editions,editions.title,editions.language` in
//   the SAME request (no extra round-trip), returning OL's own best-matching
//   edition title per work. pickDisplayTitle() now picks between the work's
//   own title and that edition title QUERY-AWARE-ly — whichever scores
//   higher lexically against what the user typed — rather than blindly
//   preferring one or the other. This matters: always preferring the
//   edition title regressed already-correct results (e.g. "War and Peace"'s
//   real record has a clean own-title match, but its OL edition-title
//   fallback was a messier "War and Peace (War & Peace)" that scored worse
//   and got displaced by an inferior candidate) — confirmed via live
//   A/B testing against 7 classics before landing on the query-aware
//   version. Verified live end-to-end: "the magic mountain" (previously
//   invisible), "the odyssey" and "crime and punishment" (previously a much
//   weaker stand-alone stub) now correctly surface the real, most-published
//   record at #1, with zero regression on War and Peace, One Hundred Years
//   of Solitude, The Brothers Karamazov, and Anna Karenina (all already
//   correct, all unaffected). Deliberately did NOT also add an author-aware
//   gate to the pre-existing title-only second-pass dedup below — tested
//   that combination and it flooded results with many near-duplicate
//   translator editions of the same classic; the query-aware title fix
//   alone is sufficient, see the comment on that dedup step for detail.
// - Graceful OL-timeout degradation (2026-07-07, daily backend agent): found
//   live in production logs — 3 real user searches ("White nights",
//   "Tolstoy", "The death of ivan") in the prior 24h all hit OL's 5s
//   AbortSignal timeout and came back as a hard 502 with EMPTY results,
//   even though Google Books (3s timeout, runs in parallel, already fetched
//   by the time OL gave up) had usable results sitting right there. The old
//   code treated `olResult.status === "rejected"` as fatal for the whole
//   request instead of just falling back to GB-only. Confirmed via
//   search_cache: none of those 3 queries had ever once produced a cached
//   row, meaning every attempt failed outright. Fixed: OL rejection now
//   degrades to `docs = []` (GB items still get merged in below) instead of
//   returning 502; only a genuine "both upstreams failed" case falls
//   through to a 200 with an empty result set (a normal empty-search state
//   the frontend already handles, not an error). This does not change
//   worst-case latency (Promise.allSettled still waits up to OL's 5s
//   timeout either way) — it only changes a guaranteed-failure into a
//   likely-success. Also stopped caching empty result sets under a
//   query_key (would have poisoned that query for up to 24h with a false
//   "no results" even after OL recovered).
// - Author-fanout latency cap (2026-07-08, follow-up to the fuzzy-fallback
//   fix below): timed the live OL upstream directly for common single-word
//   queries ("Harry", "Love", "Life") and found latency is highly variable
//   per-request — anywhere from ~0.6s to ~13s on the SAME query, with no
//   reliable correlation to result-set size ("the", the broadest possible
//   query, was consistently the fastest). Because Promise.all() waits for
//   BOTH the base q= fetch and the author= fanout fetch (see "Author-prefix
//   mode" above) before returning, the effective wait is the SLOWER of two
//   independently-variable-latency requests — which is statistically worse
//   than either alone, even though the author fanout is a supplementary
//   enrichment (catches "garcia marquez"-style author-name queries) and
//   rarely changes the outcome for a single common word, since the base
//   query's own popularity + lexical scoring already surfaces the right
//   answer (e.g. "Harry" → Harry Potter, 398 editions/1009 ratings, miles
//   ahead of any other "Harry" match) without it. Gave the author fanout its
//   own shorter timeout (2500ms, same cap already used for the fuzzy
//   fallback below) instead of inheriting the base fetch's 5000ms — it's a
//   best-effort bonus pass, so failing it fast beats making a query that
//   already has a good base-search answer sit and wait on a slow, lower-value
//   fetch. Worst-case total latency is unchanged (still bounded by the base
//   fetch's own 5000ms + the 2500ms chained fuzzy retry = 7500ms), but the
//   common case — base search finishes quickly while the author fanout tail-
//   lags — now waits at most 2500ms instead of up to 5000ms for that second
//   fetch to resolve.
// - Chained fuzzy-fallback latency cap (2026-07-08, daily backend agent):
//   found live in edge logs — a real "Harry" search ran 5.38s (right at OL's
//   5s ceiling), and tracing the code showed the zero-result fuzzy fallback
//   (added for typo tolerance, see above) is CHAINED after the base+author
//   OL fetch, not parallel with it, so a query needing the fallback (i.e.
//   already the worst case — base search found nothing) could burn up to
//   ~10s of sequential OL time before Google Books even gets merged in.
//   olFetch() now takes an optional per-call timeoutMs; the fuzzy fallback
//   uses 2500ms instead of the default 5000ms, capping worst-case OL time to
//   ~7.5s. Chose to shorten the bonus fallback pass rather than the primary
//   fetch, since failing fast on a best-effort retry beats making the
//   already-emptiest searches wait the longest.

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

// A work's own `title` is often the original-language title for classics
// with many translations (e.g. "Ὀδύσσεια" for the 1063-edition "Odyssey"
// work) — non-Latin-script titles like that are hard-dropped by isLatin()
// below before scoring ever runs. But NOT every foreign-language title is
// non-Latin-script: German ("Der Zauberberg"), French, Spanish etc. use the
// Latin alphabet and pass isLatin() fine — they just score ~0 relevance
// against an English query, so they were previously buried under unrelated
// junk rather than filtered out. Both cases need the same fix: fall back to
// OL's own best-matching edition title (requested via editions.title in
// OL_FIELDS) — but only USE that fallback when it's actually more relevant
// to what the user typed than the work's own title, so a work whose own
// title is already a clean English match (e.g. "War and Peace") isn't
// displaced by a messier edition-specific title text (e.g. "War and Peace
// (War & Peace)") that happens to also be present.
function pickDisplayTitle(query: string, d: { title?: string; editions?: { docs?: OLEditionDoc[] } }): string | null {
  const ownTitle = d.title && isLatin(d.title) ? d.title : null;
  const editionTitle = d.editions?.docs?.[0]?.title;
  const altTitle = editionTitle && isLatin(editionTitle) ? editionTitle : null;
  if (!ownTitle) return altTitle;
  if (!altTitle || altTitle === ownTitle) return ownTitle;
  // Compare pure title relevance (author left blank) to decide which text
  // the user is more likely searching for.
  return lexicalScore(query, altTitle, "") > lexicalScore(query, ownTitle, "") ? altTitle : ownTitle;
}

// ---------- Cache key (must mirror analyze-novel's buildCacheKey EXACTLY) ----------
// analyze-novel builds: `${CACHE_VERSION}|${title}||${author}` with both sides lowercased,
// trimmed, and whitespace-collapsed. Must match analyze-novel's CACHE_VERSION exactly.
const CACHE_VERSION = "v3";
function buildAnalysisCacheKey(title: string, author: string): string {
  const t = title.trim().toLowerCase().replace(/\s+/g, " ");
  const a = (author ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return `${CACHE_VERSION}|${t}||${a}`;
}

// Server-side search cache key — normalized query string only.
function buildSearchCacheKey(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

// Accent-strip + lowercase for accent-insensitive matching (e.g. "garcia" matches "García").
function normalizeForSearch(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
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

interface OLEditionDoc {
  title?: string;
  language?: string[];
}

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
  // OL's own best-matching edition for this work (query/language-aware,
  // returned in the SAME search request — no extra round-trip). Used as a
  // fallback display title when the work's own `title` isn't Latin/English.
  // See "Canonical-title fix" note at the top of this file.
  editions?: { docs?: OLEditionDoc[] };
}

type GBVolumeInfo = {
  title?: string;
  authors?: string[];
  description?: string;
  publishedDate?: string;
  pageCount?: number;
  categories?: string[];
};

type GBItem = { volumeInfo: GBVolumeInfo };

async function fetchGoogleBooks(query: string): Promise<GBItem[]> {
  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=30&printType=books`;
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return [];
    const json = await r.json();
    return (json?.items ?? []) as GBItem[];
  } catch {
    return [];
  }
}

interface Ranked {
  key: string;
  title: string;
  author: string;
  year?: number;
  score: number;
  cached: boolean;
  shelfBoost: boolean;
  description?: string;
}

function lexicalScore(query: string, title: string, author: string): number {
  // Use accent-stripped normalization so "garcia" matches "García Márquez"
  const q = normalizeForSearch(query);
  const t = normalizeForSearch(title);
  const a = normalizeForSearch(author);

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
  "key,title,author_name,author_alternative_name,first_publish_year,edition_count,ratings_count,ia_count,language,editions,editions.title,editions.language";

// ---------- Rate limiting (miss-path only) ----------
// search-books is public/unauthenticated and hit on every debounced keystroke,
// but memory/server cache absorbs the vast majority of that traffic for free.
// The only real cost — and the only real abuse surface (quota exhaustion on
// Open Library / Google Books, or using this as a free enumeration oracle) —
// is the cache-MISS path that reaches out to those upstreams. So unlike the
// Gemini functions (which rate-limit every call), we only count and gate
// requests that actually miss the cache, using the same rate_limit_events
// table + count_recent_events RPC + salted IP hash pattern as takeaways /
// recommend-anti-shelf / recommend-by-dna, for consistency and easy purging.
const ROUTE = "search-books-miss";
const RATE_LIMIT = 60; // cache-miss upstream calls per hour per IP

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

// Supplementary author= fanout fetch (see "Author-fanout latency cap" note
// at the top of this file) gets its own shorter timeout, separate from the
// base fetch's default 5000ms.
const AUTHOR_FANOUT_TIMEOUT_MS = 2500;

async function olFetch(url: string, timeoutMs = 5000): Promise<OLDoc[]> {
  // Open Library has a long tail of slow/hanging responses (search-books
  // already runs 2-5s typically). Unlike fetchGoogleBooks (3s timeout) this
  // call had no bound at all, so a hung OL request could stall the whole
  // search past whatever timeout the browser/edge runtime enforces — which
  // surfaces to the client as an aborted/failed fetch instead of a clean,
  // partial result.
  const res = await fetch(url, {
    headers: { "User-Agent": "novelviz-search/1.1" },
    signal: AbortSignal.timeout(timeoutMs),
  });
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
    const qRaw = (url.searchParams.get("q") ?? "").trim();
    const limit = Math.min(10, Math.max(1, Number(url.searchParams.get("limit") ?? 6)));

    if (qRaw.length < 2) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cap query length: no real book search term needs more than this, and
    // upstream (Google Books / Open Library) fetches + cache-key hashing
    // shouldn't run against an arbitrarily large querystring value.
    const MAX_QUERY_LEN = 200;
    if (qRaw.length > MAX_QUERY_LEN) {
      return new Response(JSON.stringify({ error: `Query too long (max ${MAX_QUERY_LEN} characters)` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const q = qRaw;

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

    // -------- Cache miss: rate-limit before touching upstream APIs --------
    const ip = getClientIp(req);
    const ipHash = await hashIp(ip);
    try {
      const { data: count } = await adminClient.rpc("count_recent_events", {
        p_ip_hash: ipHash,
        p_route: ROUTE,
        p_window_seconds: 3600,
        p_prefetch_only: false,
      });
      if (typeof count === "number" && count >= RATE_LIMIT) {
        timings.total = Math.round(performance.now() - t0);
        console.log(JSON.stringify({ fn: "search-books", cache: "rate_limited", q: queryKey, timings }));
        return new Response(JSON.stringify({ results: [], error: "rate_limited" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "3600" },
        });
      }
    } catch { /* fail open — don't block legitimate searches if the rate DB is unavailable */ }

    // Log the event fire-and-forget; counter is eventually consistent.
    adminClient
      .from("rate_limit_events")
      .insert({ ip_hash: ipHash, route: ROUTE, is_prefetch: false })
      .then(() => {}).catch(() => {});

    // -------- Cache miss: fetch from Open Library (with typo + author-prefix fallbacks) --------
    const olT0 = performance.now();
    const baseUrl =
      `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=40&fields=${OL_FIELDS}`;

    // Fan out to author= search for 1–2 word queries: catches "garcia marquez", "toni morrison", etc.
    const words = q.split(/\s+/).filter(Boolean);
    const isSingleWord = words.length === 1 && q.length >= 3;
    const looksLikeAuthor = words.length === 2; // 2-word queries are often author names
    const authorUrl = (isSingleWord || looksLikeAuthor)
      ? `https://openlibrary.org/search.json?author=${encodeURIComponent(q)}&limit=20&fields=${OL_FIELDS}`
      : null;

    // Run OpenLibrary fetch logic + Google Books in parallel
    const olFetchPromise = (async (): Promise<OLDoc[]> => {
      const fetches: Promise<OLDoc[]>[] = [olFetch(baseUrl)];
      // Author fanout is a best-effort enrichment, not the primary result —
      // cap it below the base fetch's 5000ms so a slow author= response
      // can't drag out a query the base fetch already answered well. See
      // "Author-fanout latency cap" note at the top of this file.
      if (authorUrl) {
        fetches.push(
          olFetch(authorUrl, AUTHOR_FANOUT_TIMEOUT_MS).catch(() => {
            timings.author_fanout_timed_out = 1;
            return [] as OLDoc[];
          }),
        );
      }
      const arrays = await Promise.all(fetches);
      let result = arrays.flat();

      // Typo fallback: if base returned nothing usable, retry with fuzzy operator.
      // This fetch is CHAINED after the base(+author) fetch above, not parallel
      // with it — so its own timeout adds directly to worst-case latency instead
      // of overlapping. Found 2026-07-08: at the old 5000ms timeout, a query that
      // needed this fallback (i.e. the exact case where OL is already returning
      // nothing useful) could take up to ~10s of OL time alone before Google
      // Books results even get merged in. Capped to 2500ms — this is a bonus
      // best-effort pass on top of an already-empty result, so it's worth
      // failing fast rather than making the worst-searches-of-all wait longest.
      if (result.filter((d) => pickDisplayTitle(q, d) !== null).length === 0) {
        const fuzzyUrl =
          `https://openlibrary.org/search.json?q=${encodeURIComponent(q + "~")}&limit=20&fields=${OL_FIELDS}`;
        try {
          const fuzzy = await olFetch(fuzzyUrl, 2500);
          result = result.concat(fuzzy);
          timings.fuzzy_used = 1;
        } catch (_e) { /* ignore */ }
      }
      return result;
    })();

    const [olResult, gbResult] = await Promise.allSettled([
      olFetchPromise,
      fetchGoogleBooks(q),
    ]);

    let docs: OLDoc[];
    if (olResult.status === "fulfilled") {
      docs = olResult.value;
    } else {
      console.error(JSON.stringify({ fn: "search-books", error: "ol_fetch_failed", message: String(olResult.reason) }));
      docs = [];
      timings.ol_fetch_failed = 1;
    }
    const gbItems: GBItem[] = gbResult.status === "fulfilled" ? gbResult.value : [];
    timings.ol_fetch = Math.round(performance.now() - olT0);

    // Build description map from Google Books (key = "title_lower|author0_lower")
    const descriptionMap = new Map<string, string>();
    for (const item of gbItems) {
      const vi = item.volumeInfo;
      if (!vi.title || !vi.description) continue;
      const gbTitle = vi.title.toLowerCase().trim();
      const gbAuthor = (vi.authors?.[0] ?? "").toLowerCase().trim();
      const gbKey = `${gbTitle}|${gbAuthor}`;
      if (!descriptionMap.has(gbKey)) {
        descriptionMap.set(gbKey, vi.description);
      }
    }

    // First pass — Latinize, dedupe, score
    const seen = new Set<string>();
    const candidates: Ranked[] = [];
    for (const d of docs) {
      const displayTitle = pickDisplayTitle(q, d);
      if (!displayTitle) continue;
      const author = pickLatinAuthor(d.author_name?.[0], d.author_alternative_name);
      // Normalize both sides so minor transliteration/spacing differences don't
      // produce duplicate candidates (e.g. "Dostoevsky" vs "Dostoyevsky").
      const dedupKey = `${normalizeForSearch(displayTitle)}::${normalizeForSearch(author)}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      const descKey = `${displayTitle.toLowerCase().trim()}|${author.toLowerCase().trim()}`;
      candidates.push({
        key: d.key,
        title: displayTitle,
        author,
        year: d.first_publish_year,
        score: lexicalScore(q, displayTitle, author) + popularityScore(d),
        cached: false,
        shelfBoost: false,
        description: descriptionMap.get(descKey)?.slice(0, 250) ?? "",
      });
    }

    // Merge Google Books items that aren't already in OL results
    for (const item of gbItems) {
      const vi = item.volumeInfo;
      if (!vi.title || !isLatin(vi.title)) continue;
      const gbAuthor = vi.authors?.[0] ?? "Unknown";
      const dedupKey = `${normalizeForSearch(vi.title)}::${normalizeForSearch(gbAuthor)}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      const descKey = `${vi.title.toLowerCase().trim()}|${gbAuthor.toLowerCase().trim()}`;
      candidates.push({
        key: `gb:${encodeURIComponent(vi.title)}`,
        title: vi.title,
        author: gbAuthor,
        year: vi.publishedDate ? parseInt(vi.publishedDate.slice(0, 4), 10) : undefined,
        score: lexicalScore(q, vi.title, gbAuthor) + 200,
        cached: false,
        shelfBoost: false,
        description: descriptionMap.get(descKey)?.slice(0, 250) ?? "",
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

    // Post-dedup: drop "Unknown" author entries when a real-author result for
    // the same title already exists. Prevents duplicates like "Pale Fire / —"
    // alongside "Pale Fire / Vladimir Nabokov".
    const titlesWithRealAuthor = new Set(
      candidates
        .filter((c) => c.author && c.author !== "Unknown")
        .map((c) => c.title.toLowerCase()),
    );
    const deduped = candidates.filter(
      (c) => !(c.author === "Unknown" && titlesWithRealAuthor.has(c.title.toLowerCase())),
    );

    // Title-only dedup: same title with different author-name transliterations
    // (e.g. "Dostoevsky" vs "Dostoyevsky" vs "F.M. Dostoevsky") produces multiple
    // OL docs for the same work. OL also indexes "The Brothers Karamazov" and
    // "Brothers Karamazov" as separate works. After sorting by score, keep only
    // the first (best-scored) entry per normalized, article-stripped title.
    // (Considered also gating this on author similarity so a coincidentally
    // same-titled but unrelated book — e.g. an academic monograph literally
    // titled "The Magic Mountain" — can't accidentally beat the real novel
    // into "duplicate" status. Verified that's unnecessary in practice: the
    // query-aware pickDisplayTitle() above already ensures the real, popular
    // work outscores such a coincidental collision outright, so it naturally
    // wins this first-come-first-kept dedup without an author check. Adding
    // one anyway risked flooding results with many near-identical translator
    // editions of the SAME classic — e.g. eight separate "The Odyssey"
    // entries by different translators instead of one representative pick —
    // confirmed live against Odyssey/Crime and Punishment/War and
    // Peace/Anna Karenina/Brothers Karamazov before reverting to this
    // simpler, already-proven form.)
    function normalizeTitleForDedup(title: string): string {
      return normalizeForSearch(title).replace(/^(the|a|an)\s+/, "");
    }
    const seenTitles = new Set<string>();
    const titleDeduped = deduped.filter((c) => {
      const normTitle = normalizeTitleForDedup(c.title);
      if (seenTitles.has(normTitle)) return false;
      seenTitles.add(normTitle);
      return true;
    });

    const baseResults = titleDeduped.slice(0, Math.max(limit, 8)).map((c) => ({
      ...c,
      shelfBoost: false,
    }));

    setMemoryCache(queryKey, baseResults);

    // Persist to server cache (background). Only write-through when we got a
    // usable result set — if BOTH upstreams failed/empty, don't cache an
    // empty array under this query_key, since that would poison future
    // requests with a false "no results" for up to 24h even after OL recovers.
    if (baseResults.length > 0) {
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

