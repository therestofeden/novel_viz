// Regression tests for geminiFetchWithFallback's fallback-chain / circuit-
// breaker / account-alert wiring -- the part of gemini.ts that gemini.test.ts's
// own header explicitly calls out as untested ("geminiFetchWithFallback and
// [its] circuit-breaker RPC calls need a live SupabaseClient and are
// exercised via the existing manual/prod-log verification process instead").
// That gap has been flagged as a standing item across multiple daily-backend
// audits (most recently 2026-09-29, alongside the gemini_account_alert
// feature added that same day) without ever being closed. Closed here with
// a lightweight mock SupabaseClient (records every `.rpc()` call instead of
// hitting a database) and a stubbed `globalThis.fetch` (returns canned
// Response objects instead of calling Gemini) -- no live Supabase project or
// network access needed, so this runs in the same `deno test` invocation as
// every other file in this directory.
//
// Coverage priority: the two production incidents this file's own comments
// document (2026-07-25 quota outage misclassified as generic "overloaded";
// 2026-07-28 BYOK requests wrongly blocked by the server key's circuit) are
// exactly the behaviors asserted below -- a regression in either would have
// shipped straight back into one of those incidents undetected until a
// human noticed live symptoms again, same as before both were caught by
// hand.
//
// Uses the REAL MODEL_FALLBACKS chain (not placeholder model names) so
// estimateCostUsd's pricing lookup actually resolves and the spend-recording
// assertions below exercise the real code path, not a "cost happened to be
// zero for an unpriced fake model" accident.
//
// `sanitizeOps`/`sanitizeResources` are disabled on every test here for one
// reason unrelated to test correctness: attemptFallbackPass calls
// `AbortSignal.timeout(GEMINI_TIMEOUT_MS)` (30s) as a fetch option on every
// attempt, and geminiFetchWithFallback races its work against its own
// `setTimeout(..., maxTotalMs)` hard-ceiling timer (default 90s) -- neither
// timer is ever explicitly cleared once the real work resolves first (fine
// in production, where the isolate recycles; not fine for Deno's leaked-timer
// test sanitizer, which would otherwise fail every test in this file for a
// timer that correctly never fires). Real network I/O is never used, so this
// is a matter of un-fired background timers, not a suppressed real leak.
//
// Run: deno test --no-check --allow-net --allow-env supabase/functions/_shared/
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  geminiFetchWithFallback,
  GEMINI_FAILURE_REASON_HEADER,
  MODEL_FALLBACKS,
  type GeminiFailureReason,
} from "./gemini.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const TEST_OPTS = { sanitizeOps: false, sanitizeResources: false };
const CHAIN = MODEL_FALLBACKS; // real, priced model IDs — see file header.

// ---------- Mock SupabaseClient ----------
// Only `.rpc(name, params)` is ever called on `admin` by the code under
// test -- everything else on the real SupabaseClient type is unused, so the
// mock only needs to satisfy that one method. Cast through `unknown` rather
// than widening the real type, so a future call site that starts using some
// other SupabaseClient method fails loudly here (missing mock method)
// instead of silently returning `undefined`.
interface RpcCall {
  fn: string;
  params: Record<string, unknown>;
}

function makeMockAdmin(
  rpcResults: Record<string, { data?: unknown; error?: { message: string } | null }>,
): { admin: SupabaseClient; calls: RpcCall[] } {
  const calls: RpcCall[] = [];
  const admin = {
    rpc(fn: string, params: Record<string, unknown> = {}) {
      calls.push({ fn, params });
      const result = rpcResults[fn] ?? { data: null, error: null };
      return Promise.resolve({ data: result.data ?? null, error: result.error ?? null });
    },
  } as unknown as SupabaseClient;
  return { admin, calls };
}

// Every RPC gemini.ts's fallback path can call, defaulted to the "healthy,
// under budget, no open circuits" case so each test only needs to override
// what it actually cares about.
function defaultRpcResults() {
  return {
    gemini_daily_budget_exceeded: { data: false },
    gemini_circuit_check: { data: false },
    gemini_circuit_record_fail: { data: null },
    gemini_circuit_record_success: { data: null },
    gemini_account_alert_record: { data: null },
    gemini_account_alert_clear: { data: null },
    gemini_record_spend: { data: null },
  };
}

// ---------- Mock fetch ----------
// Queues one Response per call, in order, regardless of which model/URL it
// was for -- tests assert call count/order separately via `fetchCalls`.
function mockFetchSequence(responses: Response[]): { calls: RequestInit[] } {
  const calls: RequestInit[] = [];
  let i = 0;
  globalThis.fetch = ((_url: string, init?: RequestInit) => {
    calls.push(init ?? {});
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    return Promise.resolve(r);
  }) as typeof fetch;
  return { calls };
}

