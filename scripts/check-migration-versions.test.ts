// Unit tests for check-migration-versions.ts. Run: deno test --allow-read scripts/
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { findProblems } from "./check-migration-versions.ts";

Deno.test("passes on unique, well-formed names", () => {
  assertEquals(findProblems(["20261012120000_a.sql", "20261012120001_b.sql"]), []);
});

Deno.test("flags a duplicate version", () => {
  const p = findProblems(["20261012120000_b.sql", "20261012120000_a.sql"]);
  assertEquals(p.length, 1);
  assertEquals(p[0].startsWith("20261012120000_b.sql: version 20261012120000 already used by 20261012120000_a.sql"), true);
});

Deno.test("flags malformed names", () => {
  assertEquals(findProblems(["2026101212_a.sql", "20261012120000-A.sql", "20261012120000_ok.sql"]).length, 2);
});
