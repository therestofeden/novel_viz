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

export const MODEL = "gemini-3.6-flash";
export const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

// Fallback chain — rebuilt 2026-08-05, every member now a STABLE (GA) model.
// The previous chain ([gemini-3-flash-preview, gemini-2.5-flash,
// gemini-2.5-flash-lite]) had rotted out underneath us:
//   - The primary never left preview status. Preview models get
//     capacity-deprioritized (observed live 2026-08-05 ~03:57 UTC: TCP-stall
//     timeouts on the preview primary plus 503 "high demand" on 2.5-flash-lite
//     produced a user-facing hard-ceiling failure) and Google retires them
//     without a sunset window (gemini-3-pro-preview is already gone).
//   - Both 2.5 fallbacks are flagged "deprecated, will be shut down soon" on
//     the official models page.
// gemini-3.5-flash stays deliberately EXCLUDED, as it has been since
// 2026-07-05 (the ~$0.30/~€1 cost incidents) — its $9/M output is the most
// expensive of the family. Note gemini-3.6-flash is actually CHEAPER per
// output token ($7.50/M) at the same $1.50/M input, and per-call cost is
// bounded anyway by MAX_OUTPUT_TOKENS + the daily budget guard below.
export const MODEL_FALLBACKS = [MODEL, "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];

// Per-1M-token pricing (USD), standard tier, as of 2026-08-05 — used to
// estimate real $ cost per call for the daily spend guard below. Update
// if Google changes pricing. Legacy models are kept so BYOK callers or a
// not-yet-redeployed function recording spend against an old model still
// log a real cost instead of $0.
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gemini-3.6-flash": { input: 1.50, output: 7.50 },
  "gemini-3.5-flash": { input: 1.50, output: 9.00 },
  "gemini-3.5-flash-lite": { input: 0.30, output: 2.50 },
  "gemini-3.1-flash-lite": { input: 0.25, output: 1.50 },
  // Legacy (previous chain, pre-2026-08-05):
  "gemini-3-flash-preview": { input: 0.50, output: 3.00 },
  "gemini-2.5-flash": { input: 0.30, output: 2.50 },
  "gemini-2.5-flash-lite": { input: 0.10, output: 0.40 },
};

export function estimateCostUsd(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0; // unknown model — don't block on a pricing gap, just log $0
  return (promptTokens / 1_000_000) * pricing.input + (completionTokens / 1_000_000) * pricing.output;
}

// ---------- Failure classification ----------
//
// Added 2026-07-25. Every caller of geminiFetchWithFallback used to build
// its user-facing error message from response.status alone, which collapses
// several structurally distinct failures — a depleted-billing 429, a
// genuine Gemini capacity 429, "every circuit is already open", the 45s
// hard time ceiling, a per-model TCP stall — into one guess. Concretely
// this meant a Google Cloud billing outage (real incident, 2026-07-25:
// "Your prepayment credits are depleted") showed users "The AI service is
// overloaded right now" for ~2.5 days straight, which is both wrong and
// non-actionable (nothing about "wait a minute" helps when the fix is
// "someone needs to top up the API key").
//
// Rather than reshape the Response body — several callers pass the raw
// Gemini error body straight through to the client, or don't parse it at
// all, so mutating it risks breaking that passthrough — the reason is
// carried as a response header. Every Response this module returns or
// synthesizes sets it, so callers can build an honest message with
// `response.headers.get(GEMINI_FAILURE_REASON_HEADER)` instead of
// re-guessing from the status code.
export const GEMINI_FAILURE_REASON_HEADER = "X-Gemini-Failure-Reason";

export type GeminiFailureReason =
  | "quota_exhausted"   // billing/prepay credits or API quota genuinely out — NOT transient
  | "daily_budget"      // our own DAILY_BUDGET_USD guard tripped
  | "all_circuits_open" // every fallback model's circuit was already open
  | "hard_ceiling"      // MAX_TOTAL_MS exceeded
  | "timeout"           // a model TCP-stalled past GEMINI_TIMEOUT_MS
  | "capacity"          // genuine transient Gemini 429/503
  | "model_unavailable" // model ID unknown/retired (404) — that ONE model, not the account
  | "auth_error"        // API key rejected (invalid/revoked/wrong key type) — NOT transient
  | "client_error";     // hard 4xx unrelated to quota (bad request, etc.)

// Matches Google's own wording for a depleted prepaid/billing balance
// ("Your prepayment credits are depleted...RESOURCE_EXHAUSTED") as well as
// the more general "quota exceeded" phrasing Gemini uses for hard quota
// limits — both are permanent-until-someone-acts, unlike a capacity 429.
const QUOTA_EXHAUSTION_PATTERN = /RESOURCE_EXHAUSTED|prepayment credits|quota.*exceed/i;

