import {
  type NovelAnalysis,
  DNA_AXIS_IDS,
  DNA_AXIS_META,
  NF_DNA_AXIS_IDS,
  NF_DNA_AXIS_META,
  isNonFiction,
} from "@/lib/novel-types";

/**
 * DNA glyph + book ink: the "every book gets a face" system.
 *
 * Design source: the 2026-11-18 canvas "NovelViz — Making it more appealing".
 * Row 01 (the glyph) was approved as-is; the chosen direction for the app is
 * "Paper & ink" colours with the "Reading room" layout (row 04).
 *
 * Geometry: twelve petals in canonical axis order, clockwise from 12 o'clock,
 * in a 200x200 box centred on (100,100). A petal's length is its score. The
 * order never changes, so two books' silhouettes are directly comparable.
 *
 * Ink: every book gets one colour of its own. It is derived, never stored:
 * the book's tone picks the family (bleak books get cool, deep inks; brighter
 * ones warm inks) and a hash of the normalised title picks the ink inside it,
 * so it is free, stable across sessions and views, and varied along a shelf.
 *
 * Everything here is pure (no React), so the same paths can feed the book
 * page, the cover-plate fallback, the library portrait and a share image.
 */

// ─── Geometry ────────────────────────────────────────────────────────────────

export const GLYPH_BOX = 200;
const C = GLYPH_BOX / 2;
const R_INNER = 9;
export const R_MAX = 94;
const HALF_WIDTH = (Math.PI / 12) * 0.72; // 72% of each 30-degree slot, so petals never touch
const MIN_LEN = 0.07; // a score of 0 still reads as a mark

/** viewBox that leaves room for axis labels around the ring. */
export const LABELLED_VIEWBOX = { x: -26, y: -16, w: 252, h: 232 } as const;

const angle = (i: number) => -Math.PI / 2 + (i * Math.PI) / 6;
const pt = (r: number, a: number) =>
  `${(C + r * Math.cos(a)).toFixed(1)} ${(C + r * Math.sin(a)).toFixed(1)}`;

export interface GlyphAxis {
  id: string;
  name: string;
  short: string;
  score: number | null;
}

const FICTION_SHORT: Record<string, string> = {
  interiority: "Interiority",
  plot_density: "Plot",
  time_linearity: "Linear time",
  scale: "Scale",
  realism: "Realism",
  tonal_register: "Tone",
  prose_density: "Prose",
  moral_ambiguity: "Moral grey",
  character_vs_plot: "Character",
  political_charge: "Politics",
  formal_experimentation: "Form",
  ending_openness: "Open end",
};

const NF_SHORT: Record<string, string> = {
  accessibility: "Accessible",
  idea_density: "Ideas",
  structure: "Structure",
  scope: "Scope",
  evidence_rigor: "Evidence",
  tone: "Tone",
  prose_density: "Prose",
  certainty: "Certainty",
  theory_vs_case: "Cases",
  political_charge: "Politics",
  structural_innovation: "Form",
  actionability: "Actionable",
};

/** Twelve slots in canonical order; a missing axis is `null`, never dropped. */
export function glyphAxes(analysis: NovelAnalysis): GlyphAxis[] {
  const nf = isNonFiction(analysis);
  const ids: readonly string[] = nf ? NF_DNA_AXIS_IDS : DNA_AXIS_IDS;
  const meta = (nf ? NF_DNA_AXIS_META : DNA_AXIS_META) as Record<string, { name: string }>;
  const short = nf ? NF_SHORT : FICTION_SHORT;
  const scores = new Map<string, number>();
  for (const a of analysis.dna?.axes ?? []) {
    if (a && typeof a.score === "number" && Number.isFinite(a.score)) {
      scores.set(a.id, Math.max(0, Math.min(100, a.score)));
    }
  }
  return ids.map((id) => ({
    id,
    name: meta[id]?.name ?? id,
    short: short[id] ?? meta[id]?.name ?? id,
    score: scores.has(id) ? scores.get(id)! : null,
  }));
}

/** Below six measured axes the silhouette is too sparse to mean anything. */
export function hasEnoughDna(axes: GlyphAxis[]): boolean {
  return axes.filter((a) => a.score !== null).length >= 6;
}

