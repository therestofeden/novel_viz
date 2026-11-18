import { describe, expect, it } from "vitest";

import type { NovelAnalysis } from "@/lib/novel-types";
import {
  COOL_INKS,
  PAPER,
  PAPER_CURRENT,
  WARM_INKS,
  bookInk,
  contrast,
  definingAxes,
  describeGlyph,
  glyphAxes,
  hasEnoughDna,
  inkFor,
  normaliseTitle,
  petalPath,
} from "@/lib/dna-glyph";

const IDS = [
  "interiority", "plot_density", "time_linearity", "scale", "realism", "tonal_register",
  "prose_density", "moral_ambiguity", "character_vs_plot", "political_charge",
  "formal_experimentation", "ending_openness",
];

function fiction(title: string, scores: number[]): NovelAnalysis {
  return {
    bookType: "fiction",
    title,
    author: "",
    dna: { signature: "", axes: scores.map((score, i) => ({ id: IDS[i], score, evidence: "" })) },
  } as unknown as NovelAnalysis;
}

// Real DNA from novel_analyses (2026-11-18).
const SOLITUDE = fiction("One Hundred Years of Solitude", [40, 70, 10, 95, 35, 45, 85, 60, 55, 70, 30, 0]);
const STONER = fiction("Stoner", [92, 20, 50, 25, 100, 15, 65, 75, 95, 35, 10, 15]);

describe("glyph geometry", () => {
  it("always draws twelve petals, even for a zero score", () => {
    const d = petalPath(glyphAxes(SOLITUDE).map((a) => a.score));
    expect(d.match(/Z/g)).toHaveLength(12);
  });

  it("keeps canonical axis order and clamps scores", () => {
    const axes = glyphAxes(fiction("x", [140, -5, 10, 95, 35, 45, 85, 60, 55, 70, 30, 0]));
    expect(axes.map((a) => a.id)).toEqual(IDS);
    expect(axes[0].score).toBe(100);
    expect(axes[1].score).toBe(0);
  });

  it("refuses to draw a glyph from fewer than six axes", () => {
    const sparse = fiction("x", [50, 50, 50, 50, 50]);
    expect(hasEnoughDna(glyphAxes(sparse))).toBe(false);
    expect(hasEnoughDna(glyphAxes(SOLITUDE))).toBe(true);
  });

  it("describes the longest and shortest petals for screen readers", () => {
    const label = describeGlyph(glyphAxes(SOLITUDE));
    expect(label).toContain("Longest: Scale 95");
    expect(label).toContain("Ending openness 0");
  });
});

describe("defining axes", () => {
  it("picks the three furthest from the middle, strongest first", () => {
    // Solitude: Ending openness 0 (50 away), Scale 95 (45), Time linearity 10 (40)
    expect(definingAxes(SOLITUDE).map((a) => a.id)).toEqual(["ending_openness", "scale", "time_linearity"]);
  });
});

describe("book ink", () => {
  it("is deterministic and ignores case, accents and a leading article", () => {
    expect(normaliseTitle("The Misérables")).toBe(normaliseTitle("misérables"));
    expect(inkFor("Les Misérables", 30).ink).toBe(inkFor("les miserables", 30).ink);
  });

  it("gives brighter books warm inks and bleak books cool ones", () => {
    expect(bookInk(SOLITUDE).family).toBe("warm");
    expect(bookInk(STONER).family).toBe("cool");
  });

  it("keeps the colours the design was approved with", () => {
    expect(bookInk(SOLITUDE).ink).toBe("#D4911C"); // marigold
    expect(bookInk(STONER).ink).toBe("#4F6830"); // moss
  });

  it("every ink has an AA text colour on it and an AA text shade on both papers", () => {
    for (const [family, set] of [["warm", WARM_INKS], ["cool", COOL_INKS]] as const) {
      for (const ink of set) {
        const tone = family === "warm" ? 80 : 10;
        // find a title that lands on this ink so the full derivation runs
        let derived = inkFor("probe", tone);
        for (let i = 0; derived.ink !== ink && i < 5000; i++) derived = inkFor(`probe ${i}`, tone);
        expect(derived.ink).toBe(ink);
        expect(contrast(derived.ink, derived.onInk)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(derived.inkText, PAPER)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(derived.inkText, PAPER_CURRENT)).toBeGreaterThanOrEqual(4.5);
        expect(derived.outline).toBe(contrast(ink, PAPER) < 3);
      }
    }
  });
});
