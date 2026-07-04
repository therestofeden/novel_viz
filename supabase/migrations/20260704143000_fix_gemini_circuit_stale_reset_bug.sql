-- Fix: gemini_circuit_record_fail never re-opened the circuit during a
-- sustained outage (e.g. Gemini API quota/rate-limit exhaustion lasting
-- minutes, not seconds).
--
-- Bug: the old version reset `fails` back to 1 whenever the existing
-- `open_until` was in the past ("the previous open window expired, treat
-- this as a fresh start") but never cleared `open_until` itself in that
-- reset branch. So after the first-ever trip, `open_until` was left
-- pointing at that one stale timestamp forever. Every subsequent failure
-- — no matter how many, no matter how close together — saw
-- `open_until <= now()` as true and reset fails back to 1 instead of
-- incrementing, so the circuit could never reach CIRCUIT_TRIP_AFTER again.
-- Confirmed live on 2026-07-04: gemini_model_circuit rows sat at fails=1
-- with open_until frozen ~17 minutes in the past while every single
-- request in between was independently getting a real 429 from Gemini.
--
-- Fix: a fail streak should only ever be broken by an actual SUCCESS
-- (which already deletes the row via gemini_circuit_record_success) — not
-- by wall-clock time passing. So just increment monotonically on every
-- fail; re-open (extend open_until) every time the streak is at or above
-- the trip threshold, including on repeat trips during an ongoing outage.
create or replace function public.gemini_circuit_record_fail(p_model text, p_trip_after integer, p_open_ms integer)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_fails integer;
begin
  insert into public.gemini_model_circuit as c (model, fails, updated_at)
    values (p_model, 1, now())
  on conflict (model) do update
    set fails = c.fails + 1,
        updated_at = now()
  returning fails into v_fails;

  if v_fails >= p_trip_after then
    update public.gemini_model_circuit
      set open_until = now() + make_interval(secs => p_open_ms / 1000.0)
      where model = p_model;
  end if;
end;
$$;
