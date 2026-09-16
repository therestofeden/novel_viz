// Regression tests for rate-limit.ts's raceRateLimitCount — the fail-open
// timeout wrapper around the count_recent_events RPC used by all 7
// rate-limited edge functions. Added 2026-09-16 daily backend audit. This
// helper only exists because a *hang* (not an error) in that RPC once added
// its full unbounded delay to every request on the hot path (see the
// module's own top-of-file comment) — the exact failure mode a mocked-slow
// promise here can reproduce deterministically, without needing a real
// flaky DB to trigger it.
//
// Run: deno test supabase/functions/_shared/
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { raceRateLimitCount } from "./rate-limit.ts";

function delay<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

Deno.test("raceRateLimitCount - returns the count on a fast, successful RPC", async () => {
  const rpc = Promise.resolve({ data: 3, error: null });
  assertEquals(await raceRateLimitCount(rpc, 800), 3);
});

Deno.test("raceRateLimitCount - returns 0 correctly (falsy-but-valid count)", async () => {
  // Regression guard: a naive `data || null` fallback anywhere in a caller
  // would misread a real "0 requests so far" as "check failed."
  const rpc = Promise.resolve({ data: 0, error: null });
  assertEquals(await raceRateLimitCount(rpc, 800), 0);
});

Deno.test("raceRateLimitCount - fails open (null) on an RPC error", async () => {
  const rpc = Promise.resolve({ data: null, error: { message: "connection reset" } });
  assertEquals(await raceRateLimitCount(rpc, 800), null);
});

Deno.test("raceRateLimitCount - fails open (null) when the RPC hangs past the timeout", async () => {
  const hangingRpc = delay(5000, { data: 7, error: null });
  const start = performance.now();
  const result = await raceRateLimitCount(hangingRpc, 50);
  const elapsed = performance.now() - start;
  assertEquals(result, null);
  // The whole point of this helper: the caller gets an answer at ~timeoutMs,
  // not at ~5000ms. Generous upper bound to avoid CI flakiness.
  if (elapsed > 2000) {
    throw new Error(`raceRateLimitCount took ${elapsed}ms — timeout race did not win`);
  }
});

Deno.test("raceRateLimitCount - fails open (null) if the RPC promise itself rejects", async () => {
  const rejecting = Promise.reject(new Error("network error"));
  assertEquals(await raceRateLimitCount(rejecting, 800), null);
});
