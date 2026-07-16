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

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-maintenance-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Require a shared secret to prevent randoms from triggering DB deletes.
  // Same pattern as seed-cache's x-seed-secret.
  const secret = req.headers.get("x-maintenance-secret") ?? "";
  const expectedSecret = Deno.env.get("MAINTENANCE_SECRET") ?? "";
  const authorized = expectedSecret.length > 0 && secret === expectedSecret;
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
      const { data, error } = await supabase.rpc(rpcName);
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
