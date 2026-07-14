import { describe, expect, it } from "vitest";
import { getClassic, isClassic, CLASSIC } from "@/lib/classic";
import { MUST_READ } from "@/lib/must-read";

describe("classic matcher", () => {
  it("works", () => {
    console.log("entries:", CLASSIC.length);
    expect(isClassic("Dune")).toBe(true);
    expect(isClassic("dune")).toBe(true);
    expect(isClassic("Emma", "Jane Austen")).toBe(true);
    expect(isClassic("Emma", "Someone Else")).toBe(false);
    expect(isClassic("The Iliad")).toBe(true);
    expect(isClassic("The Goldfinch", "Donna Tartt")).toBe(false);
    expect(getClassic("Hopscotch")?.author).toBe("Julio Cortázar");
    expect(getClassic("Rayuela")?.title).toBe("Hopscotch");
    expect(CLASSIC.length).toBeGreaterThanOrEqual(150);
  });

  it("is mutually exclusive with Must Read", () => {
    for (const entry of MUST_READ) {
      expect(isClassic(entry.title, entry.author)).toBe(false);
    }
  });

  it("has no internal duplicate titles", () => {
    const seen = new Set<string>();
    for (const entry of CLASSIC) {
      const key = entry.title.toLowerCase();
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});
