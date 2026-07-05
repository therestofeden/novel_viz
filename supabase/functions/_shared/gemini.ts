// Shared Gemini fetch-with-fallback + circuit breaker, used by all 5 AI edge
// functions (analyze-novel, takeaways, recommend-anti-shelf, recommend-by-dna,
// dna-consensus).
//
// Consolidated 2026-07-04. Previously each function carried its own
// hand-copied version of this block (~80 lines). That drift is exactly how
// the 2026-07-01 "retry on transient failure" improvement landed only in
// analyze-novel's frontend and never propagated to the other four — one of
// the reasons users still saw "AI is rate-limited" bursts elsewhere. Two
// behavioral changes over the old per-function versions:
//
// 1. The circuit breaker is now backed by a Postgres table
//    (gemini_model_circuit, via the gemini_circuit_* RPCs) instead of a
//    per-isolate in-memory Map. Supabase runs multiple concurrent isolates,
//    so the old in-memory version meant every isolate had to independently
//    "discover" an overloaded model and eat its own 2 failures before
//    learning to skip it. Now the moment ANY concurrent request trips the
//    circuit, every other one benefits immediately.
// 2. If a full pass through the fallback chain is exhausted (every model
//    429/503/timed out), retry the whole pass once more after a short delay
//    — production logs show most Gemini overload bursts resolve within a
//    few seconds. Bounded by RETRY_BUDGET_MS so a pathological all-hang first
//    pass (up to ~90s) naturally skips the second pass rather than risking
//    Supabase's ~150s wall-clock function limit.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export const MODEL = "gemini-3-flash-preview";
export const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

// Fallback chain: newest → older versions (last resort for 503/429 surges).
// gemini-1.5-flash and gemini-2.0-flash are both shut down (June 2026).
// gemini-2.5-flash and gemini-2.5-flash-lite are deprecated but active until Oct 2026.
// gemini-3.5-flash was deliberately REMOVED from this default chain on
// 2026-07-05 — it was the direct cause of both the ~$0.30 and ~€1 cost
// incidents (unbounded reasoning-token billing at $9/M output). It still
// works and remains in MODEL_PRICING below; it can be reintroduced later as
// an opt-in premium tier, but is not part of the default fallback chain now.
export const MODEL_FALLBACKS = [MODEL, "gemini-2.5-flash", "gemini-2.5-flash-lite"];

// Per-1M-token pricing (USD), standard tier, as of 2026-07-05 — used to
// estimate real $ cost per call for the daily spend guard below. Update
// if Google changes pricing.
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gemini-3.5-flash": { input: 1.50, output: 9.00 },
  "gemini-3-flash-preview": { input: 0.50, output: 3.00 },
  "gemini-2.5-flash": { input: 0.30, output: 2.50 },
  "gemini-2.5-flash-lite": { input: 0.10, output: 0.40 },
};

export function estimateCostUsd(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0; // unknown model — don't block on a pricing gap, just log $0
  return (promptTokens / 1_000_000) * pricing.input + (completionTokens / 1_000_000) * pricing.output;
}

// Shared usage-logging + spend-recording, extracted so callers OUTSIDE
// geminiFetchWithFallback (analyze-novel's callPreview/preamble bypass calls
// — see their own file for why they bypass the fallback machinery) can still
// feed the same gemini_daily_spend total. Those two calls were previously
// invisible to the daily budget circuit breaker entirely: real spend from
// them happened but was never recorded, so the "hard $/day ceiling" wasn't
// actually a ceiling on total spend, just on the structured-analysis portion
// of it. Fire-and-forget by design (never block the caller's response on this).
export async function recordGeminiSpend(
  admin: SupabaseClient,
  model: string,
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined,
): Promise<void> {
  if (!usage) return;
  console.log(JSON.stringify({
    fn: "geminiUsage",
    model,
    prompt_tokens: usage.prompt_tokens,
    completion_tokens: usage.completion_tokens,
    total_tokens: usage.total_tokens,
  }));
  const cost = estimateCostUsd(model, usage.prompt_tokens ?? 0, usage.completion_tokens ?? 0);
  if (cost > 0) {
    const { error } = await admin.rpc("gemini_record_spend", { p_cost: cost });
    if (error) console.warn(JSON.stringify({ spend: "record_error", error: error.message }));
  }
}

