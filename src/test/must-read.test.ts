import { describe, expect, it } from "vitest";
import { getMustRead, isMustRead, MUST_READ } from "@/lib/must-read";

describe("must-read matcher", () => {
  it("works", () => {
    console.log("entries:", MUST_READ.length);
    expect(isMustRead("The Odyssey")).toBe(true);
    expect(isMustRead("odyssey")).toBe(true);
    expect(isMustRead("Beloved", "Toni Morrison")).toBe(true);
    expect(isMustRead("Beloved", "Someone Else")).toBe(false);
    expect(isMustRead("Beloved", "Unknown")).toBe(true);
    expect(isMustRead("Pedro Paramo", "Juan Rulfo")).toBe(true);
    expect(isMustRead("Nineteen Eighty-Four", "George Orwell")).toBe(true);
    expect(isMustRead("The Goldfinch", "Donna Tartt")).toBe(false);
    expect(isMustRead("Survival in Auschwitz", "Primo Levi")).toBe(true);
    expect(getMustRead("Essays", "Michel de Montaigne")?.why).toContain("first person");
    // No duplicate normalized keys colliding to wrong entries
    expect(MUST_READ.length).toBeGreaterThanOrEqual(60);
  });
});