function okResponse(): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: "{}" } }], usage: { prompt_tokens: 10, completion_tokens: 20 } }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function errResponse(status: number, body: string): Response {
  return new Response(body, { status, headers: { "Content-Type": "application/json" } });
}

function modelOf(calls: RequestInit[], i: number): string {
  const body = JSON.parse(String(calls[i].body));
  return body.model;
}

// ---------- Tests ----------

Deno.test("geminiFetchWithFallback - success on first model: records circuit success, clears account alert, records spend, never fails", TEST_OPTS, async () => {
  const { admin, calls } = makeMockAdmin(defaultRpcResults());
  const { calls: fetchCalls } = mockFetchSequence([okResponse()]);

  const res = await geminiFetchWithFallback(admin, "key", {}, CHAIN, true);

  assertEquals(res.status, 200);
  assertEquals(fetchCalls.length, 1);
  assertEquals(modelOf(fetchCalls, 0), CHAIN[0]);
  assertEquals(calls.some((c) => c.fn === "gemini_circuit_record_success" && c.params.p_model === CHAIN[0]), true);
  assertEquals(calls.some((c) => c.fn === "gemini_account_alert_clear"), true);
  assertEquals(calls.some((c) => c.fn === "gemini_record_spend"), true);
  assertEquals(calls.some((c) => c.fn === "gemini_circuit_record_fail"), false);
  assertEquals(calls.some((c) => c.fn === "gemini_account_alert_record"), false);
});

Deno.test("geminiFetchWithFallback - quota_exhausted on model 1: stops the whole chain, records BOTH circuit fail and account alert (the 2026-09-29 blind spot)", TEST_OPTS, async () => {
  const { admin, calls } = makeMockAdmin(defaultRpcResults());
  const { calls: fetchCalls } = mockFetchSequence([
    errResponse(429, '{"error":{"message":"Your prepayment credits are depleted, RESOURCE_EXHAUSTED"}}'),
    okResponse(), // must never be reached
  ]);

  const res = await geminiFetchWithFallback(admin, "key", {}, CHAIN, true);

  assertEquals(res.status, 429);
  assertEquals(res.headers.get(GEMINI_FAILURE_REASON_HEADER), "quota_exhausted" as GeminiFailureReason);
  // Chain must stop after model 1 -- models 2/3 are guaranteed-failing
  // round trips on an account-level failure, per this file's own comment.
  assertEquals(fetchCalls.length, 1);
  const failCall = calls.find((c) => c.fn === "gemini_circuit_record_fail");
  assertEquals(failCall?.params.p_model, CHAIN[0]);
  const alertCall = calls.find((c) => c.fn === "gemini_account_alert_record");
  assertEquals(alertCall?.params.p_reason, "quota_exhausted");
});

Deno.test("geminiFetchWithFallback - auth_error on model 1: stops the chain, records BOTH circuit fail and account alert", TEST_OPTS, async () => {
  const { admin, calls } = makeMockAdmin(defaultRpcResults());
  const { calls: fetchCalls } = mockFetchSequence([
    errResponse(401, "{}"),
    okResponse(),
  ]);

  const res = await geminiFetchWithFallback(admin, "key", {}, CHAIN, true);

  assertEquals(res.status, 401);
  assertEquals(res.headers.get(GEMINI_FAILURE_REASON_HEADER), "auth_error" as GeminiFailureReason);
  assertEquals(fetchCalls.length, 1);
  const failCall = calls.find((c) => c.fn === "gemini_circuit_record_fail");
  assertEquals(failCall?.params.p_model, CHAIN[0]);
  const alertCall = calls.find((c) => c.fn === "gemini_account_alert_record");
  assertEquals(alertCall?.params.p_reason, "auth_error");
});

Deno.test("geminiFetchWithFallback - BYOK (isServerKey=false) quota_exhausted: still stops the chain, but NEVER touches the shared circuit or account alert (the 2026-07-28 fix)", TEST_OPTS, async () => {
  const { admin, calls } = makeMockAdmin(defaultRpcResults());
  const { calls: fetchCalls } = mockFetchSequence([
    errResponse(429, '{"error":{"message":"RESOURCE_EXHAUSTED"}}'),
    okResponse(),
  ]);

  const res = await geminiFetchWithFallback(admin, "byok-key", {}, CHAIN, false);

  assertEquals(res.status, 429);
  // Still correct to stop early for this one BYOK request (same project
  // quota across all 3 models) -- but a BYOK key's own quota problem must
  // never be recorded against the SHARED server-key circuit/alert state.
  assertEquals(fetchCalls.length, 1);
  assertEquals(calls.some((c) => c.fn === "gemini_circuit_check"), false);
  assertEquals(calls.some((c) => c.fn === "gemini_circuit_record_fail"), false);
  assertEquals(calls.some((c) => c.fn === "gemini_account_alert_record"), false);
  assertEquals(calls.some((c) => c.fn === "gemini_daily_budget_exceeded"), false);
});