// ---------- Circuit breaker tuning ----------
const CIRCUIT_OPEN_MS = 30_000;
const CIRCUIT_TRIP_AFTER = 2;
// Max wait for Gemini to return the first byte of its HTTP response. Protects
// against TCP-stall hangs where the socket is accepted but no response bytes
// arrive — the circuit breaker alone can't handle this since it only fires on
// HTTP-level errors, not network-level timeouts.
const GEMINI_TIMEOUT_MS = 30_000;
const RETRY_BACKOFF_MS = 1_500;
const RETRY_BUDGET_MS = 45_000;

// Hard ceiling on the ENTIRE geminiFetchWithFallback call (both passes,
// all models). RETRY_BUDGET_MS above only gates whether a retry pass is
// allowed to *start* — it does not bound how long that pass itself can run,
// so without this, two passes x 3 models x GEMINI_TIMEOUT_MS could take up
// to ~180s for a single call. Callers like analyze-novel invoke this
// function up to twice per request (initial + inadequate-result retry), so
// an unbounded call risked exceeding Supabase's ~150s wall-clock function
// limit — confirmed live: a real request hung 146s and was killed with a
// 546 status. This Promise.race guarantees a deterministic return within
// MAX_TOTAL_MS regardless of what's still in flight underneath.
const MAX_TOTAL_MS = 45_000;

// Hard per-call output/thinking cap — tuned 2026-07-05 as a follow-up to the
// original $0.30/€1 cost-incident fix. Real production data from that fix's
// live verification showed a full analysis used only ~3000 output tokens —
// well under the old 8000 cap — so the previous "low"/8000 combo wasn't
// actually buying us truncation-avoidance; it was mostly just capping
// thinking depth tighter than necessary. reasoning_effort:"low" holds the
// thinking budget to ~1K tokens, which is BELOW Gemini's own default of
// "medium" (~8K tokens) and well below some models' own default of "high"
// (e.g. gemini-3-flash-preview) — plausibly making complex/dense book
// analysis shallower than it should be. Since the daily spend circuit
// breaker below is now a proven, independent hard backstop (verified live),
// we can afford to prioritize analysis quality/completeness here instead of
// maximum per-call stinginess:
//   - REASONING_EFFORT: "medium" restores Gemini's own default thinking
//     depth (real reasoning room for complex books), while still being an
//     EXPLICIT cap rather than relying on whatever a given model's silent
//     default happens to be (defaults vary by model).
//   - MAX_OUTPUT_TOKENS: 12000 gives headroom so a "medium" thinking pass
//     plus a full rich completion doesn't risk truncating the JSON
//     mid-schema, while still being a small fraction of the model's actual
//     65k max.
// New worst-case ceiling: 12000/1e6 * output-price-of-whatever-model-is-active
// (e.g. $3.00/M for gemini-3-flash-preview => $0.036/call worst case).
const MAX_OUTPUT_TOKENS = 12000;
const REASONING_EFFORT = "medium";

// Hard daily $ ceiling, independent of the per-call cap above — a second,
// separate line of defense in case the per-call cap has a gap we haven't
// found. Conservative default for this MVP/testing phase; raise via the
// DAILY_GEMINI_BUDGET_USD env secret once real usage data justifies it.
const DAILY_BUDGET_USD = Number(Deno.env.get("DAILY_GEMINI_BUDGET_USD") ?? "5.00");

