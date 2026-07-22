// search-books — popularity-ranked, Latinized book search (see prior revisions'
// inline comments in project history for the full changelog; this pass adds
// 2026-07-13 fixes reported directly by Stefano: author-vs-about-author
// ranking, covering single-word surnames and multi-word full names, plus a
// guard against author===title data artifacts falsely triggering the match.)
//
// 2026-07-17 (reported by Stefano: "homer" / "the odissey" never surface
// The Odyssey):
//   (1) Canonical author aliases — OL returns classical authors under their
//       native-script primary name (Homer => "Όμηρος") and the old code took
//       the FIRST Latin alternative, whose ordering varies per work doc. So
//       The Iliad resolved to "Homer" (ranked fine) while The Odyssey
//       resolved to "Homère."/"Homerus" (scored ~nothing for query "homer"
//       and sank below Homer Hickam titles). Now: prefer the Latin alias that
//       matches the query, else the shortest clean Latin alias (the canonical
//       English form in practice).
//   (2) Typo tolerance in scoring — bounded-edit-distance similarity
//       ("odissey" ≈ "odyssey", "hoer" ≈ "homer") earns proportional score,
//       only when there's no literal containment hit, so junk that literally
//       contains a misspelling can't outrank the real work the user meant.
//   (3) Fuzzy escalation — the pre-existing OL fuzzy retry only fired when
//       NOTHING displayable came back, but misspellings get buried under
//       literal junk matches (comics, product names) that DO come back. If no
//       candidate looks like a confident hit, do one bounded fuzzy OL pass
//       and merge before ranking.
//   (4) Canon injection — external APIs cannot spell-correct to canonical
//       works (OL fuzzy returns junk for "odissey", Google Books returns
//       nothing), so the query is fuzzy-matched against our own canon
//       (canon_books table via search_canon RPC: every analyzed book + a
//       marquee-classics tier) in parallel with the external fetches, and
//       the intended work is injected as a first-class candidate. A
//       fuzzy-only canon hit (no literal containment, e.g. "hoer"->"Homer")
//       gets a much larger bonus than a literal one, because a short query
//       can ALSO be a real, if obscure, literal match for an unrelated
//       author (found live: real OL authors surnamed "Hoer" outscored a
//       too-timid canon bonus) — the canonical work must still win. The
//       token-fuzzy-match floor is 6 chars, not 4 (also found live): short
//       common words collide easily in 1-edit-distance space ("home" is one
//       deletion from "homer"), so querying "homer" was fuzzy-matching the
//       unrelated novel "Home Fire" via its title token "home".
//   (5) Compound "Author - Title" queries — found live: Stefano's exact
//       phrase "Homer - The odissey" still returned nothing. Confirmed Open
//       Library's own full-text search returns ZERO results for a literal
//       "X - Y" query (doesn't parse the dash), and testing the whole
//       combined string against a canon row's (much shorter) title/author
//       never matched either. Now splits the query on common separators
//       (-, :, ,, /, &, " by ") and tests each segment independently against
//       canon rows, so "homer" and "the odissey" each get their own shot.
//
// 2026-07-22 (found via live probing, not a user report): "grate gatsby"
// (typo, no leading "the") returned zero relevant results despite
// canon_books already containing "The Great Gatsby" and search_canon's own
// trigram similarity correctly finding it (sim=0.58). Root cause: a dropped
// leading article shifts whole-string length enough to trip bestFuzzySim's
// length-gate, so this file's own canon re-verification (and the general
// OL/GB fuzzy-credit path) silently discarded a real match. Fixed by also
// comparing with a leading article stripped from either side — see
// bestFuzzySim/stripLeadingArticle below. Verified against the full prior
// regression suite (homer/hoer/odissey/crime and punishment/war and
// peace/dune/ulysses/emma) plus 3 negative controls, zero regressions,
// before shipping — see project memory for the verification harness.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

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
  const non = s.replace(/[ -ɏ\s.,'"()\-–—&]/g, "");
  return non.length === 0;
}

// 2026-07-17: query-aware, canonical-leaning alias selection (see header).
// Primary Latin name always wins (don't second-guess real names). Otherwise,
// among the Latin alternatives: prefer an exact query match, then a
// whole-token query match, then a query prefix, then the shortest clean
// alias — which for classical authors is the canonical English form
// ("Homer" over "Homère."/"Homerus"), and also makes the same author resolve
// to ONE spelling across all their works, so dedup and the author-set boost
// see them as the same person.
function pickLatinAuthor(primary: string | undefined, alts: string[] | undefined, query = ""): string {
  if (primary && isLatin(primary)) return primary;
  const latinAlts = (alts ?? []).filter((a) => a && isLatin(a) && a.trim().length >= 3);
  if (latinAlts.length > 0) {
    const qn = normalizeForSearch(query);
    if (qn.length >= 3) {
      const exact = latinAlts.find((a) => normalizeForSearch(a) === qn);
      if (exact) return exact;
      const token = latinAlts.find((a) =>
        normalizeForSearch(a).split(" ").filter(Boolean).includes(qn)
      );
      if (token) return token;
      const prefix = latinAlts.find((a) => normalizeForSearch(a).startsWith(qn));
      if (prefix) return prefix;
    }
    return latinAlts.reduce(
      (best, a) => (a.trim().length < best.trim().length ? a : best),
      latinAlts[0],
    );
  }
  if (primary) return transliterate(primary);
  return "Unknown";
}

function pickDisplayTitle(query: string, d: { title?: string; editions?: { docs?: OLEditionDoc[] } }): string | null {
  const ownTitle = d.title && isLatin(d.title) ? d.title : null;
  const editionTitle = d.editions?.docs?.[0]?.title;
  const altTitle = editionTitle && isLatin(editionTitle) ? editionTitle : null;
  if (!ownTitle) return altTitle;
  if (!altTitle || altTitle === ownTitle) return ownTitle;
  return lexicalScore(query, altTitle, "") > lexicalScore(query, ownTitle, "") ? altTitle : ownTitle;
}

const CACHE_VERSION = "v3";
function buildAnalysisCacheKey(title: string, author: string): string {
  const t = title.trim().toLowerCase().replace(/\s+/g, " ");
  const a = (author ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return `${CACHE_VERSION}|${t}||${a}`;
}

function buildSearchCacheKey(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

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
  // 2026-07-17: set when the candidate matches a canon_books row — canon
  // works get CANON_BONUS and are exempt from the author-vs-about-author
  // exact-title penalty (an obscure author literally named "Dune" must not
  // demote the novel "Dune" by Frank Herbert).
  canonWork?: boolean;
}

// --- Typo tolerance (2026-07-17) -------------------------------------------
// Bounded Levenshtein similarity. maxDist scales with length so short words
// only tolerate 1 edit ("dune" vs "june" stays out via the 0.78 threshold),
// while "odissey" → "odyssey" (1 edit / 7 chars = 0.857) and
// "the odissey" → "the odyssey" (1 / 11 = 0.909) sail through.
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const la = a.length, lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;
  let prev: number[] = new Array(lb + 1);
  let curr: number[] = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    for (let j = 1; j <= lb; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[lb];
}

function fuzzySim(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  const maxDist = maxLen <= 5 ? 1 : maxLen <= 10 ? 2 : 3;
  if (Math.abs(a.length - b.length) > maxDist) return 0;
  const dist = levenshtein(a, b);
  if (dist > maxDist) return 0;
  return 1 - dist / maxLen;
}

// A leading article rarely changes what book someone means, but it does
// change whole-string LENGTH — enough to trip fuzzySim's own length-gate on
// an otherwise-clean match (see bestFuzzySim's 2026-07-22 note below).
// Mirrors normalizeTitleForDedup()'s article-stripping further down this
// file, which already treats "The X" and "X" as the same book for dedup.
function stripLeadingArticle(s: string): string {
  return s.replace(/^(the|a|an)\s+/, "");
}

// Best of whole-string and per-token similarity: a single-word query should
// match one word of a longer title ("odissey" vs "The Odyssey"). Token
// minimum is 6, not 4 (2026-07-17, found live): short common words are
// densely packed in 1-edit-distance space — "home" is exactly one deletion
// from "homer", so querying "homer" was fuzzy-matching "Home Fire" (an
// unrelated novel) via its title token "home" and outranking Homer's own
// works.
//
// 2026-07-22 (found live: "grate gatsby" never surfaced The Great Gatsby,
// despite canon_books' search_canon RPC correctly finding it at sim=0.58):
// a dropped leading article ("the"/"a"/"an") shifts whole-string length
// enough to trip fuzzySim's own length-difference short-circuit, even when
// the rest of the query is a near-perfect (or exact) match — "grate gatsby"
// (12 chars) vs "the great gatsby" (17 chars) fails the gate outright, while
// "grate gatsby" vs the article-stripped "great gatsby" (12 chars) passes
// easily. This silently discarded a real, RPC-confirmed canon_books match
// (this same helper also gates the canon-injection re-verification step
// below), and would equally have suppressed the fuzzy-credit path for any
// OL/GB candidate with the same shape. Fix: also compare with a leading
// article stripped from either side — strictly additive (only ever raises
// `best`, only activates when an article is actually present), so it cannot
// change scoring for any query/title pair that was already comparing
// correctly. Verified against the full prior regression suite (homer/hoer/
// odissey/crime and punishment/war and peace/dune/ulysses/emma) plus 3
// negative controls before shipping — zero regressions.
function bestFuzzySim(q: string, s: string): number {
  let best = fuzzySim(q, s);
  if (best === 1) return 1;

  const qStripped = stripLeadingArticle(q);
  const sStripped = stripLeadingArticle(s);
  if (qStripped !== q || sStripped !== s) {
    const sim = fuzzySim(qStripped, sStripped);
    if (sim > best) best = sim;
    if (best === 1) return 1;
  }

  for (const tok of s.split(" ")) {
    if (tok.length < 6) continue;
    const sim = fuzzySim(q, tok);
    if (sim > best) best = sim;
    if (best === 1) return 1;
  }
  return best;
}

const FUZZY_MIN_SIM = 0.78;
const FUZZY_TITLE_WEIGHT = 480;
const FUZZY_AUTHOR_WEIGHT = 360;

// Canon injection (2026-07-17): rows from the search_canon RPC (canon_books
// table — every analyzed book + a marquee-classics tier). A canon hit is the
// strongest possible signal of what the user meant, worth roughly what a
// healthy popularityScore would contribute for a famous work.
type CanonRow = { title: string; author: string; sim: number };
const CANON_BONUS = 150;
// Found live (2026-07-17) verifying "hoer" → Homer: CANON_BONUS alone
// wasn't enough when the query is ALSO a real, if obscure, literal name
// match — e.g. actual OL authors surnamed "Hoer" get isAuthorTokenMatch's
// full 340 lexicalScore bonus (a legitimate literal hit, not noise) plus
// their own real popularityScore, easily clearing 500+. A fuzzy-only canon
// match (no literal containment at all — "hoer" never literally appears in
// "Homer") needs a much larger push to reliably surface the canonical work
// the user almost certainly meant over an unrelated same-surname author's
// academic papers. Literal canon hits don't need this: lexicalScore's own
// literal-match branches already dominate, CANON_BONUS alone is plenty.
const CANON_FUZZY_ONLY_BONUS = 450;
// ----------------------------------------------------------------------------

function lexicalScore(query: string, title: string, author: string): number {
  const q = normalizeForSearch(query);
  const t = normalizeForSearch(title);
  const a = normalizeForSearch(author);

  let score = 0;

  if (t === q) score += 500;

  const authorTokens = a.split(" ").filter(Boolean);
  const isAuthorTokenMatch = q.length >= 3 && (a === q || authorTokens.includes(q));

  if (a === q) score += 420;
  else if (isAuthorTokenMatch) score += 340;
  else if (a.startsWith(q)) score += 120;
  else if (a.includes(` ${q}`)) score += 80;
  else if (a.includes(q)) score += 35;

  if (t.startsWith(q)) score += 260;
  else if (t.includes(` ${q}`)) score += 180;
  else if (t.includes(q)) score += 90;

  const qTokens = q.split(" ").filter(Boolean);
  if (qTokens.length > 1) {
    const titleWords = t.split(" ");
    const authorWords = a.split(" ");
    const titleMatches = qTokens.filter((token) => titleWords.some((w) => w.startsWith(token))).length;
    const authorMatches = qTokens.filter((token) => authorWords.some((w) => w.startsWith(token))).length;
    score += titleMatches * 55 + authorMatches * 20;
  }

  // Typo tolerance (2026-07-17): near-miss credit, only when there is no
  // literal containment hit — junk that literally contains the misspelling
  // keeps its (modest) literal score, while the real, popular work the user
  // meant gets close-to-exact credit and popularity carries it to the top.
  if (q.length >= 4) {
    if (!t.includes(q)) {
      const sim = bestFuzzySim(q, t);
      if (sim >= FUZZY_MIN_SIM) score += Math.round(FUZZY_TITLE_WEIGHT * sim);
    }
    if (a && !a.includes(q)) {
      const sim = bestFuzzySim(q, a);
      if (sim >= FUZZY_MIN_SIM) score += Math.round(FUZZY_AUTHOR_WEIGHT * sim);
    }
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

const ROUTE = "search-books-miss";
const RATE_LIMIT = 60;

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

const AUTHOR_FANOUT_TIMEOUT_MS = 2500;
const FUZZY_ESCALATION_TIMEOUT_MS = 2500;

async function olFetch(url: string, timeoutMs = 5000): Promise<OLDoc[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": "novelviz-search/1.1" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  const json = await res.json();
  return (json?.docs ?? []) as OLDoc[];
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
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

    const cacheT0 = performance.now();
    const { data: cacheRow } = await adminClient
      .from("search_cache")
      .select("results, last_accessed_at")
      .eq("query_key", queryKey)
      .maybeSingle();
    timings.cache_read = Math.round(performance.now() - cacheT0);

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
    } catch { /* fail open */ }

    adminClient
      .from("rate_limit_events")
      .insert({ ip_hash: ipHash, route: ROUTE, is_prefetch: false })
      .then(() => {}).catch(() => {});

    const olT0 = performance.now();
    const baseUrl =
      `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=40&fields=${OL_FIELDS}`;

    const words = q.split(/\s+/).filter(Boolean);
    const isSingleWord = words.length === 1 && q.length >= 3;
    const looksLikeAuthor = words.length === 2;
    const authorUrl = (isSingleWord || looksLikeAuthor)
      ? `https://openlibrary.org/search.json?author=${encodeURIComponent(q)}&limit=20&fields=${OL_FIELDS}`
      : null;

    const olFetchPromise = (async (): Promise<OLDoc[]> => {
      const fetches: Promise<OLDoc[]>[] = [olFetch(baseUrl)];
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

    const canonPromise: Promise<CanonRow[]> = adminClient
      .rpc("search_canon", { p_q: buildSearchCacheKey(q) })
      .then(({ data, error }: { data: CanonRow[] | null; error: unknown }) => {
        if (error) throw error;
        return data ?? [];
      });

    const [olResult, gbResult, canonResult] = await Promise.allSettled([
      olFetchPromise,
      fetchGoogleBooks(q),
      canonPromise,
    ]);

    const canonRows: CanonRow[] = canonResult.status === "fulfilled" ? canonResult.value : [];
    if (canonResult.status === "rejected") {
      console.error(JSON.stringify({ fn: "search-books", error: "canon_lookup_failed", message: String(canonResult.reason) }));
      timings.canon_failed = 1;
    }

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

    const seen = new Set<string>();
    const candidates: Ranked[] = [];

    const addOlCandidate = (d: OLDoc) => {
      const displayTitle = pickDisplayTitle(q, d);
      if (!displayTitle) return;
      const author = pickLatinAuthor(d.author_name?.[0], d.author_alternative_name, q);
      const dedupKey = `${normalizeForSearch(displayTitle)}::${normalizeForSearch(author)}`;
      if (seen.has(dedupKey)) return;
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
    };

    for (const d of docs) addOlCandidate(d);

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

    const qNorm = normalizeForSearch(q);
    const qTokCount = qNorm.split(" ").filter(Boolean).length;

    // Compound "Author - Title" queries (2026-07-17, found live: Stefano's
    // exact phrase "Homer - The odissey" still returned nothing after the
    // fixes above). Confirmed Open Library's own full-text search returns
    // ZERO results for a literal "X - Y" query — it doesn't parse the dash
    // as a separator, so the combined string never matches anything, and
    // testing qNorm as one whole blob against a canon row's title/author
    // (both individually much shorter) never hits either. Split on common
    // "author / title" separators so each side gets tested independently —
    // "homer" then exact-matches the author, "the odissey" then fuzzy-
    // matches the title, either one is enough to inject the work.
    const qSegments = qNorm
      .split(/\s*[-:,/&]\s*| by /)
      .map((s) => s.trim())
      .filter((s) => s.length >= 3);
    const qCandidates = qSegments.length > 1 ? [qNorm, ...qSegments] : [qNorm];

    // Canon injection (2026-07-17): external APIs cannot spell-correct to
    // canonical works ("odissey" gets junk from OL fuzzy and nothing from
    // Google Books), so inject what the user most plausibly meant from our
    // own canon. The gate below re-verifies each RPC row with the same
    // bounded-edit-distance helpers used in scoring, so trigram recall noise
    // never reaches results. Dedup favors the richer OL/GB doc when the same
    // work is already present.
    let canonInjected = false;
    for (const row of canonRows) {
      const tNorm = normalizeForSearch(row.title);
      const aNorm = normalizeForSearch(row.author);
      let literalHit = false;
      let fuzzyHit = false;
      for (const qc of qCandidates) {
        if (
          tNorm === qc || tNorm.includes(qc) ||
          (aNorm.length > 0 && (aNorm === qc || aNorm.split(" ").filter(Boolean).includes(qc)))
        ) {
          literalHit = true;
          break;
        }
        if (
          qc.length >= 4 &&
          (bestFuzzySim(qc, tNorm) >= FUZZY_MIN_SIM ||
            (aNorm.length > 0 && bestFuzzySim(qc, aNorm) >= FUZZY_MIN_SIM))
        ) {
          fuzzyHit = true;
        }
      }
      if (!literalHit && !fuzzyHit) continue;
      canonInjected = true;
      const bonus = CANON_BONUS + (literalHit ? 0 : CANON_FUZZY_ONLY_BONUS);
      const dedupKey = `${tNorm}::${aNorm}`;
      if (seen.has(dedupKey)) {
        // The work already came in via OL/GB (richer doc wins the slot) —
        // still mark it as canon and credit it.
        const existing = candidates.find(
          (c) => `${normalizeForSearch(c.title)}::${normalizeForSearch(c.author)}` === dedupKey,
        );
        if (existing && !existing.canonWork) {
          existing.canonWork = true;
          existing.score += bonus;
        }
        continue;
      }
      seen.add(dedupKey);
      const descKey = `${row.title.toLowerCase().trim()}|${row.author.toLowerCase().trim()}`;
      candidates.push({
        key: `canon:${row.title}|${row.author}`,
        title: row.title,
        author: row.author,
        year: undefined,
        score: lexicalScore(q, row.title, row.author) + bonus,
        cached: false,
        shelfBoost: false,
        description: descriptionMap.get(descKey)?.slice(0, 250) ?? "",
        canonWork: true,
      });
    }

    // Fuzzy escalation (2026-07-17): the fuzzy retry inside olFetchPromise
    // only fires when literally NOTHING displayable came back — but a
    // misspelling like "odissey" gets buried under literal junk matches
    // (comics, product names) that DO come back, so the canonical work the
    // user meant never even enters the candidate set. If nothing here looks
    // like a confident hit for the query, do one bounded fuzzy OL pass and
    // merge through the same pipeline. Cache-miss-only cost, ≤2.5s, and the
    // merged result set gets cached like any other.
    const hasConfidentMatch = candidates.some((c) => {
      const t = normalizeForSearch(c.title);
      const a = normalizeForSearch(c.author);
      if (t === qNorm || a === qNorm) return true;
      if (a.split(" ").filter(Boolean).includes(qNorm)) return true;
      if (qTokCount > 1 && (t.startsWith(qNorm) || t.includes(` ${qNorm}`))) return true;
      return false;
    });
    if (!canonInjected && (qTokCount > 1 || qNorm.length >= 5) && !hasConfidentMatch) {
      try {
        const fuzzyDocs = await olFetch(
          `https://openlibrary.org/search.json?q=${encodeURIComponent(q + "~")}&limit=20&fields=${OL_FIELDS}`,
          FUZZY_ESCALATION_TIMEOUT_MS,
        );
        timings.fuzzy_escalated = 1;
        for (const d of fuzzyDocs) addOlCandidate(d);
      } catch (_e) { /* best-effort */ }
    }

    // Author-query result-set fix (2026-07-13): a coincidentally same-titled
    // or same-named book by an UNRELATED author can carry an unusually high
    // OL popularity score and still out-total an individual work by the real
    // author. Decidable only at the RESULT-SET level: if the query genuinely
    // matches an author with real work present among these candidates, boost
    // that author's own books and knock down any OTHER candidate whose title
    // matches the query but whose own author has nothing to do with it (the
    // signature of a book ABOUT, not BY, that person) — exact title match
    // gets a harder penalty, title merely CONTAINING the query (e.g. a
    // biography subtitle) gets a softer one. Handles both single-word
    // surnames ("pirandello", whole-token match) and multi-word full names
    // ("garcia marquez", substring-of-author-name match). Scoped so it can't
    // demote a genuinely titled novel like "Ulysses" or "Emma": no author by
    // that name exists among real results for those queries, so it's a no-op.
    //
    // Guard found live while verifying this fix: "The Odyssey World Atlas"
    // has a data-quality quirk (from OL/GB source data) where its author
    // field is literally the same text as its own title — a mis-tagged
    // publisher/product name, not a person. Without excluding that, its
    // "author" field CONTAINED the query "the odyssey" as a substring, which
    // falsely satisfied the multi-word author-match branch below and
    // demoted the real "The Odyssey" by Homer underneath it. Any candidate
    // whose author string is identical to its own title is excluded from
    // ever counting as an author match.
    const isCandidateByMatchedAuthor = (c: Ranked) => {
      const authorNorm = normalizeForSearch(c.author);
      const titleNormForGuard = normalizeForSearch(c.title);
      if (qNorm.length < 3 || authorNorm === titleNormForGuard) return false;
      if (authorNorm === qNorm) return true;
      if (qTokCount === 1) {
        return authorNorm.split(" ").filter(Boolean).includes(qNorm);
      }
      return authorNorm.includes(qNorm);
    };
    if (candidates.some(isCandidateByMatchedAuthor)) {
      for (const c of candidates) {
        if (isCandidateByMatchedAuthor(c)) {
          c.score += 150;
          continue;
        }
        if (c.canonWork) continue; // canon works are never "about the author" junk
        const titleNorm = normalizeForSearch(c.title);
        if (titleNorm === qNorm) c.score -= 300;
        else if (titleNorm.includes(qNorm)) c.score -= 150;
      }
    }

    const analysisT0 = performance.now();
    const analysisKeys = candidates.map((c) => buildAnalysisCacheKey(c.title, c.author));
    const { data: cachedAnalysisRows } = analysisKeys.length > 0
      ? await adminClient.from("novel_analyses").select("cache_key").in("cache_key", analysisKeys)
      : { data: [] as Array<{ cache_key: string }> };
    timings.analysis_lookup = Math.round(performance.now() - analysisT0);

    const cachedSet = new Set<string>();
    for (const r of (cachedAnalysisRows ?? [])) cachedSet.add(r.cache_key as string);

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

    const titlesWithRealAuthor = new Set(
      candidates
        .filter((c) => c.author && c.author !== "Unknown")
        .map((c) => c.title.toLowerCase()),
    );
    const deduped = candidates.filter(
      (c) => !(c.author === "Unknown" && titlesWithRealAuthor.has(c.title.toLowerCase())),
    );

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
