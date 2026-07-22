// Lightweight health check endpoint.
// Returns DB reachability, whether the server Gemini key is configured, live
// AI-capacity state (gemini_model_circuit), and today's Gemini spend-guard
// state. Responds 200 when healthy, 503 when degraded — safe to use as an
// uptime monitor target.
//
// 2026-07-22 (daily backend audit): the circuit breaker moved from
// per-isolate in-memory state to a shared Postgres table
// (gemini_model_circuit) back on 2026-07-04, which means — contrary to this
// file's old comment — it CAN be read from here now. Every prior incident
// review had to answer "is Gemini capacity actually exhausted right now?"
// with an ad hoc SQL query; this makes that visible for free to whatever
// already pings this endpoint (keep-warm.yml) or any future uptime monitor.
// A single open model is normal/expected fallback behavior, not
// degradation — the fallback chain exists precisely so one overloaded model
// doesn't take analysis down — so `status` only flips to "degraded" when
// EVERY fallback model is open at once (no AI capacity left at all) or the
// daily spend cap has been hit.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Mirrors _shared/gemini.ts's MODEL_FALLBACKS + DAILY_GEMINI_BUDGET_USD.
// Deliberately duplicated as local constants rather than importing the
// shared module — health is meant to stay a minimal, dependency-light
// endpoint, so a bug in _shared/gemini.ts can never take the health check
// itself down.
const GEMINI_FALLBACK_MODELS = ["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.5-flash-lite"];
const DAILY_BUDGET_USD = Number(Deno.env.get("DAILY_GEMINI_BUDGET_USD") ?? "5.00");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // DB ping — cheapest possible read.
  let db: "ok" | "error" = "ok";
  let dbLatencyMs: number | null = null;
  try {
    const t0 = Date.now();
    const { error } = await supabase.from("novel_analyses").select("id").limit(1);
    dbLatencyMs = Date.now() - t0;
    if (error) db = "error";
  } catch {
    db = "error";
  }

  const geminiKeyConfigured = !!Deno.env.get("GEMINI_API_KEY");

  // AI capacity: which fallback-chain models currently have an open circuit
  // (per gemini_model_circuit, the same table _shared/gemini.ts's
  // geminiFetchWithFallback checks before every call).
  let geminiModelsOpen: string[] = [];
  let circuitCheckOk = true;
  try {
    const { data, error } = await supabase
      .from("gemini_model_circuit")
      .select("model, open_until")
      .gt("open_until", new Date().toISOString());
    if (error) circuitCheckOk = false;
    else geminiModelsOpen = (data ?? []).map((r: { model: string }) => r.model);
  } catch {
    circuitCheckOk = false;
  }
  const allModelsOpen = circuitCheckOk && GEMINI_FALLBACK_MODELS.every((m) => geminiModelsOpen.includes(m));

  // Daily Gemini spend guard — same RPC + budget env var analyze-novel and
  // the other 4 AI functions check before every call (see
  // _shared/gemini.ts's attemptFallbackPass).
  let geminiBudgetExceeded = false;
  let budgetCheckOk = true;
  try {
    const { data, error } = await supabase.rpc("gemini_daily_budget_exceeded", { p_budget: DAILY_BUDGET_USD });
    if (error) budgetCheckOk = false;
    else geminiBudgetExceeded = !!data;
  } catch {
    budgetCheckOk = false;
  }

  const status = db === "ok" && !allModelsOpen && !geminiBudgetExceeded ? "ok" : "degraded";

  return new Response(
    JSON.stringify({
      status,
      db,
      db_latency_ms: dbLatencyMs,
      gemini_key_configured: geminiKeyConfigured,
      gemini_models_open: geminiModelsOpen,
      gemini_all_models_open: allModelsOpen,
      gemini_circuit_check_ok: circuitCheckOk,
      gemini_budget_exceeded: geminiBudgetExceeded,
      gemini_budget_check_ok: budgetCheckOk,
      ts: new Date().toISOString(),
    }),
    {
      status: status === "ok" ? 200 : 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
