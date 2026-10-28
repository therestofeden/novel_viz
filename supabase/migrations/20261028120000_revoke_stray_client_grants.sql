-- 2026-10-28 (daily_backend): strip leftover client grants on two server-only tables.
--
-- gemini_account_alert and seed_book_list still carry Supabase's default
-- "ALL" grants for anon/authenticated (INSERT/UPDATE/DELETE/TRUNCATE/...).
-- Their deny-all RLS policies block row-level access today, but:
--   * TRUNCATE is NOT governed by RLS. It is not reachable through PostgREST
--     today, but any future SECURITY INVOKER RPC or SQL path running as a client
--     role could wipe the seed list or the Gemini billing alert.
--   * A single permissive policy added later would silently re-open writes.
-- Every other server-only table (rate_limit_events, gemini_daily_spend,
-- gemini_model_circuit, canon_books) already has client writes revoked; this
-- brings the last two in line. Only edge functions (service_role, bypasses
-- grants and RLS) touch these tables, so nothing client-side changes.

REVOKE ALL ON public.gemini_account_alert, public.seed_book_list FROM anon, authenticated;

ALTER TABLE public.gemini_account_alert ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seed_book_list ENABLE ROW LEVEL SECURITY;
