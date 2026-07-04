-- Shared, DB-backed circuit breaker for Gemini model fallback, used by all
-- 5 AI edge functions (analyze-novel, takeaways, recommend-anti-shelf,
-- recommend-by-dna, dna-consensus). Previously each function tracked circuit
-- state in a per-isolate in-memory Map, so under concurrent traffic each
-- isolate independently "discovered" an overloaded model instead of sharing
-- that knowledge fleet-wide. This table + RPCs let any concurrent request
-- benefit the instant another one trips the circuit.

create table if not exists public.gemini_model_circuit (
  model text primary key,
  fails integer not null default 0,
  open_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.gemini_model_circuit enable row level security;

-- Service-role only (edge functions use the service-role client, which
-- bypasses RLS). Explicit restrictive deny-all policy so this table doesn't
-- trip the rls_enabled_no_policy advisor — same pattern already used for
-- rate_limit_events.
create policy "deny_all_gemini_model_circuit" on public.gemini_model_circuit
  as restrictive
  for all
  to public
  using (false);

create or replace function public.gemini_circuit_check(p_model text)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(
    (select open_until is not null and open_until > now()
       from public.gemini_model_circuit where model = p_model),
    false
  );
$$;

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
    set fails = case
          when c.open_until is not null and c.open_until <= now() then 1
          else c.fails + 1
        end,
        updated_at = now()
  returning fails into v_fails;

  if v_fails >= p_trip_after then
    update public.gemini_model_circuit
      set open_until = now() + make_interval(secs => p_open_ms / 1000.0)
      where model = p_model;
  end if;
end;
$$;

create or replace function public.gemini_circuit_record_success(p_model text)
returns void
language sql
set search_path = public, pg_temp
as $$
  delete from public.gemini_model_circuit where model = p_model;
$$;

revoke execute on function public.gemini_circuit_check(text) from public, anon, authenticated;
revoke execute on function public.gemini_circuit_record_fail(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.gemini_circuit_record_success(text) from public, anon, authenticated;

grant execute on function public.gemini_circuit_check(text) to service_role;
grant execute on function public.gemini_circuit_record_fail(text, integer, integer) to service_role;
grant execute on function public.gemini_circuit_record_success(text) to service_role;
