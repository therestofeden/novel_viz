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

export const MODEL = "gemini-3.5-flash";
export const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

// Fallback chain: newest → older versions (last resort for 503/429 surges).
// gemini-1.5-flash and gemini-2.0-flash are both shut down (June 2026).
// gemini-2.5-flash and gemini-2.5-flash-lite are deprecated but active until Oct 2026.
export const MODEL_FALLBACKS = [MODEL, "gemini-2.5-flash", "gemini-2.5-flash-lite"];

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
): Promise<Response | null> {
  let last: Response | null = null;
  for (const model of MODEL_FALLBACKS) {
    if (await circuitIsOpen(admin, model)) {
      console.log(JSON.stringify({ circuit: "skipped", model }));
      continue;
    }
    let r: Response;
    try {
      r = await fetch(GEMINI_BASE, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, model }),
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
 */
export async function geminiFetchWithFallback(
  admin: SupabaseClient,
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<Response> {
  const start = Date.now();
  const first = await attemptFallbackPass(admin, apiKey, payload);

  const exhausted = !first || first.status === 429 || first.status === 503;
  if (exhausted && Date.now() - start < RETRY_BUDGET_MS) {
    console.log(JSON.stringify({ circuit: "retry_after_exhaustion", elapsed_ms: Date.now() - start }));
    await sleep(RETRY_BACKOFF_MS);
    const second = await attemptFallbackPass(admin, apiKey, payload);
    if (second) return second;
  }

  if (first) return first;

  // Every model's circuit was already open — no fetch was even attempted.
  console.error(JSON.stringify({ fn: "geminiFetch", error: "all_circuits_open" }));
  return new Response(
    JSON.stringify({ error: "All model circuits are open — try again shortly." }),
    { status: 503, headers: { "Content-Type": "application/json" } },
  );
}