// Added 2026-09-04, ahead of Google's Sept-2026 "Standard" Gemini API key
// deprecation (all Standard keys stop authenticating sometime this month —
// see novelviz-gemini-standard-key-deprecation memory). Matches Google's own
// wording for a rejected/invalid/wrong-type key across both the native and
// OpenAI-compat error shapes: "API key not valid", "API_KEY_INVALID",
// "UNAUTHENTICATED", and PERMISSION_DENIED responses that mention the key
// itself. Without this, a rejected server key would misclassify as the
// generic "client_error" bucket — same bucket as a genuinely malformed
// request — which (a) gives users a confusing "bad request" style message
// for something that is entirely our fault, and (b) gives whoever is
// debugging no fast way to grep logs for "the key died" vs. "a request was
// malformed". A 401 is unambiguous on its own; a 403 needs the pattern match
// since Gemini also returns 403 for a handful of unrelated permission cases.
const AUTH_ERROR_PATTERN = /API_KEY_INVALID|UNAUTHENTICATED|API key not valid|API key expired|invalid.{0,20}api.{0,5}key|api.{0,5}key.{0,20}invalid/i;

export function classifyGeminiFailure(status: number, body: string): GeminiFailureReason {
  if (status === 429 && QUOTA_EXHAUSTION_PATTERN.test(body)) return "quota_exhausted";
  if (status === 401 || (status === 403 && AUTH_ERROR_PATTERN.test(body))) return "auth_error";
  if (status === 429 || status >= 500) return "capacity";
  // Gemini answers 404 NOT_FOUND for a model ID it no longer (or never)
  // serves. Distinguished from other hard 4xxs because the correct reaction
  // is opposite: a bad *request* would fail identically on every model
  // (abort the chain), a retired *model* is exactly what the fallback chain
  // exists to route around (skip it, keep going). Added 2026-08-05 while
  // replacing a chain whose every member was preview/deprecated — this is
  // what lets the app survive Google's NEXT model sunset without a
  // same-day emergency redeploy.
  if (status === 404) return "model_unavailable";
  return "client_error";
}