async function circuitIsOpen(admin: SupabaseClient, model: string): Promise<boolean> {
  try {
    const { data, error } = await admin.rpc("gemini_circuit_check", { p_model: model });
    if (error) {
      console.warn(JSON.stringify({ circuit: "check_error_fail_open", model, error: error.message }));
      return false;
    }
    return !!data;
  } catch (e) {
    console.warn(JSON.stringify({ circuit: "check_exception_fail_open", model, error: String(e) }));
    return false;
  }
}

async function circuitRecordFail(admin: SupabaseClient, model: string): Promise<void> {
  try {
    const { error } = await admin.rpc("gemini_circuit_record_fail", {
      p_model: model,
      p_trip_after: CIRCUIT_TRIP_AFTER,
      p_open_ms: CIRCUIT_OPEN_MS,
    });
    if (error) console.warn(JSON.stringify({ circuit: "record_fail_error", model, error: error.message }));
  } catch (e) {
    console.warn(JSON.stringify({ circuit: "record_fail_exception", model, error: String(e) }));
  }
}

async function circuitRecordSuccess(admin: SupabaseClient, model: string): Promise<void> {
  try {
    const { error } = await admin.rpc("gemini_circuit_record_success", { p_model: model });
    if (error) console.warn(JSON.stringify({ circuit: "record_success_error", model, error: error.message }));
  } catch (e) {
    console.warn(JSON.stringify({ circuit: "record_success_exception", model, error: String(e) }));
  }
}

async function attemptFallbackPass(
  admin: SupabaseClient,
  apiKey: string,
  payload: Record<string, unknown>,
  fallbackChain: string[],
): Promise<Response | null> {
  let last: Response | null = null;
  for (const model of fallbackChain) {
    if (await circuitIsOpen(admin, model)) {
      console.log(JSON.stringify({ circuit: "skipped", model }));
      continue;
    }
    let r: Response;
    try {
      r = await fetch(GEMINI_BASE, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ max_tokens: MAX_OUTPUT_TOKENS, reasoning_effort: REASONING_EFFORT, ...payload, model }),
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      });
    } catch (e) {
      // Network stall or timeout — treat like a transient 503, trip circuit, try next model.
      const name = e instanceof Error ? e.name : String(e);
      console.warn(JSON.stringify({ circuit: "timeout", model, error: name }));
      await circuitRecordFail(admin, model);
      last = new Response(JSON.stringify({ error: `${model} timed out` }), { status: 503 });
      continue;
    }
    if (r.ok) {
      await circuitRecordSuccess(admin, model);
      // Best-effort token/cost visibility — clone so the real caller's body
      // stream is completely untouched. Gemini's OpenAI-compat endpoint
      // returns a `usage` block on every successful response; logging it
      // here covers all 5 functions in one place instead of nowhere, which
      // is what made a $0.23 single-analysis bill impossible to diagnose.
      try {
        const usage = (await r.clone().json())?.usage;
        recordGeminiSpend(admin, model, usage).catch(() => {});
      } catch {
        // Logging only — never let a parse issue affect the real response.
      }
      return r;
    }
    // Log ALL errors — critical for diagnosing what Gemini is actually returning.
    const errBody = await r.clone().text().catch(() => "");
    console.error(JSON.stringify({ fn: "geminiFetch", model, status: r.status, body: errBody.slice(0, 400) }));
    await r.body?.cancel().catch(() => {});
    last = new Response(errBody || JSON.stringify({ error: `${model} returned ${r.status}` }), {
      status: r.status,
      headers: { "Content-Type": "application/json" },
    });
    if (r.status === 429 || r.status >= 500) {
      // Transient — trip circuit (if threshold reached) and try the next model.
      await circuitRecordFail(admin, model);
    } else {
      // Hard 4xx client error — not transient, don't trip the circuit, don't
      // bother trying other models (a bad request will fail on all of them).
      return last;
    }
  }
  return last;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calls Gemini with model fallback + a shared, DB-backed circuit breaker.
 * If every model in the fallback chain fails transiently (429/503/timeout),
 * retries the whole pass once more after a short delay, bounded by
 * RETRY_BUDGET_MS so this can never meaningfully risk the edge function's
 * wall-clock limit.
 *
 * The whole call is additionally wrapped in a hard MAX_TOTAL_MS ceiling via
 * Promise.race: RETRY_BUDGET_MS only gates whether a second pass is allowed
 * to *start*, it doesn't bound how long that pass takes once started, so
 * without this outer ceiling two passes x 3 models x GEMINI_TIMEOUT_MS could
 * take up to ~180s — well past Supabase's ~150s function limit. If the
 * ceiling is hit, this returns a clean 503 while the underlying fetch(es)
 * keep running in the background and still record circuit-breaker outcomes
 * normally; we're only bounding how long the FUNCTION takes to respond.
 *
 * Accepts an optional custom fallbackChain (used by analyze-novel's
 * inadequate-result retry to avoid re-paying for the expensive primary model
 * on a second attempt).
 *
 * Every request also carries a hard MAX_OUTPUT_TOKENS / REASONING_EFFORT cap
 * (see constants above) — this bounds worst-case per-call output/thinking
 * cost, which was previously unbounded and caused two real cost incidents
 * (~$0.30 and ~€1 in a single call) on gemini-3.5-flash. Before any attempt
 * is made, a daily budget pre-flight check (gemini_daily_budget_exceeded RPC)
 * short-circuits with a clean 503 if today's cumulative estimated spend has
 * already hit DAILY_BUDGET_USD — an independent second line of defense. On
 * every successful call, estimated cost is recorded via the
 * gemini_record_spend RPC (fire-and-forget, not on the hot path).
 */
