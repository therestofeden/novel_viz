import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DnaGlyph } from "@/components/DnaGlyph";
import type { NovelAnalysis } from "@/lib/novel-types";

const IDS = [
  "interiority", "plot_density", "time_linearity", "scale", "realism", "tonal_register",
  "prose_density", "moral_ambiguity", "character_vs_plot", "political_charge",
  "formal_experimentation", "ending_openness",
];
const book = (scores: number[]) =>
  ({
    bookType: "fiction",
    title: "One Hundred Years of Solitude",
    author: "Gabriel García Márquez",
    dna: { signature: "", axes: scores.map((score, i) => ({ id: IDS[i], score, evidence: "" })) },
  }) as unknown as NovelAnalysis;

const SOLITUDE = book([40, 70, 10, 95, 35, 45, 85, 60, 55, 70, 30, 0]);

describe("<DnaGlyph>", () => {
  it("renders an accessible image in the book's ink", () => {
    const { container } = render(<DnaGlyph analysis={SOLITUDE} labels />);
    const img = screen.getByRole("img");
    expect(img.getAttribute("aria-label")).toContain("Scale 95");
    expect(container.querySelector('path[fill="#D4911C"]')).not.toBeNull();
    expect(container.querySelectorAll("text")).toHaveLength(12);
  });

  it("draws petals in the on-ink colour for the plate variant", () => {
    const { container } = render(<DnaGlyph analysis={SOLITUDE} variant="plate" />);
    expect(container.querySelector('path[fill="#0F2B4D"]')).not.toBeNull();
    expect(container.querySelector("circle")).toBeNull();
  });

  it("renders nothing when the DNA is too sparse", () => {
    const { container } = render(<DnaGlyph analysis={book([50, 50, 50])} />);
    expect(container.firstChild).toBeNull();
  });
});
