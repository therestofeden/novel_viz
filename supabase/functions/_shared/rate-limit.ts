// Shared timeout-safe wrapper for the count_recent_events rate-limit RPC.
//
// Added 2026-08-07 (daily backend audit). search-books had this exact RPC
// bounded against a hang as of v55 (2026-08-06, see project memory
// novelviz-infra) after live logs showed a slow/hung count_recent_events
// call (DB load spike, lock contention) adding its full, unbounded delay to
// every request. That fix was never propagated to the other 6 functions
// that call the identical RPC against the identical table — analyze-novel,
// takeaways, recommend-anti-shelf, recommend-by-dna, dna-consensus, and
// popular-books all still called it with a bare `await`, several of them
// on the hot path BEFORE the actual expensive work (a Gemini call or a DB
// scan) even starts. A hang here isn't caught by the existing try/catch
// wrappers either — those only fail open on an RPC *error*, not a stall.
//
// Extracted into one shared helper instead of copy-pasting the fix 6 more
// times slightly differently each time. Fails OPEN on both RPC error and
// timeout (returns null, which every call site already treats as "under
// limit" via `typeof count === "number"`) — a false negative here just
// means a very rare skipped rate-limit check, never a false 429 for a real
// user.
export async function raceRateLimitCount(
  rpcPromise: PromiseLike<{ data: number | null; error: unknown }>,
  timeoutMs = 800,
): Promise<number | null> {
  const countPromise = Promise.resolve(rpcPromise).then(({ data, error }) => {
    if (error) throw error;
    return data;
  });
  try {
    return await Promise.race([
      countPromise,
      new Promise<null>((resolve) => {
        const timer = setTimeout(() => resolve(null), timeoutMs);
        // @ts-ignore — Deno's setTimeout return type isn't a Node Timer
        if (timer?.unref) timer.unref();
      }),
    ]);
  } catch {
    return null;
  }
}
