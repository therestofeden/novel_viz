import { describe, expect, it } from "vitest";

import type { NovelAnalysis } from "@/lib/novel-types";
import { shareCardSvg, wrapLines } from "@/lib/share-card";

const IDS = [
  "interiority", "plot_density", "time_linearity", "scale", "realism", "tonal_register",
  "prose_density", "moral_ambiguity", "character_vs_plot", "political_charge",
  "formal_experimentation", "ending_openness",
];
const book = (title: string, scores: number[], extra: Record<string, unknown> = {}) =>
  ({
    bookType: "fiction",
    title,
    author: "Gabriel García Márquez",
    dna: { signature: "Multigenerational saga, mythical realism, cyclical fate.", axes: scores.map((score, i) => ({ id: IDS[i], score, evidence: "" })) },
    ...extra,
  }) as unknown as NovelAnalysis;

const SOLITUDE = book("One Hundred Years of Solitude", [40, 70, 10, 95, 35, 45, 85, 60, 55, 70, 30, 0]);

describe("share card", () => {
  it("wraps text to the line budget and ellipsises overflow", () => {
    expect(wrapLines("One Hundred Years of Solitude", 22, 3)).toEqual(["One Hundred Years of", "Solitude"]);
    const long = wrapLines("a ".repeat(100), 10, 2);
    expect(long).toHaveLength(2);
    expect(long[1].endsWith("…")).toBe(true);
  });

  it("draws the glyph, title, author and the host, on the book's ink", () => {
    const svg = shareCardSvg(SOLITUDE, "novel-viz.vercel.app")!;
    expect(svg).toContain("Solitude");
    expect(svg).toContain("Gabriel García Márquez");
    expect(svg).toContain("novel-viz.vercel.app");
    expect(svg.match(/<path d="M/g)).toHaveLength(1); // one path holding twelve petals
    expect(svg).toMatch(/<rect width="540" height="960" fill="#[0-9A-F]{6}"/);
  });

  it("lists the three most defining axes with their scores", () => {
    const svg = shareCardSvg(SOLITUDE, "x")!;
    // furthest from the midpoint: ending openness 0, scale 95, time linearity 10
    for (const n of ["0", "95", "10"]) expect(svg).toContain(`>${n}</text><text`);
    expect(svg).toContain(">Open end<");
    expect(svg).toContain(">Scale<");
  });

  it("escapes markup in titles and authors", () => {
    const svg = shareCardSvg(book('Tom & "Jerry" <b>', [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50]), "x")!;
    expect(svg).toContain("Tom &amp; &quot;Jerry&quot; &lt;b&gt;");
    expect(svg).not.toContain("<b>");
  });

  it("returns null when there is too little DNA to draw", () => {
    expect(shareCardSvg(book("Sparse", [50, 50, 50, 50, 50]), "x")).toBeNull();
  });
});
