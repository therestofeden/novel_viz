/**
 * DNA similarity: the reference implementation of "If you loved this shape".
 *
 * Production runs the same arithmetic in SQL (public.get_dna_neighbours, see
 * supabase/migrations/20261118183051_dna_neighbours_exact_ranking.sql);
 * this file exists so the method is readable, testable and reusable on its
 * own. The full write-up is docs/dna-similarity.md.
 *
 * Every mapped book has a DNA of 12 axes, each scored 0-100 (fiction and
 * non-fiction use different axis sets and are never compared with each
 * other). Two books are close when their scores are close on every axis:
 * we use plain Euclidean distance, not cosine similarity, because the scores
 * are absolute positions on fixed scales. Cosine would call a book that is
 * 20/100 on everything identical to one that is 80/100 on everything.
 */

export type Axis = { id: string; score: number };

export type Candidate = { key: string; title: string; author?: string; axes: Axis[] };

export type Neighbour = {
  key: string;
  title: string;
  author?: string;
  /** Euclidean distance over the shared axes, rounded to 0.1 */
  distance: number;
  /** 100 minus the root-mean-square gap per axis, clamped to 0-100 */
  matchPct: number;
  /** up to 3 axes where the two books are within 10 points, closest first (ties by axis id) */
  sharedAxes: string[];
};

/** Minimum axes two books must share to be compared at all. */
export const MIN_SHARED_AXES = 10;
/** Two scores within this many points count as "shared". */
export const SHARED_AXIS_GAP = 10;

/**
 * Title folding used to recognise the same book under two spellings:
 * lowercase, accents stripped, subtitle dropped (after ':' '(' '['),
 * a leading "the/a/an" dropped, punctuation collapsed. Mirrors SQL
 * public.book_norm_title(); a title with no latin letters or digits
 * falls back to its plain lowercase form.
 */
export function normTitle(t: string | null | undefined): string {
  const raw = (t ?? "").trim();
  const s = raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s*[:([].*$/s, "")
    .replace(/^(the|a|an)\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return s || raw.toLowerCase();
}

/** Distance, match % and shared axes between two DNA vectors, or null if fewer than MIN_SHARED_AXES overlap. */
export function compare(target: Axis[], other: Axis[]): Omit<Neighbour, "key" | "title" | "author"> | null {
  const byId = new Map(target.map((a) => [a.id, a.score]));
  let sumSq = 0;
  let n = 0;
  const gaps: Array<{ id: string; gap: number }> = [];
  for (const a of other) {
    const t = byId.get(a.id);
    if (t === undefined) continue;
    const gap = Math.abs(a.score - t);
    sumSq += gap * gap;
    n += 1;
    gaps.push({ id: a.id, gap });
  }
  if (n < MIN_SHARED_AXES) return null;
  const distance = Math.sqrt(sumSq);
  // sqrt(sumSq / n) rather than distance / sqrt(n): same value, but exact for
  // integer scores, so a gap of exactly x.5 rounds the same way as in SQL.
  const matchPct = Math.max(0, Math.min(100, Math.round(100 - Math.sqrt(sumSq / n))));
  const sharedAxes = gaps
    .filter((g) => g.gap <= SHARED_AXIS_GAP)
    .sort((a, b) => a.gap - b.gap || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, 3)
    .map((g) => g.id);
  return { distance: Math.round(distance * 10) / 10, matchPct, sharedAxes };
}

/** Sum of squared gaps: ranks the same as the distance, and is exact for integer scores. */
function sumOfSquares(target: Axis[], other: Axis[]): number {
  const byId = new Map(target.map((a) => [a.id, a.score]));
  let sumSq = 0;
  for (const a of other) {
    const t = byId.get(a.id);
    if (t !== undefined) sumSq += (a.score - t) ** 2;
  }
  return sumSq;
}

/**
 * Nearest books to `target`, closest first. Drops the book itself, anything
 * in `excludeTitles` (the pick already shown beside the list), and keeps only
 * the closest copy when two candidates fold to the same title.
 */
export function nearestNeighbours(
  target: { title: string; axes: Axis[] },
  candidates: Candidate[],
  options: { limit?: number; excludeTitles?: string[] } = {},
): Neighbour[] {
  const limit = Math.min(options.limit ?? 8, 24);
  const excluded = new Set([target.title, ...(options.excludeTitles ?? [])].map(normTitle));
  // Rank on the exact sum of squares (as SQL does); ties break by key in
  // byte order. Distances are rounded only for display.
  const best = new Map<string, { n: Neighbour; raw: number }>();
  for (const c of candidates) {
    const norm = normTitle(c.title);
    if (excluded.has(norm)) continue;
    const r = compare(target.axes, c.axes);
    if (!r) continue;
    const raw = sumOfSquares(target.axes, c.axes);
    const prev = best.get(norm);
    if (!prev || raw < prev.raw || (raw === prev.raw && c.key < prev.n.key)) {
      best.set(norm, { n: { key: c.key, title: c.title, author: c.author, ...r }, raw });
    }
  }
  return [...best.values()]
    .sort((a, b) => a.raw - b.raw || (a.n.key < b.n.key ? -1 : 1))
    .slice(0, limit)
    .map((x) => x.n);
}
