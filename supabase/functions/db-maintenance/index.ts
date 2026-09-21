// db-maintenance — nightly cleanup job.
//
// Runs the purge RPCs (search_cache, rate_limit_events, novel_analyses, and as
// of 2026-07-16 three more) that were previously only invoked opportunistically
// (1% of requests) from inside search-books. That's unreliable — a heavily-cached
// table could go weeks without a purge. This function gives GitHub Actions
// (which already runs keep-warm.yml every 5 minutes, see .github/workflows/)
// something to call on a nightly schedule instead, working around the fact that
// pg_cron is not available on this project's Supabase plan tier.
//
// 2026-07-15: added purge_cold_novel_analyses. It was defined back in the
// 005_search_cache_pinned_chars_purge_helpers migration but never actually
// wired into this job — novel_analyses (the largest cache table, hit_count +
// last_accessed_at columns exist for exactly this purpose) has been growing
// unbounded ever since. Same 90-day/hit_count<2 cold-row definition as the
// function itself; safe to run nightly alongside the other two.
//
// 2026-07-16 (daily backend agent): two changes.
// (1) purge_cold_novel_analyses now excludes rows that have a book_dna_consensus
//     row attached (FK is ON DELETE CASCADE) — a novel_analyses row going "cold"
//     by its own hit_count no longer silently destroys crowd-sourced DNA consensus
//     votes that may still be actively useful independent of raw-cache hit rate.
// (2) Added the three other AI-cost caches (dna_recommendation_cache,
//     shelf_recommendations, takeaway_questions_cache) that had hit_count/
//     last_accessed_at columns suggesting the same LRU-purge pattern was
//     intended, but had no purge function defined at all — flagged as a known
//     follow-up in the 2026-07-15 audit. book_dna_consensus itself is
//     deliberately NOT purged here — it's persistent crowd-consensus product
//     data (no hit_count/last_accessed_at columns at all), not a pure cache.
//
// Trigger manually:
//   curl -X POST https://ecsublyvcvzdkvggxwlh.supabase.co/functions/v1/db-maintenance \
//     -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
//     -H "x-maintenance-secret: <MAINTENANCE_SECRET>" \
//     -H "Content-Type: application/json"
//
// Required Supabase secret: MAINTENANCE_SECRET (any random string you choose —
// set it in Supabase Dashboard → Project Settings → Edge Functions → Secrets,
// then add the same value as a GitHub repo secret of the same name so
// nightly-maintenance.yml can send it).
//
// 2026-09-21 (daily backend audit): all six `runPurge` calls below were bare
// `await supabase.rpc(...)` with no ceiling — the same "everything else has a
// timeout, what doesn't?" gap 09-19 found and fixed in health/index.ts, missed
// here because this file predates that sweep (last touched 07-16). It matters
// more here than it did in health: these aren't cheap `SELECT ... LIMIT 1`
// reads, they're unindexed-scan DELETEs against potentially large tables (see
// 07-15's note above: novel_analyses is this app's largest cache table) that
// can legitimately take a while or hit lock contention — and the six calls
// run strictly sequentially, so one stalled RPC doesn't just delay its own
// purge, it silently blocks every purge after it in the same run. Worse,
// nightly-maintenance.yml's own `timeout-minutes: 2` would then kill the
// whole job from the outside with no response ever returned — losing
// visibility into which of the six purges (if any) actually succeeded before
// the hang, not just the one that stalled. Added a local `withTimeout`
// (dependency-light, same "kept local not imported" rationale health used —
// this endpoint's only job is running these six purges reliably, so a bug in
// a shared helper should never be able to take it down) at 15s/call: six
// calls at 15s worst-case is 90s, comfortably under the workflow's 120s job
// timeout with margin for network/cold-start overhead, while still generous
// for a full-table conditional DELETE under normal conditions. A timed-out
// call now reports the same `"error: ..."` shape runPurge's existing catch
// block already produces for a real RPC failure — callers/logs don't need a
// new case, and the remaining purges still run instead of the whole function
// hanging indefinitely.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { secretsMatch } from "../_shared/secret-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-maintenance-secret",
};

const PURGE_RPC_TIMEOUT_MS = 15_000;

// Races `promise` against a timeout; on timeout, resolves to `fallback`
// instead of leaving the caller hanging forever. Same pattern as
// health/index.ts's own local `withTimeout` (09-19) and
// _shared/rate-limit.ts's `raceRateLimitCount` (08-07).
async function withTimeout<T>(promise: PromiseLike<T>, fallback: T, timeoutMs = PURGE_RPC_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), timeoutMs);
        // (no @ts-ignore needed here, unlike some of this codebase's other
        // copies of this helper — `deno check` and eslint are both clean on
        // this line as written; see 2026-09-21 audit for why.)
        if (timer?.unref) timer.unref();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Require a shared secret to prevent randoms from triggering DB deletes.
  // Same pattern as seed-cache's x-seed-secret. Constant-time compare — see
  // _shared/secret-auth.ts for why plain === is a timing side-channel here.
  const secret = req.headers.get("x-maintenance-secret") ?? "";
  const expectedSecret = Deno.env.get("MAINTENANCE_SECRET") ?? "";
  const authorized = secretsMatch(secret, expectedSecret);
  if (!authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const results: Record<string, number | string> = {};

  const runPurge = async (key: string, rpcName: string) => {
    try {
      const { data, error } = await withTimeout<{ data: number | null; error: { message: string } | null }>(
        Promise.resolve(supabase.rpc(rpcName)).then(({ data, error }) => ({ data, error })),
        { data: null, error: { message: `${rpcName} timed out after ${PURGE_RPC_TIMEOUT_MS}ms` } },
      );
      results[key] = error ? `error: ${error.message}` : (data ?? 0);
    } catch (e) {
      results[key] = `error: ${String(e)}`;
    }
  };

  await runPurge("search_cache_deleted", "purge_old_search_cache");
  await runPurge("rate_limit_events_deleted", "purge_old_rate_limit_events");
  await runPurge("novel_analyses_deleted", "purge_cold_novel_analyses");
  await runPurge("dna_recommendation_cache_deleted", "purge_cold_dna_recommendation_cache");
  await runPurge("takeaway_questions_cache_deleted", "purge_cold_takeaway_questions_cache");
  await runPurge("shelf_recommendations_deleted", "purge_cold_shelf_recommendations");

  console.log(JSON.stringify({ fn: "db-maintenance", ...results }));

  return new Response(JSON.stringify({ ok: true, ...results, ranAt: new Date().toISOString() }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
