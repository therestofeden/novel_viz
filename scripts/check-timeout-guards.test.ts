// Regression tests for scripts/check-timeout-guards.ts's core heuristic --
// findViolationLines(). Fixtures below are drawn directly from real
// patterns in this codebase (guarded reads, the recommend-by-dna/db-
// maintenance generic-typed `withTimeout<T>(` shape, the
// dna-consensus-style fire-and-forget `.then()` chain that a naive
// backward `await` scan would misattribute, and a comment that merely
// mentions `.rpc(`/`await` without being code) so a future change to the
// heuristic that reintroduces one of today's false positives/negatives
// fails a test immediately instead of waiting for the next full audit.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { findViolationLines } from "./check-timeout-guards.ts";

function lines(s: string): string[] {
  // Strip a common leading newline from template literals for readability.
  return s.replace(/^\n/, "").split("\n");
}

Deno.test("findViolationLines - flags an awaited, unguarded .from() call", () => {
  const src = lines(`
  async function handler() {
    const { data } = await supabase
      .from("novel_analyses")
      .select("id");
    return data;
  }
  `);
  assertEquals(findViolationLines(src), [2]);
});

Deno.test("findViolationLines - does not flag a call guarded by withTimeout(...)", () => {
  const src = lines(`
  async function handler() {
    const { data } = await withTimeout(
      supabase.from("novel_analyses").select("id"),
      { data: null, error: null } as any,
    );
    return data;
  }
  `);
  assertEquals(findViolationLines(src), []);
});

Deno.test("findViolationLines - guard token with generic type args still counts (withTimeout<T>(...))", () => {
  const src = lines(`
  async function handler() {
    const { data, error } = await withTimeout<{ data: number | null; error: unknown }>(
      Promise.resolve(supabase.rpc(rpcName)).then(({ data, error }) => ({ data, error })),
      { data: null, error: null },
    );
  }
  `);
  assertEquals(findViolationLines(src), []);
});

Deno.test("findViolationLines - does not flag a fire-and-forget .then() chain, even with an unrelated await just above", () => {
  // Mirrors dna-consensus/index.ts: the `await res.json()` line belongs to
  // a PRIOR, semicolon-terminated statement, not to the upsert chain below
  // it, and the upsert itself is never awaited -- only `.then()`-chained.
  const src = lines(`
  async function handler() {
    const data = await res.json();
    admin
      .from("dna_recommendation_cache")
      .upsert({ cache_key: cacheKey }, { onConflict: "cache_key" })
      .then(() => {}, (e: any) => console.error(e));
  }
  `);
  assertEquals(findViolationLines(src), []);
});

Deno.test("findViolationLines - does not flag Array.from(...)", () => {
  const src = lines(`
  function toArray(buf: Uint8Array) {
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16));
  }
  `);
  assertEquals(findViolationLines(src), []);
});

Deno.test("findViolationLines - does not flag a call mentioned only in a comment", () => {
  // Mirrors db-maintenance/index.ts's own header comment describing the
  // bug this script exists to catch.
  const src = lines(`
  // This file used to have a bare \`await supabase.rpc(...)\` with no ceiling.
  async function handler() {
    return 1;
  }
  `);
  assertEquals(findViolationLines(src), []);
});

Deno.test("findViolationLines - honors a timeout-guard-ignore comment several lines above the call", () => {
  const src = lines(`
  async function recordSpend() {
    // timeout-guard-ignore: every call site does
    // recordSpend(...).catch(() => {}), never awaited -- a hang here can't
    // block a response.
    const { error } = await admin.rpc("gemini_record_spend", { p_cost: 1 });
    if (error) console.warn(error);
  }
  `);
  assertEquals(findViolationLines(src), []);
});

Deno.test("findViolationLines - flags multiple distinct violations in one file", () => {
  const src = lines(`
  async function a() {
    const { data: x } = await supabase.from("t1").select("id");
  }
  async function b() {
    const { data: y } = await supabase.rpc("some_rpc");
  }
  `);
  assertEquals(findViolationLines(src), [1, 4]);
});

Deno.test("findViolationLines - a guard token belonging to a different, distant statement doesn't suppress a real violation", () => {
  const src = lines(`
  async function a() {
    await withTimeout(somethingUnrelated(), null);
    ${Array(20).fill("    // padding to push the next call outside the guard window").join("\n")}
    const { data } = await supabase.from("t1").select("id");
  }
  `);
  // The withTimeout(...) above is far outside WINDOW_BEFORE, so this must
  // still be flagged -- a guard shouldn't "leak" across unrelated code.
  const violationLine = src.findIndex((l) => l.includes(".from("));
  assertEquals(findViolationLines(src), [violationLine]);
});