/** One SVG path holding all twelve petals (kites from the centre outwards). */
export function petalPath(scores: Array<number | null>): string {
  let d = "";
  for (let i = 0; i < 12; i++) {
    const s = scores[i];
    const v = Math.max(MIN_LEN, (s ?? 0) / 100);
    const a = angle(i);
    const tip = R_INNER + v * (R_MAX - R_INNER);
    const mid = R_INNER + (tip - R_INNER) * 0.42;
    d += `M${pt(R_INNER * 0.4, a)} L${pt(mid, a - HALF_WIDTH)} L${pt(tip, a)} L${pt(mid, a + HALF_WIDTH)} Z `;
  }
  return d.trim();
}

/** Faint guide spokes, one per axis. */
export function spokePath(): string {
  let d = "";
  for (let i = 0; i < 12; i++) d += `M${pt(12, angle(i))} L${pt(R_MAX, angle(i))} `;
  return d.trim();
}

/** Where each axis label sits around the ring (centre of the text). */
export function labelPositions(radius = 108): Array<{ x: number; y: number }> {
  return Array.from({ length: 12 }, (_, i) => ({
    x: +(C + radius * Math.cos(angle(i))).toFixed(1),
    y: +(C + 2.5 + radius * Math.sin(angle(i))).toFixed(1),
  }));
}

/** Screen-reader text: the three longest and two shortest petals. */
export function describeGlyph(axes: GlyphAxis[]): string {
  const known = axes.filter((a) => a.score !== null) as Array<GlyphAxis & { score: number }>;
  const sorted = [...known].sort((a, b) => b.score - a.score);
  const fmt = (a: { name: string; score: number }) => `${a.name} ${a.score}`;
  const longest = sorted.slice(0, 3).map(fmt).join(", ");
  const shortest = sorted.slice(-2).reverse().map(fmt).join(", ");
  return `DNA glyph. Longest: ${longest}. Shortest: ${shortest}.`;
}

// ─── Ink ─────────────────────────────────────────────────────────────────────

/** The paper the "Paper & ink" direction moves to, and today's paper. */
export const PAPER = "#F4EFE6";
export const PAPER_CURRENT = "#EEF4F9";
export const NAVY = "#0F2B4D";
export const CREAM = "#F7F1E4";

/** Deep, cool inks for bleak books. Order matters: the hash indexes into it. */
export const COOL_INKS = [
  "#4F6830", // moss
  "#2F5D50", // pine
  "#5E6470", // slate
  "#4A5A78", // graphite
  "#6D3A6A", // plum
  "#7A2E3A", // wine
  "#1E6B78", // aegean
  "#4B5BB5", // indigo
] as const;

/** Warm, brighter inks for everything else. */
export const WARM_INKS = [
  "#9C8AD0", // lilac
  "#3FA3A0", // sea
  "#E58A6E", // coral
  "#D4911C", // marigold
  "#24704F", // green
  "#A93C25", // brick
  "#85592A", // tea
  "#A8475A", // rose
] as const;

/** Tone at or above this reads as "warm". Fiction: tonal_register; non-fiction: tone. */
const WARM_AT = { fiction: 40, nonfiction: 50 } as const;

export interface BookInk {
  /** the book's colour: plate background, petal fill on paper */
  ink: string;
  /** text and petals drawn ON the ink (navy or cream, whichever passes AA) */
  onInk: string;
  /** the ink darkened until it passes AA as text on both papers */
  inkText: string;
  /** true when the ink alone is too light to outline petals on paper (needs a navy edge) */
  outline: boolean;
  family: "warm" | "cool";
}

export function normaliseTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^(the|a|an) /, "");
}

