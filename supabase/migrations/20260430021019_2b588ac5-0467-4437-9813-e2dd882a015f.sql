-- Lock down the purge helper: only service_role (backend) should call it.
REVOKE EXECUTE ON FUNCTION public.purge_old_search_cache() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_search_cache() TO service_role;