// Shared, honest user-facing copy for the reasons that are ambiguous-by-
// status (multiple distinct causes render as the same 429/503). Returns
// null for "capacity"/"client_error"/undefined so each of the 5 AI edge
// functions keeps its own existing status-based fallback wording for those
// — this only centralizes the cases that were previously being actively
// mislabeled, to avoid the 4 call sites drifting out of sync with each
// other (see the top-of-file note on why this file is consolidated at all).
export function describeGeminiFailure(reason: string | undefined): string | null {
  switch (reason as GeminiFailureReason | undefined) {
    case "quota_exhausted":
      return "The AI service's API quota has run out. We've been notified — please try again later, or add your own Gemini API key in settings.";
    case "auth_error":
      return "The AI service needs reconfiguration on our end — we've been notified. In the meantime, you can add your own Gemini API key in settings to keep going.";
    case "daily_budget":
      return "Daily AI budget reached — please try again tomorrow, or add your own Gemini API key in settings.";
    case "all_circuits_open":
    case "hard_ceiling":
      return "The AI service is temporarily unavailable after repeated errors. Please try again in a minute.";
    default:
      return null;
  }
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

// Hard DEFAULT ceiling on the ENTIRE geminiFetchWithFallback call (both
// passes, all models) — callers can override per call via the maxTotalMs
// parameter. RETRY_BUDGET_MS above only gates whether a retry pass is
// allowed to *start* — it does not bound how long that pass itself can run,
// so without this, two passes x 3 models x GEMINI_TIMEOUT_MS could take up
// to ~180s for a single call. This Promise.race guarantees a deterministic
// return within the ceiling regardless of what's still in flight underneath.
//
// Raised 45s → 90s on 2026-08-05: the old value was mathematically
// incoherent with the chain it guarded. A single hung model already eats
// GEMINI_TIMEOUT_MS (30s) of the budget, so hung-primary + slow-secondary
// meant a guaranteed user-facing hard_ceiling failure at 45s even when the
// third model was healthy and could have answered in 3s — observed live
// 2026-08-05 ~03:57 UTC (the failure that triggered this rebuild). 90s
// covers one full worst-case pass (3 × 30s), so the ceiling now only fires
// on genuinely pathological states instead of routinely amputating the
// fallback chain's whole reason to exist. Supabase's ~150s wall clock
// (confirmed live once: a 146s request killed with a 546) stays safe:
// analyze-novel, the only caller that can invoke this twice per request,
// passes maxTotalMs=40_000 for its rare inadequate-result retry
// (90 + 40 + non-AI overhead < 150).
const MAX_TOTAL_MS = 90_000;

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

// p_status/p_error are optional — added 2026-07-11 so the circuit table
// itself records WHY a model failed (last HTTP status + truncated error
// body), not just that it failed. Previously that info only existed in a
// console.error inside attemptFallbackPass, which get_logs doesn't
// reliably surface days later — three separate daily-audit sessions
// (2026-07-08 x2, 2026-07-11) hit the same dead end trying to tell whether
// an elevated fails count on a rarely-used fallback tier meant a real
// per-model problem or just a shared Gemini capacity blip. Now a direct
// read of gemini_model_circuit answers that in one query, no log-diving
// required.
async function circuitRecordFail(admin: SupabaseClient, model: string, status?: number, errorBody?: string): Promise<void> {
  try {
    const { error } = await admin.rpc("gemini_circuit_record_fail", {
      p_model: model,
      p_trip_after: CIRCUIT_TRIP_AFTER,
      p_open_ms: CIRCUIT_OPEN_MS,
      p_status: status ?? null,
      p_error: errorBody ?? null,
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
  isServerKey: boolean,
): Promise<Response | null> {
  let last: Response | null = null;
  for (const model of fallbackChain) {
    // The shared circuit table tracks the SERVER key's per-model health. A
    // BYOK caller's key belongs to a completely independent Google Cloud
    // project/quota — checking it against the server's circuit means a
    // server-side billing outage (see 2026-07-25/26/27) silently skips BYOK
    // attempts too, breaking the app's own recommended workaround for that
    // exact incident. So only consult/mutate the circuit for server-key calls.
    if (isServerKey && await circuitIsOpen(admin, model)) {
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
      console.warn(JSON.stringify({ circuit: "timeout", model, error: name, isServerKey }));
      if (isServerKey) await circuitRecordFail(admin, model, undefined, `timeout: ${name}`);
      const timeoutReason: GeminiFailureReason = "timeout";
      last = new Response(JSON.stringify({ error: `${model} timed out` }), {
        status: 503,
        headers: { "Content-Type": "application/json", [GEMINI_FAILURE_REASON_HEADER]: timeoutReason },
      });
      continue;
    }
    if (r.ok) {
      if (isServerKey) {
        await circuitRecordSuccess(admin, model);
        // Best-effort token/cost visibility — clone so the real caller's body
        // stream is completely untouched. Gemini's OpenAI-compat endpoint
        // returns a `usage` block on every successful response; logging it
        // here covers all 5 functions in one place instead of nowhere, which
        // is what made a $0.23 single-analysis bill impossible to diagnose.
        // Only recorded for server-key calls — a BYOK user's usage is billed
        // to their own Google account, not ours, so it must not count toward
        // our own gemini_daily_spend/DAILY_BUDGET_USD ceiling.
        try {
          const usage = (await r.clone().json())?.usage;
          recordGeminiSpend(admin, model, usage).catch(() => {});
        } catch {
          // Logging only — never let a parse issue affect the real response.
        }
      }
      return r;
    }
    // Log ALL errors — critical for diagnosing what Gemini is actually returning.
    const errBody = await r.clone().text().catch(() => "");
    const reason = classifyGeminiFailure(r.status, errBody);
    console.error(JSON.stringify({ fn: "geminiFetch", model, status: r.status, reason, body: errBody.slice(0, 400), isServerKey }));
    await r.body?.cancel().catch(() => {});
    last = new Response(errBody || JSON.stringify({ error: `${model} returned ${r.status}` }), {
      status: r.status,
      headers: { "Content-Type": "application/json", [GEMINI_FAILURE_REASON_HEADER]: reason },
    });
    if (reason === "quota_exhausted") {
      // Billing/quota is a property of the API key's project, not of any one
      // model — all models in the chain share it, so they'd fail identically.
      // Record the failure (so the circuit table shows why) but stop here
      // instead of burning the rest of the fallback chain on guaranteed
      // failures. This is the single biggest win from this classification:
      // a billing outage used to cost 3 doomed calls per pass here alone.
      // A BYOK key hitting its OWN quota exhaustion still shouldn't trip the
      // SHARED server circuit (that would incorrectly punish server-key
      // users for an unrelated user's personal billing problem) — but it's
      // still correct to stop the chain early for that one BYOK request,
      // since all 3 models share the same BYOK project quota too.
      if (isServerKey) await circuitRecordFail(admin, model, r.status, errBody);
      return last;
    }
    if (reason === "auth_error") {
      // The key itself is rejected — every model in the chain shares one key,
      // so trying model 2/3 would just be 2 more guaranteed-failing round
      // trips (same waste this classification already avoids for
      // quota_exhausted). Distinctive "ALERT" tag on top of the normal error
      // log so this is grep-able/alertable separately from a routine
      // malformed-request 4xx — see the type's doc comment for why this
      // exists now (Sept-2026 Standard-key deprecation).
      console.error(JSON.stringify({ fn: "geminiFetch", alert: "GEMINI_AUTH_ERROR", detail: "server API key rejected — likely invalid/revoked/wrong key type, needs a human to rotate it in Supabase secrets", model, status: r.status, isServerKey }));
      if (isServerKey) await circuitRecordFail(admin, model, r.status, errBody);
      return last;
    }
    if (reason === "model_unavailable") {
      // Retired/unknown model — skip to the next model instead of aborting
      // the whole chain the way other hard 4xxs (correctly) do. Trip the
      // circuit too: after CIRCUIT_TRIP_AFTER repeats the dead model stops
      // costing a doomed round trip on every request, and if Google ever
      // brings the ID back, the circuit's normal expiry re-admits it.
      if (isServerKey) await circuitRecordFail(admin, model, r.status, errBody);
      continue;
    }
    if (r.status === 429 || r.status >= 500) {
      // Transient — trip circuit (if threshold reached) and try the next model.
      if (isServerKey) await circuitRecordFail(admin, model, r.status, errBody);
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
 *
 * `isServerKey` (default true) tells this function whether `apiKey` is the
 * app's own shared server key or a user-supplied BYOK key. When false, the
 * shared DB-backed circuit breaker, the daily $ budget gate, and spend
 * recording are all bypassed entirely — a BYOK key draws on a totally
 * independent Google Cloud project/quota, so it must neither be blocked by
 * the server key's circuit/budget state, nor be allowed to trip either of
 * those on behalf of unrelated server-key users. Found + fixed 2026-07-28:
 * during the ongoing server-key quota outage (since 2026-07-22), BYOK
 * requests — the app's own advertised workaround for exactly this incident —
 * were being silently skipped by the open server circuit and/or blocked by
 * the daily-budget guard, even though a working personal key would have
 * succeeded fine. Every existing call site defaults to true (unchanged
 * behavior) unless it explicitly resolves a user-supplied key.
 */
export async function geminiFetchWithFallback(
  admin: SupabaseClient,
  apiKey: string,
  payload: Record<string, unknown>,
  fallbackChain: string[] = MODEL_FALLBACKS,
  isServerKey: boolean = true,
  maxTotalMs: number = MAX_TOTAL_MS,
): Promise<Response> {
  const work = (async (): Promise<Response> => {
    const budgetExceeded = isServerKey && await admin.rpc("gemini_daily_budget_exceeded", { p_budget: DAILY_BUDGET_USD })
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
      const dailyBudgetReason: GeminiFailureReason = "daily_budget";
      return new Response(
        JSON.stringify({ error: "Daily AI budget reached — please try again tomorrow, or add your own Gemini API key in settings." }),
        { status: 503, headers: { "Content-Type": "application/json", [GEMINI_FAILURE_REASON_HEADER]: dailyBudgetReason } },
      );
    }

    const start = Date.now();
    const first = await attemptFallbackPass(admin, apiKey, payload, fallbackChain, isServerKey);
    const firstReason = first?.headers.get(GEMINI_FAILURE_REASON_HEADER);

    // Don't retry a quota-exhaustion failure — the whole point of that
    // classification is that it's not transient, so a second pass after a
    // 1.5s backoff would just be another guaranteed-failing round trip.
    const exhausted = !first || ((first.status === 429 || first.status === 503) && firstReason !== "quota_exhausted");
    if (exhausted && Date.now() - start < RETRY_BUDGET_MS) {
      console.log(JSON.stringify({ circuit: "retry_after_exhaustion", elapsed_ms: Date.now() - start }));
      await sleep(RETRY_BACKOFF_MS);
      const second = await attemptFallbackPass(admin, apiKey, payload, fallbackChain, isServerKey);
      if (second) return second;
    }

    if (first) return first;

    // Every model's circuit was already open — no fetch was even attempted.
    console.error(JSON.stringify({ fn: "geminiFetch", error: "all_circuits_open" }));
    const allOpenReason: GeminiFailureReason = "all_circuits_open";
    return new Response(
      JSON.stringify({ error: "All model circuits are open — try again shortly." }),
      { status: 503, headers: { "Content-Type": "application/json", [GEMINI_FAILURE_REASON_HEADER]: allOpenReason } },
    );
  })();

  const timeout = new Promise<Response>((resolve) => {
    setTimeout(() => {
      console.error(JSON.stringify({ fn: "geminiFetch", error: "hard_ceiling_exceeded", max_total_ms: maxTotalMs }));
      const hardCeilingReason: GeminiFailureReason = "hard_ceiling";
      resolve(new Response(
        JSON.stringify({ error: "Gemini fallback chain exceeded its time budget — please try again." }),
        { status: 503, headers: { "Content-Type": "application/json", [GEMINI_FAILURE_REASON_HEADER]: hardCeilingReason } },
      ));
    }, maxTotalMs);
  });

  return Promise.race([work, timeout]);
}
