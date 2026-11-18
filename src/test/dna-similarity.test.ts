import { describe, expect, it } from "vitest";
import { compare, nearestNeighbours, normTitle, type Axis } from "@/lib/dna-similarity";

const IDS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"];
const dna = (...scores: number[]): Axis[] => IDS.map((id, i) => ({ id, score: scores[i] ?? 50 }));

describe("normTitle", () => {
  it("folds articles, subtitles, accents and punctuation", () => {
    expect(normTitle("The Remains of the Day")).toBe("remains of the day");
    expect(normTitle("Sapiens: A Brief History of Humankind")).toBe("sapiens");
    expect(normTitle("Gravity's Rainbow")).toBe("gravity s rainbow");
    expect(normTitle("Cien años de soledad")).toBe("cien anos de soledad");
  });
  it("falls back to the plain title for non-latin scripts", () => {
    expect(normTitle("雪国")).toBe("雪国");
  });
});

describe("compare", () => {
  it("is zero distance and 100% for identical DNA", () => {
    const r = compare(dna(10, 20, 30), dna(10, 20, 30));
    expect(r).toMatchObject({ distance: 0, matchPct: 100 });
  });
  it("is Euclidean, not cosine: uniformly higher scores are far apart", () => {
    const low = IDS.map((id) => ({ id, score: 20 }));
    const high = IDS.map((id) => ({ id, score: 80 }));
    const r = compare(low, high)!;
    expect(r.distance).toBeCloseTo(Math.sqrt(12 * 60 * 60), 1);
    expect(r.matchPct).toBe(40); // 100 - 60 points per axis
  });
  it("needs at least 10 shared axes", () => {
    expect(compare(dna(), dna().slice(0, 9))).toBeNull();
  });
  it("lists up to three axes within 10 points, closest first", () => {
    const r = compare(dna(50, 50, 50, 50), dna(50, 59, 80, 52))!;
    expect(r.sharedAxes[0]).toBe("a");
    expect(r.sharedAxes).not.toContain("c");
    expect(r.sharedAxes.length).toBe(3);
  });
});

describe("nearestNeighbours", () => {
  const target = { title: "Stoner", axes: dna(40, 40, 40) };
  const candidates = [
    { key: "1", title: "The Remains of the Day", axes: dna(41, 40, 40) },
    { key: "2", title: "Remains of the Day", axes: dna(45, 40, 40) },
    { key: "3", title: "On Chesil Beach", axes: dna(42, 41, 40) },
    { key: "4", title: "Stoner", axes: dna(40, 40, 40) },
    { key: "5", title: "Blood Meridian", axes: dna(95, 5, 90) },
  ];

  it("never repeats a book and never returns the book itself", () => {
    const out = nearestNeighbours(target, candidates);
    expect(out.map((n) => n.title)).toEqual(["The Remains of the Day", "On Chesil Beach", "Blood Meridian"]);
  });

  it("drops the pick that is already shown beside the list", () => {
    const out = nearestNeighbours(target, candidates, { excludeTitles: ["Remains of the Day"] });
    expect(out.map((n) => n.title)).toEqual(["On Chesil Beach", "Blood Meridian"]);
  });

  it("respects the limit", () => {
    expect(nearestNeighbours(target, candidates, { limit: 1 })).toHaveLength(1);
  });
});
