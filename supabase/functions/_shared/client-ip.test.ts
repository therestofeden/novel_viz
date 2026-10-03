// Regression tests for client-ip.ts's getClientIp -- the spoof-resistant
// IP extraction every rate-limited/budget-gated edge function now shares.
// Added 2026-10-03 (daily_backend audit). The core regression this file
// guards: a forged `x-forwarded-for` header must never override a present
// `cf-connecting-ip`, and when `cf-connecting-ip` is absent, the RIGHTMOST
// (not leftmost) `x-forwarded-for` entry must be used -- the leftmost one
// is exactly what let a client bypass every per-IP rate limit and Gemini-
// spend budget in this app before today's fix.
//
// Run: deno test supabase/functions/_shared/
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { getClientIp } from "./client-ip.ts";

function req(headers: Record<string, string>): Request {
  return new Request("https://example.com/", { headers });
}

Deno.test("getClientIp - cf-connecting-ip wins even when x-forwarded-for is forged", () => {
  const r = req({
    "cf-connecting-ip": "203.0.113.9",
    "x-forwarded-for": "198.51.100.1, 203.0.113.9",
  });
  assertEquals(getClientIp(r), "203.0.113.9");
});

Deno.test("getClientIp - a spoofed leftmost x-forwarded-for entry is ignored when cf-connecting-ip is present", () => {
  // This is the exact bypass the pre-2026-10-03 code was vulnerable to:
  // an attacker-chosen leftmost entry must not win over the trusted header.
  const r = req({
    "cf-connecting-ip": "203.0.113.9",
    "x-forwarded-for": "1.2.3.4",
  });
  assertEquals(getClientIp(r), "203.0.113.9");
});

Deno.test("getClientIp - falls back to the RIGHTMOST x-forwarded-for entry, not the leftmost, when cf-connecting-ip is absent", () => {
  const r = req({ "x-forwarded-for": "1.2.3.4, 10.0.0.5, 203.0.113.9" });
  assertEquals(getClientIp(r), "203.0.113.9");
});

Deno.test("getClientIp - a single-entry x-forwarded-for still works with no cf-connecting-ip", () => {
  const r = req({ "x-forwarded-for": "203.0.113.9" });
  assertEquals(getClientIp(r), "203.0.113.9");
});

Deno.test("getClientIp - trims whitespace around entries", () => {
  const r = req({ "x-forwarded-for": "  1.2.3.4 ,  203.0.113.9  " });
  assertEquals(getClientIp(r), "203.0.113.9");
});

Deno.test("getClientIp - falls back to x-real-ip when cf-connecting-ip and x-forwarded-for are both absent", () => {
  const r = req({ "x-real-ip": "203.0.113.9" });
  assertEquals(getClientIp(r), "203.0.113.9");
});

Deno.test("getClientIp - returns 'unknown' when nothing usable is present", () => {
  const r = req({});
  assertEquals(getClientIp(r), "unknown");
});

Deno.test("getClientIp - a blank cf-connecting-ip header falls through to x-forwarded-for", () => {
  const r = req({ "cf-connecting-ip": "   ", "x-forwarded-for": "203.0.113.9" });
  assertEquals(getClientIp(r), "203.0.113.9");
});

Deno.test("getClientIp - an x-forwarded-for value of only commas/whitespace falls through to x-real-ip", () => {
  const r = req({ "x-forwarded-for": " , , ", "x-real-ip": "203.0.113.9" });
  assertEquals(getClientIp(r), "203.0.113.9");
});
