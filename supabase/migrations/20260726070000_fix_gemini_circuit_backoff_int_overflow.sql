-- Fixes a real, live production bug found during the 2026-07-26 daily
-- backend audit: gemini_circuit_record_fail (as of the previous migration,
-- 20260725060000_gemini_circuit_escalating_backoff.sql) computed
--   v_multiplier := least(power(2, greatest(v_fails - p_trip_after, 0))::integer, 30);
-- The ::integer cast happens on power()'s result BEFORE the least(...,30)
-- clamp is applied. power(2, 31) = 2,147,483,648, which exceeds int4's max
-- (2,147,483,647), so the cast throws "integer out of range" once
-- v_fails - p_trip_after >= 31. v_fails only increments on failure and is
-- only reset by an actual success (gemini_circuit_record_success deletes
-- the row), so during any sustained per-model outage v_fails climbs
-- unboundedly.
--
-- Confirmed live impact: gemini-2.5-flash-lite's fails count reached 44
-- around 2026-07-25 ~06:33 UTC (right as the previous migration deployed),
-- and every subsequent call to record a failure for that model has thrown
-- this error and rolled back ever since -- over 24 hours straight. Because
-- the calling code (supabase/functions/_shared/gemini.ts circuitRecordFail)
-- wraps this RPC in try/catch, the error was silently swallowed each time
-- (logged as a warning), so it never surfaced as a user-facing failure --
-- but it meant the circuit breaker's open_until for that model stayed
-- frozen at a stale, already-past timestamp, so the app kept treating
-- gemini-2.5-flash-lite as "not circuit-open" and re-attempting it despite
-- sustained real 429s, defeating the entire point of the breaker for that
-- model.
--
-- Fix: clamp the exponent itself (to 10, since 2^10 = 1024 already
-- saturates past the final least(...,30) multiplier cap) BEFORE calling
-- power(), so the value passed to ::integer can never exceed 1024 -- no
-- overflow possible for any v_fails, however high it climbs during a
-- sustained outage. Verified via a synthetic test model driven to
-- fails = 101 (previously would have thrown at fails - trip_after >= 31);
-- the fixed function completed without error and was then cleaned up.
-- No new security/performance advisors introduced (checked via
-- get_advisors immediately after applying).

create or replace function public.gemini_circuit_record_fail(
  p_model text,
  p_trip_after integer,
  p_open_ms integer,
  p_status integer default null,
  p_error text default null
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_fails integer;
  v_multiplier integer;
  v_open_ms integer;
  v_exponent integer;
begin
  insert into public.gemini_model_circuit as c (model, fails, updated_at, last_status, last_error)
    values (p_model, 1, now(), p_status, left(p_error, 500))
  on conflict (model) do update
    set fails = c.fails + 1,
        updated_at = now(),
        last_status = coalesce(p_status, c.last_status),
        last_error = coalesce(left(p_error, 500), c.last_error)
  returning fails into v_fails;

  if v_fails >= p_trip_after then
    -- Clamp the exponent BEFORE calling power() -- see file header for why.
    v_exponent := least(greatest(v_fails - p_trip_after, 0), 10);
    v_multiplier := least(power(2, v_exponent)::integer, 30);
    v_open_ms := least(p_open_ms * v_multiplier, 900000);
    update public.gemini_model_circuit
      set open_until = now() + make_interval(secs => v_open_ms / 1000.0)
      where model = p_model;
  end if;
end;
$$;

-- Signature unchanged from the 20260711120000 migration -- existing grants
-- (service_role only) still apply, no revoke/grant needed.
