-- Follow-up to the 2026-11-18 guardrail and membership migrations. Supabase's
-- default privileges grant EXECUTE on new public functions to anon and
-- authenticated directly, so REVOKE ... FROM PUBLIC alone left these callable
-- over /rest/v1/rpc (security advisor 0028/0029). Only my_membership() is
-- meant for clients; everything else is for triggers and edge functions
-- (service role).
REVOKE EXECUTE ON FUNCTION public.is_discovery_blocked(text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.discovery_blocked_positions(text[], text[]) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_recommendation(jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_recommendation_list(jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.paywall_enabled() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.novel_analyses_guardrails() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.single_recommendation_guardrail() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.shelf_recommendations_guardrail() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.discovery_blocklist_changed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_notes_membership() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_discovery_guardrails() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_membership(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.membership_allows(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_discovery_blocked(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.paywall_enabled() TO service_role;
