import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { blockedPositions, filterBlocked, guardRecommendation, matchesCorePattern } from "./guardrails.ts";

// deno-lint-ignore no-explicit-any
function fakeAdmin(rpc: (name: string, args: any) => Promise<{ data: unknown; error: unknown }>): any {
  return { rpc };
}

Deno.test("core patterns catch the obvious titles and nothing else", () => {
  assert(matchesCorePattern("Mein Kampf"));
  assert(matchesCorePattern("The Protocols of the Learned Elders of Zion"));
  assert(!matchesCorePattern("My Struggle"));
  assert(!matchesCorePattern("The Origins of Totalitarianism"));
  assert(!matchesCorePattern(undefined));
});

Deno.test("blockedPositions maps the RPC's 1-based positions to 0-based", async () => {
  const admin = fakeAdmin(async () => ({ data: [2], error: null }));
  const out = await blockedPositions(admin, [{ title: "Emma" }, { title: "Siege", author: "James Mason" }]);
  assertEquals([...out], [1]);
});

Deno.test("an RPC error still blocks the core titles", async () => {
  const admin = fakeAdmin(async () => { throw new Error("db down"); });
  const out = await blockedPositions(admin, [{ title: "Emma" }, { title: "Mein Kampf" }]);
  assertEquals([...out], [1]);
});

Deno.test("guardRecommendation flags, filterBlocked drops", async () => {
  const admin = fakeAdmin(async (_n, args) => ({
    data: args.p_titles.map((t: string, i: number) => (t === "The Turner Diaries" ? i + 1 : null)).filter(Boolean),
    error: null,
  }));
  const rec = await guardRecommendation(admin, { title: "The Turner Diaries", author: "" });
  assertEquals((rec as { hidden?: boolean }).hidden, true);
  const ok = await guardRecommendation(admin, { title: "Beloved", author: "Toni Morrison" });
  assertEquals((ok as { hidden?: boolean }).hidden, undefined);
  const list = await filterBlocked(admin, [{ title: "Beloved" }, { title: "The Turner Diaries" }]);
  assertEquals(list.map((b) => b.title), ["Beloved"]);
});
