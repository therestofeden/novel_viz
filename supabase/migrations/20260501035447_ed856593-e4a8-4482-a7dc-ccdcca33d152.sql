REVOKE EXECUTE ON FUNCTION public.purge_cold_novel_analyses() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_old_rate_limit_events() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_old_search_cache() FROM PUBLIC, anon, authenticated;