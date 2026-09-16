// Regression tests for secret-auth.ts's constant-time secret comparison,
// which gates db-maintenance (runs DB deletes across 6 tables) and
// seed-cache (triggers billed Gemini calls). Added 2026-09-16 daily backend
// audit, alongside the rest of the first _shared/ test coverage — a
// correctness bug here (e.g. an accidental `===` short-circuit path or an
// off-by-one in the length check) would either lock out the legitimate
// GitHub Actions caller or accept a wrong secret, and neither is the kind
// of thing you want to discover live.
//
// Run: deno test supabase/functions/_shared/
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { secretsMatch } from "./secret-auth.ts";

Deno.test("secretsMatch - true for identical non-empty secrets", () => {
  assertEquals(secretsMatch("correct-horse-battery-staple", "correct-horse-battery-staple"), true);
});

Deno.test("secretsMatch - false for a same-length wrong guess", () => {
  // The exact scenario the timing-safe comparison exists for: a wrong guess
  // that's the right length shouldn't take a shortcut through the check.
  assertEquals(secretsMatch("correct-horse-battery-stapla", "correct-horse-battery-staple"), false);
});

Deno.test("secretsMatch - false for different-length strings", () => {
  assertEquals(secretsMatch("short", "a-much-longer-secret-value"), false);
  assertEquals(secretsMatch("a-much-longer-secret-value", "short"), false);
});

Deno.test("secretsMatch - false when either side is empty", () => {
  assertEquals(secretsMatch("", "expected-secret"), false);
  assertEquals(secretsMatch("provided-secret", ""), false);
  assertEquals(secretsMatch("", ""), false);
});

Deno.test("secretsMatch - is case-sensitive", () => {
  assertEquals(secretsMatch("Secret123", "secret123"), false);
});

Deno.test("secretsMatch - handles multi-byte (unicode) secrets correctly", () => {
  // encode()'s byte length can differ from string .length for non-ASCII —
  // make sure the length-mismatch guard compares encoded bytes, not chars.
  assertEquals(secretsMatch("pässwörd-☂", "pässwörd-☂"), true);
  assertEquals(secretsMatch("pässwörd-☂", "password-x"), false);
});
