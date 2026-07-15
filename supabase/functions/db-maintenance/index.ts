// db-maintenance — nightly cleanup job.
//
// Runs the purge RPCs (search_cache, rate_limit_events, novel_analyses) that
// were previously only invoked opportunistically (1% of requests) from inside
// search-books. That's unreliable — a heavily-cached table could go weeks
// without a purge. This function gives GitHub Actions (which already runs
// keep-warm.yml every 5 minutes, see .github/workflows/) something to call
// on a nightly schedule instead, working around the fact that pg_cron is
// not available on this project's Supabase plan tier.
//
// 2026-07-15: added purge_cold_novel_analyses. It was defined back in the
// 005_search_cache_pinned_chars_purge_helpers migration but never actually
// wired into this job — novel_analyses (the largest cache table, hit_count +
// last_accessed_at columns exist for exactly this purpose) has been growing
// unbounded ever since. Same 90-day/hit_count<2 cold-row definition as the
// function itself; safe to run nightly alongside the other two.
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

  try {
    const { data, error } = await supabase.rpc("purge_old_search_cache");
    results.search_cache_deleted = error ? `error: ${error.message}` : (data ?? 0);
  } catch (e) {
    results.search_cache_deleted = `error: ${String(e)}`;
  }

  try {
    const { data, error } = await supabase.rpc("purge_old_rate_limit_events");
    results.rate_limit_events_deleted = error ? `error: ${error.message}` : (data ?? 0);
  } catch (e) {
    results.rate_limit_events_deleted = `error: ${String(e)}`;
  }

  try {
    const { data, error } = await supabase.rpc("purge_cold_novel_analyses");
    results.novel_analyses_deleted = error ? `error: ${error.message}` : (data ?? 0);
  } catch (e) {
    results.novel_analyses_deleted = `error: ${String(e)}`;
  }

  console.log(JSON.stringify({ fn: "db-maintenance", ...results }));

  return new Response(JSON.stringify({ ok: true, ...results, ranAt: new Date().toISOString() }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
