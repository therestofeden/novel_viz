// Regression tests for gemini.ts's pure failure-classification and pricing
// helpers. Added 2026-09-16 daily backend audit.
//
// classifyGeminiFailure specifically has a track record of real, subtle
// misclassification bugs with a multi-day user-facing blast radius: the
// 2026-07-25 billing outage showed "AI service is overloaded" for ~2.5 days
// because a quota failure wasn't distinguished from a capacity failure, and
// the 2026-09-04 auth_error addition exists so a rejected API key (imminent
// risk this month per the Standard-key deprecation) doesn't quietly fall
// into the generic "bad request" bucket instead. Both regressions are
// exactly the shape a status-code/regex table like this one can silently
// reintroduce on an unrelated edit — pinning the classification table down
// here means the next change to it gets caught before a multi-day incident,
// not after.
//
// Only the pure, DB/network-free exports are covered — geminiFetchWithFallback
// and geminiFetchWithFallback's circuit-breaker RPC calls need a live
// SupabaseClient and are exercised via the existing manual/prod-log
// verification process instead (see this file's own top-of-file history).
//
// Run: deno test supabase/functions/_shared/
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { classifyGeminiFailure, describeGeminiFailure, estimateCostUsd } from "./gemini.ts";

// ---------- classifyGeminiFailure ----------

Deno.test("classifyGeminiFailure - 429 with billing/quota wording -> quota_exhausted", () => {
  assertEquals(
    classifyGeminiFailure(429, '{"error":{"message":"Your prepayment credits are depleted, RESOURCE_EXHAUSTED"}}'),
    "quota_exhausted",
  );
  assertEquals(
    classifyGeminiFailure(429, '{"error":{"message":"Quota exceeded for requests"}}'),
    "quota_exhausted",
  );
});

Deno.test("classifyGeminiFailure - plain 429 with no quota wording -> capacity (transient)", () => {
  // The critical distinction the 2026-07-25 incident was about: a generic
  // overload 429 must stay "capacity" (retry-worthy), not get lumped in
  // with the permanent quota_exhausted case.
  assertEquals(classifyGeminiFailure(429, '{"error":{"message":"The model is overloaded"}}'), "capacity");
});

Deno.test("classifyGeminiFailure - 401 -> auth_error unconditionally", () => {
  assertEquals(classifyGeminiFailure(401, "{}"), "auth_error");
  assertEquals(classifyGeminiFailure(401, "anything at all"), "auth_error");
});

Deno.test("classifyGeminiFailure - 403 with key-rejection wording -> auth_error", () => {
  for (const body of [
    '{"error":{"status":"UNAUTHENTICATED","message":"API_KEY_INVALID"}}',
    '{"error":{"message":"API key not valid. Please pass a valid API key."}}',
    '{"error":{"message":"API key expired"}}',
    '{"error":{"message":"invalid API key"}}',
  ]) {
    assertEquals(classifyGeminiFailure(403, body), "auth_error", `expected auth_error for: ${body}`);
  }
});

Deno.test("classifyGeminiFailure - 403 WITHOUT key-rejection wording -> client_error, not auth_error", () => {
  // Gemini also returns plain 403 for unrelated permission cases (e.g. a
  // region restriction) — those must not be misdiagnosed as "the key died."
  assertEquals(
    classifyGeminiFailure(403, '{"error":{"message":"User location is not supported"}}'),
    "client_error",
  );
});

Deno.test("classifyGeminiFailure - 404 -> model_unavailable (skip model, not whole chain)", () => {
  assertEquals(classifyGeminiFailure(404, '{"error":{"message":"model not found"}}'), "model_unavailable");
});

Deno.test("classifyGeminiFailure - 500/503 -> capacity", () => {
  assertEquals(classifyGeminiFailure(500, "{}"), "capacity");
  assertEquals(classifyGeminiFailure(503, "{}"), "capacity");
});

Deno.test("classifyGeminiFailure - other 4xx (e.g. 400 malformed request) -> client_error", () => {
  assertEquals(classifyGeminiFailure(400, '{"error":{"message":"invalid argument"}}'), "client_error");
});

// ---------- describeGeminiFailure ----------

Deno.test("describeGeminiFailure - returns honest copy for the previously-mislabeled reasons", () => {
  assertEquals(
    describeGeminiFailure("quota_exhausted"),
    "The AI service's API quota has run out. We've been notified — please try again later, or add your own Gemini API key in settings.",
  );
  assertEquals(
    describeGeminiFailure("auth_error"),
    "The AI service needs reconfiguration on our end — we've been notified. In the meantime, you can add your own Gemini API key in settings to keep going.",
  );
});

Deno.test("describeGeminiFailure - returns null for status-based reasons callers already word correctly", () => {
  assertEquals(describeGeminiFailure("capacity"), null);
  assertEquals(describeGeminiFailure("client_error"), null);
  assertEquals(describeGeminiFailure(undefined), null);
});

// ---------- estimateCostUsd ----------

Deno.test("estimateCostUsd - computes cost from per-1M-token pricing", () => {
  // gemini-3.6-flash: $1.50/M input, $7.50/M output.
  const cost = estimateCostUsd("gemini-3.6-flash", 1_000_000, 1_000_000);
  assertEquals(cost, 1.50 + 7.50);
});

Deno.test("estimateCostUsd - zero tokens costs zero", () => {
  assertEquals(estimateCostUsd("gemini-3.6-flash", 0, 0), 0);
});

Deno.test("estimateCostUsd - unknown model returns 0 instead of throwing", () => {
  // Deliberate design choice (see the function's own comment) — a pricing
  // gap for a not-yet-priced model must never block spend recording.
  assertEquals(estimateCostUsd("some-future-model-not-in-the-table", 1000, 1000), 0);
});
