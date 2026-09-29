-- Closes a real monitoring blind spot found during the 2026-09-29
-- daily_backend audit, in the same shared circuit-breaker machinery the
-- 2026-07-25 quota-exhaustion incident already touched.
--
-- The problem: attemptFallbackPass (supabase/functions/_shared/gemini.ts)
-- walks the model fallback chain [gemini-3.6-flash, gemini-3.5-flash-lite,
-- gemini-3.1-flash-lite] one model at a time, calling
-- gemini_circuit_record_fail for whichever model it just tried. But for the
-- two ACCOUNT-LEVEL failure reasons -- quota_exhausted (billing/quota
-- depleted) and auth_error (the server API key itself rejected) -- the loop
-- deliberately `return`s immediately after the FIRST model, by design (an
-- account-wide failure will fail identically on every model, so trying the
-- other two would just be two more guaranteed-failing round trips -- see
-- gemini.ts's own comments on both branches). That means models #2 and #3
-- NEVER get a row written to gemini_model_circuit during exactly this
-- failure mode -- they're not "closed", they're simply never touched.
--
-- health/index.ts's `gemini_all_models_open` degraded-signal requires EVERY
-- model in the fallback chain to show an open circuit. During a real
-- account-level outage, 2 of 3 models can never satisfy that (they have no
-- row at all), so `gemini_all_models_open` stays false and health keeps
-- reporting "ok" (200) for the ENTIRE duration of an outage that is, in
-- fact, total -- 100% of real Gemini calls failing. This is not
-- hypothetical: it is the exact same failure class as the documented
-- 2026-07-25 billing outage ("Your prepayment credits are depleted"), which
-- ran undetected by any automated signal for ~2.5 days because nothing was
-- watching for it directly -- only a human happening to grep logs found it.
-- The per-model circuit table was never designed to represent an
-- account-level fact, and no amount of tuning its escalating-backoff logic
-- (2026-07-25/26) closes this gap, because the other two models' rows are
-- never created in the first place.
--
-- Fix: a small, separate table for account-level (not per-model) failure
-- state, written whenever attemptFallbackPass classifies a server-key
-- failure as quota_exhausted or auth_error, and cleared the moment ANY
-- server-key call succeeds (if one model works, the account is not broken).
-- health/index.ts now reads this table directly (same style as its existing
-- gemini_model_circuit read) and folds a non-empty result into `status`.
-- Deliberately NOT reusing gemini_model_circuit itself (e.g. by force-
-- opening all 3 models' circuits on an account-level failure): doing that
-- would make attemptFallbackPass's own `circuitIsOpen` skip-check start
-- skipping every model on the very next real request too, since nothing in
-- that code path distinguishes "skipped because genuinely still broken"
-- from "skipped because we're just reusing this table for a health flag" --
-- risking a real recovery being silently blocked from ever being retried
-- until an escalated backoff window expires on all three rows independently.
-- A dedicated table has no such interaction with the retry path: it's
-- read by health only, never consulted by attemptFallbackPass's own
-- skip-logic.

create table if not exists public.gemini_account_alert (
  reason text primary key, -- 'quota_exhausted' | 'auth_error'
  status integer,
  error text,
  fail_count integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.gemini_account_alert enable row level security;

-- Service-role only, same deny-all restrictive pattern as
-- gemini_model_circuit / rate_limit_events -- avoids tripping the
-- rls_enabled_no_policy advisor while keeping this unreachable from the
-- anon/authenticated roles the client bundle actually uses.
create policy "deny_all_gemini_account_alert" on public.gemini_account_alert
  as restrictive
  for all
  to public
  using (false);

create or replace function public.gemini_account_alert_record(
  p_reason text,
  p_status integer default null,
  p_error text default null
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  insert into public.gemini_account_alert as a
    (reason, status, error, fail_count, first_seen_at, last_seen_at)
    values (p_reason, p_status, left(p_error, 500), 1, now(), now())
  on conflict (reason) do update
    set status = coalesce(p_status, a.status),
        error = coalesce(left(p_error, 500), a.error),
        fail_count = a.fail_count + 1,
        last_seen_at = now();
end;
$$;

-- Called on any successful server-key Gemini response (see
-- gemini.ts's attemptFallbackPass, the same branch that already calls
-- gemini_circuit_record_success for the model that just succeeded) --
-- a working call proves the account itself is fine, whichever alert reason
-- (if any) was previously recorded.
create or replace function public.gemini_account_alert_clear()
returns void
language sql
set search_path = public, pg_temp
as $$
  delete from public.gemini_account_alert;
$$;

revoke execute on function public.gemini_account_alert_record(text, integer, text) from public, anon, authenticated;
revoke execute on function public.gemini_account_alert_clear() from public, anon, authenticated;

grant execute on function public.gemini_account_alert_record(text, integer, text) to service_role;
grant execute on function public.gemini_account_alert_clear() to service_role;

-- health/index.ts reads this table directly with the service-role client
-- (same pattern it already uses for gemini_model_circuit) rather than via
-- an RPC -- no grant needed beyond RLS being bypassed for service_role,
-- which Supabase does by default.