/** FNV-1a, 32-bit. Stable across browsers and the server. */
export function hashKey(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function darken(hex: string, f: number): string {
  return (
    "#" +
    rgb(hex)
      .map((c) => Math.round(c * f).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

function deriveInk(ink: string, family: "warm" | "cool"): BookInk {
  const onInk = contrast(ink, NAVY) >= contrast(ink, CREAM) ? NAVY : CREAM;
  let inkText = ink;
  for (let f = 1; f > 0.3; f -= 0.04) {
    inkText = darken(ink, f);
    if (contrast(inkText, PAPER) >= 4.5 && contrast(inkText, PAPER_CURRENT) >= 4.5) break;
  }
  return { ink, onInk, inkText, outline: contrast(ink, PAPER) < 3, family };
}

/** Core rule, separated from NovelAnalysis so it is easy to test. */
export function inkFor(title: string, tone: number | null, nonFiction = false): BookInk {
  const warmAt = nonFiction ? WARM_AT.nonfiction : WARM_AT.fiction;
  const family = (tone ?? 50) >= warmAt ? "warm" : "cool";
  const set = family === "warm" ? WARM_INKS : COOL_INKS;
  return deriveInk(set[hashKey(normaliseTitle(title)) % set.length], family);
}

/**
 * Minimal analysis-shaped object for drawing a glyph from bare DNA rows
 * (neighbour lists, recommendations) without loading the full analysis.
 */
export function glyphSource(
  title: string,
  bookType: string | null | undefined,
  axes: Array<{ id: string; score: number }> | null | undefined,
): NovelAnalysis {
  return {
    bookType: bookType === "nonfiction" ? "nonfiction" : "fiction",
    title,
    dna: { signature: "", axes: (axes ?? []).map((a) => ({ id: a.id, score: a.score, evidence: "" })) },
  } as unknown as NovelAnalysis;
}

/** The three most defining axes: furthest from the midpoint, strongest first. */
export function definingAxes(analysis: NovelAnalysis, count = 3): Array<GlyphAxis & { score: number }> {
  return glyphAxes(analysis)
    .filter((a): a is GlyphAxis & { score: number } => a.score !== null)
    .map((a, i) => ({ a, i, pull: Math.abs(a.score - 50) }))
    .sort((x, y) => y.pull - x.pull || x.i - y.i)
    .slice(0, count)
    .map(({ a }) => a);
}

export function bookInk(analysis: NovelAnalysis): BookInk {
  const nf = isNonFiction(analysis);
  const toneId = nf ? "tone" : "tonal_register";
  const tone = analysis.dna?.axes?.find((a) => a?.id === toneId)?.score;
  return inkFor(analysis.title ?? "", typeof tone === "number" ? tone : null, nf);
}

// ─── Page wiring ─────────────────────────────────────────────────────────────

/** Fired when something above the fold asks the strand (BookDNA) to open. */
export const OPEN_DNA_EVENT = "nv:open-dna";

/** Open the twelve-bar strand and bring it into view. */
export function openDnaStrand(): void {
  window.dispatchEvent(new CustomEvent(OPEN_DNA_EVENT));
  // let BookDNA render the opened strand before scrolling to it
  window.requestAnimationFrame(() =>
    document.getElementById("dna-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" }),
  );
}

// ─── Reading shape (the library portrait) ────────────────────────────────────

/** Plain-language axis names for the sentence under the portrait, canonical order. */
const SHAPE_PHRASES = [
  "interiority", "plot", "linear time", "scale", "realism", "light tone",
  "prose density", "moral grey", "character", "politics", "formal play", "open endings",
] as const;

function listPhrases(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export interface ReadingShape {
  /** mean score per axis, canonical order; axes no book measured stay null */
  avg: Array<number | null>;
  /** three highest axes, phrased for a sentence ("scale, prose density and politics") */
  longest: string;
  /** two lowest axes */
  shortest: string;
  /** title of the finished book whose shape is closest to the average */
  nearest: string | null;
}

/**
 * The average shape of a reader's finished fiction. Only fiction: fiction and
 * non-fiction DNA use different twelve axes, so averaging across them would
 * mean nothing. Pure, so it is easy to test.
 */
export function readingShape(books: Array<{ title: string; scores: Array<number | null> }>): ReadingShape | null {
  const usable = books.filter((b) => b.scores.filter((s) => s !== null).length >= 6);
  if (usable.length === 0) return null;
  const avg: Array<number | null> = Array.from({ length: 12 }, (_, i) => {
    const vals = usable.map((b) => b.scores[i]).filter((s): s is number => typeof s === "number");
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  });
  const ranked = avg
    .map((v, i) => ({ v, i }))
    .filter((x): x is { v: number; i: number } => x.v !== null)
    .sort((a, b) => b.v - a.v || a.i - b.i);
  let nearest: string | null = null;
  let best = Infinity;
  for (const b of usable) {
    let d = 0;
    for (let i = 0; i < 12; i++) {
      const a = avg[i];
      if (a === null) continue;
      d += Math.pow((b.scores[i] ?? a) - a, 2);
    }
    if (d < best) {
      best = d;
      nearest = b.title;
    }
  }
  return {
    avg,
    longest: listPhrases(ranked.slice(0, 3).map((x) => SHAPE_PHRASES[x.i])),
    shortest: listPhrases(ranked.slice(-2).reverse().map((x) => SHAPE_PHRASES[x.i])),
    nearest,
  };
}