export async function geminiFetchWithFallback(
  admin: SupabaseClient,
  apiKey: string,
  payload: Record<string, unknown>,
  fallbackChain: string[] = MODEL_FALLBACKS,
): Promise<Response> {
  const work = (async (): Promise<Response> => {
    const budgetExceeded = await admin.rpc("gemini_daily_budget_exceeded", { p_budget: DAILY_BUDGET_USD })
      .then(({ data, error }) => {
        if (error) {
          console.warn(JSON.stringify({ spend: "budget_check_error_fail_open", error: error.message }));
          return false; // fail open — don't block real users on a DB hiccup
        }
        return !!data;
      })
      .catch((e) => {
        console.warn(JSON.stringify({ spend: "budget_check_exception_fail_open", error: String(e) }));
        return false;
      });

    if (budgetExceeded) {
      console.error(JSON.stringify({ spend: "daily_budget_exceeded", budget: DAILY_BUDGET_USD }));
      return new Response(
        JSON.stringify({ error: "Daily AI budget reached — please try again tomorrow, or add your own Gemini API key in settings." }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    const start = Date.now();
    const first = await attemptFallbackPass(admin, apiKey, payload, fallbackChain);

    const exhausted = !first || first.status === 429 || first.status === 503;
    if (exhausted && Date.now() - start < RETRY_BUDGET_MS) {
      console.log(JSON.stringify({ circuit: "retry_after_exhaustion", elapsed_ms: Date.now() - start }));
      await sleep(RETRY_BACKOFF_MS);
      const second = await attemptFallbackPass(admin, apiKey, payload, fallbackChain);
      if (second) return second;
    }

    if (first) return first;

    // Every model's circuit was already open — no fetch was even attempted.
    console.error(JSON.stringify({ fn: "geminiFetch", error: "all_circuits_open" }));
    return new Response(
      JSON.stringify({ error: "All model circuits are open — try again shortly." }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  })();

  const timeout = new Promise<Response>((resolve) => {
    setTimeout(() => {
      console.error(JSON.stringify({ fn: "geminiFetch", error: "hard_ceiling_exceeded", max_total_ms: MAX_TOTAL_MS }));
      resolve(new Response(
        JSON.stringify({ error: "Gemini fallback chain exceeded its time budget — please try again." }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      ));
    }, MAX_TOTAL_MS);
  });

  return Promise.race([work, timeout]);
}
