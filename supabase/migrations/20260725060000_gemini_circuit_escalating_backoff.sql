-- Escalate the circuit-open window for sustained outages.
--
-- Problem: CIRCUIT_OPEN_MS (30s, set by the caller) is tuned for transient
-- capacity blips — the kind that clear up in seconds. It has no memory of
-- how long a model has been failing, so a sustained outage (e.g. a Gemini
-- API key with depleted prepaid billing credits, which persists for days
-- until someone tops it up) reopens the circuit and gets re-tripped every
-- 30 seconds indefinitely. Confirmed live on 2026-07-25: gemini-2.5-flash-lite
-- had fails=44 with open_until only ~30s out, after ~2.5 days of the
-- underlying billing failure being permanent, not transient.
--
-- Fix: once the trip threshold is reached, escalate the open window
-- exponentially with each additional consecutive failure, doubling per
-- extra fail above the threshold, capped at 15 minutes. A model that
-- recovers (a real success) still resets instantly via
-- gemini_circuit_record_success, which deletes the row (fails back to 0)
-- — so this only slows down retries during an ACTUAL ongoing outage, never
-- delays recovery once Gemini (or our billing) is healthy again.
--
-- p_open_ms from the caller is now treated as the BASE window (what the
-- very first trip uses), not a fixed window reused forever.

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
    -- 1x at the trip threshold, doubling per additional consecutive fail,
    -- capped at a 30x multiplier (with the 30s default base that's 15 min).
    v_multiplier := least(power(2, greatest(v_fails - p_trip_after, 0))::integer, 30);
    v_open_ms := least(p_open_ms * v_multiplier, 900000);
    update public.gemini_model_circuit
      set open_until = now() + make_interval(secs => v_open_ms / 1000.0)
      where model = p_model;
  end if;
end;
$$;

-- Signature is unchanged from the 20260711120000 migration, so grants
-- already apply — no revoke/grant needed here.
