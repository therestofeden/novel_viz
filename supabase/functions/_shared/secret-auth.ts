// Constant-time shared-secret comparison for header-authenticated internal
// endpoints (db-maintenance's x-maintenance-secret, seed-cache's
// x-seed-secret). Both functions previously did plain `secret === expected`
// string comparison — 2026-09-10 daily backend audit flagged this as a
// textbook timing side-channel: V8/Deno string equality short-circuits on
// the first differing byte, so response latency can in principle leak how
// many leading characters of a guessed secret were correct, letting an
// attacker recover it byte-by-byte instead of needing the full keyspace.
//
// Both endpoints are public (verify_jwt: false — they're called by GitHub
// Actions with a bearer secret instead of a user JWT, so there's no JWT
// layer underneath) and gate real-cost actions: seed-cache triggers billed
// Gemini calls (up to 50 books/request), db-maintenance runs DB deletes
// across 6 tables. Network jitter makes a real remote timing attack hard in
// practice, but the fix is free and removes the anti-pattern entirely, so
// there's no reason to leave it.
import { timingSafeEqual } from "https://deno.land/std@0.168.0/crypto/timing_safe_equal.ts";

const enc = new TextEncoder();

/**
 * Constant-time comparison of a caller-provided secret against the expected
 * value. Returns false (never throws) if either side is empty, or if the
 * lengths differ — an early length-mismatch return doesn't leak anything
 * useful about secret content, only whether the guess happened to be the
 * right length, so it's fine for this to short-circuit.
 */
export function secretsMatch(provided: string, expected: string): boolean {
  if (expected.length === 0 || provided.length === 0) return false;
  const a = enc.encode(provided);
  const b = enc.encode(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
