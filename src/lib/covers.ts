// Cover art fetching.
//
// 2026-09-08: Google Books' unkeyed volumes endpoint is structurally dead —
// its anonymous quota is set to 0/day ("quota_limit_value": "0" in the 429
// body), not just exhausted for today. Open Library's covers API is unkeyed
// and unmetered, so it's the default source now.
//
// If a Google Books API key is ever added, drop it into
// VITE_GOOGLE_BOOKS_API_KEY (Vercel project env var) and nothing else needs
// to change — fetchCoverUrl tries it first, since keyed Google search
// handles messy/foreign-language title+author queries better than Open
// Library's, and only falls back to Open Library when it's absent or misses.
//
// Open Library's own relevance ranking is uneven for translated classics —
// searching "The Stranger" + "Camus" surfaces Coles/SparkNotes study-guide
// editions, not Camus's novel (the real editions are catalogued under
// "L'Étranger"). So results are filtered rather than trusted blindly: no
// cover beats a wrong or study-guide cover. CoverPlate (see
// src/components/CoverPlate.tsx) renders a designed fallback when nothing
// acceptable turns up — coverage will never be 100%, on any source.

const coverCache = new Map<string, string | null>();

const NOISE_TITLE_PATTERN =
  /\b(adapt(ed|ation)|abridged|graded reader|coles ?notes|cliff('?s)? ?notes|spark ?notes|study guide|study companion|companion|workbook|summary(?: and analysis)?|analysis of|teacher'?s guide)\b/i;

function stripDiacritics(s: string): string {
  // NFD splits accented letters into base + combining marks (U+0300-U+036F);
  // dropping marks in that block turns "García" into "Garcia" for matching.
  return Array.from(s.normalize("NFD"))
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code < 0x0300 || code > 0x036f;
    })
    .join("");
}

function normalize(s: string): string {
  return stripDiacritics(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titlesCompatible(requested: string, candidate: string): boolean {
  const a = normalize(requested);
  const b = normalize(candidate);
  if (!a || !b) return false;
  return a === b || a.startsWith(b) || b.startsWith(a);
}

function hasLatinLetters(s: string): boolean {
  return /[a-z]/i.test(s);
}

function authorMatches(requested: string, candidates: string[] | undefined): boolean {
  if (!candidates || candidates.length === 0) return false;
  const a = normalize(requested);
  if (!a) return false;
  if (
    candidates.some((c) => {
      const b = normalize(c);
      return !!b && (a === b || a.includes(b) || b.includes(a));
    })
  ) {
    return true;
  }
  // Text overlap is unverifiable when every candidate author is in a
  // non-Latin script — Russian, Greek, Arabic, etc. classics are catalogued
  // under their own transliteration, not the DB's Latin spelling (e.g.
  // Dostoevsky as "Фёдор Михайлович Достоевский"). Treat that as unverified
  // rather than mismatched and lean on the title match instead, rather than
  // rejecting the correct book for a whole class of canonical titles.
  return candidates.every((c) => !hasLatinLetters(c));
}

function baseTitle(title: string): string | null {
  // Open Library's title search frequently returns nothing for a full
  // "Title: Subtitle" query even though the base title is well-indexed
  // (seen on "The Silk Roads: A New History of the World" and "The Sixth
  // Extinction: An Unnatural History") — worth a second attempt on just
  // the part before the colon.
  const idx = title.indexOf(":");
  return idx > 0 ? title.slice(0, idx).trim() : null;
}

interface OLDoc {
  title?: string;
  author_name?: string[];
  cover_i?: number;
}

async function searchOpenLibrary(params: Record<string, string | null>): Promise<OLDoc[]> {
  const entries = Object.entries(params).filter((e): e is [string, string] => !!e[1]);
  const qs = new URLSearchParams({ ...Object.fromEntries(entries), limit: "8", fields: "title,author_name,cover_i" });
  const r = await fetch(`https://openlibrary.org/search.json?${qs.toString()}`);
  if (!r.ok) return [];
  const json = await r.json();
  return Array.isArray(json?.docs) ? json.docs : [];
}

function pickCover(docs: OLDoc[], title: string, author: string | null): number | null {
  for (const doc of docs) {
    if (!doc.cover_i || !doc.title) continue;
    if (NOISE_TITLE_PATTERN.test(doc.title)) continue;
    if (!titlesCompatible(title, doc.title)) continue;
    if (author && !authorMatches(author, doc.author_name)) continue;
    return doc.cover_i;
  }
  return null;
}

async function fetchFromOpenLibrary(title: string, author: string | null): Promise<string | null> {
  try {
    // Waterfall: exact title+author, then title alone (author spelling
    // mismatch), then the same two with the subtitle stripped. Stops at the
    // first tier that yields an acceptable match.
    const base = baseTitle(title);
    const attempts: Array<{ title: string; author: string | null }> = [
      { title, author },
      ...(author ? [{ title, author: null }] : []),
      ...(base ? [{ title: base, author }] : []),
      ...(base && author ? [{ title: base, author: null }] : []),
    ];

    for (const attempt of attempts) {
      const docs = await searchOpenLibrary(attempt);
      const coverId = pickCover(docs, title, author);
      if (coverId !== null) {
        // default=false: an id with no real art otherwise 200s with a tiny
        // grey placeholder image instead of 404ing, which would render as
        // "found".
        return `https://covers.openlibrary.org/b/id/${coverId}-M.jpg?default=false`;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchFromGoogleBooks(title: string, author: string | null): Promise<string | null> {
  const key = import.meta.env?.VITE_GOOGLE_BOOKS_API_KEY as string | undefined;
  if (!key) return null; // no key configured — Open Library handles it alone
  try {
    const q = author
      ? `intitle:${encodeURIComponent(title)}+inauthor:${encodeURIComponent(author)}`
      : `intitle:${encodeURIComponent(title)}`;
    const r = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1&printType=books&key=${key}`,
    );
    if (!r.ok) return null;
    const json = await r.json();
    const raw = json?.items?.[0]?.volumeInfo?.imageLinks?.thumbnail as string | undefined;
    return raw ? raw.replace("http://", "https://").replace("&edge=curl", "") + "&fife=w300" : null;
  } catch {
    return null;
  }
}

export async function fetchCoverUrl(
  title: string,
  author: string | null | undefined,
): Promise<string | null> {
  const cleanAuthor = author && author !== "Unknown" ? author : null;
  const key = `${title.toLowerCase()}|${(cleanAuthor ?? "").toLowerCase()}`;
  if (coverCache.has(key)) return coverCache.get(key)!;

  const url =
    (await fetchFromGoogleBooks(title, cleanAuthor)) ?? (await fetchFromOpenLibrary(title, cleanAuthor));
  coverCache.set(key, url);
  return url;
}