Deno.test("geminiFetchWithFallback - model_unavailable (404) on model 1: skips to model 2 instead of aborting the chain", TEST_OPTS, async () => {
  const { admin, calls } = makeMockAdmin(defaultRpcResults());
  const { calls: fetchCalls } = mockFetchSequence([
    errResponse(404, '{"error":{"message":"model not found"}}'),
    okResponse(),
  ]);

  const res = await geminiFetchWithFallback(admin, "key", {}, CHAIN, true);

  assertEquals(res.status, 200);
  assertEquals(fetchCalls.length, 2);
  assertEquals(modelOf(fetchCalls, 0), CHAIN[0]);
  assertEquals(modelOf(fetchCalls, 1), CHAIN[1]);
  const failCall = calls.find((c) => c.fn === "gemini_circuit_record_fail");
  assertEquals(failCall?.params.p_model, CHAIN[0]);
  assertEquals(calls.some((c) => c.fn === "gemini_circuit_record_success" && c.params.p_model === CHAIN[1]), true);
  assertEquals(calls.some((c) => c.fn === "gemini_account_alert_record"), false);
});

Deno.test("geminiFetchWithFallback - circuit already open for model 1: skipped without ever calling fetch for it, model 2 tried instead", TEST_OPTS, async () => {
  const rpcResults = defaultRpcResults();
  let circuitCallCount = 0;
  const { admin, calls } = makeMockAdmin(rpcResults);
  // Override rpc for gemini_circuit_check specifically: open for model 1, closed for the rest.
  (admin as unknown as { rpc: unknown }).rpc = (fn: string, params: Record<string, unknown> = {}) => {
    calls.push({ fn, params });
    if (fn === "gemini_circuit_check") {
      circuitCallCount++;
      return Promise.resolve({ data: params.p_model === CHAIN[0], error: null });
    }
    const result = (rpcResults as Record<string, { data?: unknown }>)[fn] ?? { data: null };
    return Promise.resolve({ data: result.data ?? null, error: null });
  };
  const { calls: fetchCalls } = mockFetchSequence([okResponse()]);

  const res = await geminiFetchWithFallback(admin, "key", {}, CHAIN, true);

  assertEquals(res.status, 200);
  assertEquals(fetchCalls.length, 1);
  assertEquals(modelOf(fetchCalls, 0), CHAIN[1]);
  assertEquals(circuitCallCount, 2); // checked for model 1 (open, skipped) and model 2 (closed, used)
});

Deno.test("geminiFetchWithFallback - daily budget already exceeded: returns 503 daily_budget without ever calling fetch", TEST_OPTS, async () => {
  const rpcResults = defaultRpcResults();
  rpcResults.gemini_daily_budget_exceeded = { data: true };
  const { admin } = makeMockAdmin(rpcResults);
  const { calls: fetchCalls } = mockFetchSequence([okResponse()]);

  const res = await geminiFetchWithFallback(admin, "key", {}, CHAIN, true);

  assertEquals(res.status, 503);
  assertEquals(res.headers.get(GEMINI_FAILURE_REASON_HEADER), "daily_budget" as GeminiFailureReason);
  assertEquals(fetchCalls.length, 0);
});

Deno.test("geminiFetchWithFallback - every circuit open: no fetch attempted on either pass, returns all_circuits_open", TEST_OPTS, async () => {
  const rpcResults = defaultRpcResults();
  rpcResults.gemini_circuit_check = { data: true }; // open for every model
  const { admin } = makeMockAdmin(rpcResults);
  const { calls: fetchCalls } = mockFetchSequence([okResponse()]);

  const res = await geminiFetchWithFallback(admin, "key", {}, CHAIN, true);

  assertEquals(res.status, 503);
  assertEquals(res.headers.get(GEMINI_FAILURE_REASON_HEADER), "all_circuits_open" as GeminiFailureReason);
  // Every model's circuit reported open on both the first pass AND the
  // retry pass this triggers -- fetch must never be called at all.
  assertEquals(fetchCalls.length, 0);
});

Deno.test("geminiFetchWithFallback - capacity failure on model 1, success on model 2: continues the chain within one pass, no retry needed", TEST_OPTS, async () => {
  const { admin, calls } = makeMockAdmin(defaultRpcResults());
  const { calls: fetchCalls } = mockFetchSequence([
    errResponse(503, '{"error":{"message":"overloaded"}}'),
    okResponse(),
  ]);

  const res = await geminiFetchWithFallback(admin, "key", {}, CHAIN, true);

  assertEquals(res.status, 200);
  assertEquals(fetchCalls.length, 2);
  assertEquals(calls.filter((c) => c.fn === "gemini_circuit_record_fail").length, 1);
  assertEquals(calls.filter((c) => c.fn === "gemini_circuit_record_success").length, 1);
});
