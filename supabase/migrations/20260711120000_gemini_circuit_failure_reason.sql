-- Add failure-reason visibility to the Gemini circuit breaker.
--
-- Problem: gemini_model_circuit tracks fails/open_until but never recorded
-- WHY a model failed (HTTP status, error body). Three consecutive daily
-- backend-agent audits (2026-07-08 morning, 2026-07-08 afternoon,
-- 2026-07-11) hit the same dead end investigating an elevated fails count
-- on gemini-2.5-flash-lite (20 -> 38 over 3 days): get_logs only surfaces
-- HTTP access-log lines, not the console.error/warn JSON that
-- attemptFallbackPass already logs per-failure in _shared/gemini.ts — so
-- there was no way to distinguish "real Gemini 429/503 capacity outage"
-- from "something wrong with this specific model" without re-reading raw
-- logs each time, which the log retention window doesn't reliably support
-- days later. (2026-07-11 finding: turned out to be a real, correlated,
-- one-hour capacity outage across all 3 models on 2026-07-10 evening, with
-- zero failures on any model since — but that took a live DB query to
-- confirm; this should be a 5-second read of the circuit table instead.)
--
-- Fix: store the last failure's HTTP status + a truncated error body
-- directly on the circuit row. Purely additive (nullable columns, RPC gets
-- two new optional params with defaults so no caller is forced to change
-- behavior) — does not alter trip/reset logic at all.

alter table public.gemini_model_circuit
  add column if not exists last_status integer,
  add column if not exists last_error text;

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
    update public.gemini_model_circuit
      set open_until = now() + make_interval(secs => p_open_ms / 1000.0)
      where model = p_model;
  end if;
end;
$$;

-- Same grants as the original migration — signature changed (2 new
-- optional params) so PostgREST/RPC callers need the new grant to match.
revoke execute on function public.gemini_circuit_record_fail(text, integer, integer, integer, text) from public, anon, authenticated;
grant execute on function public.gemini_circuit_record_fail(text, integer, integer, integer, text) to service_role;
