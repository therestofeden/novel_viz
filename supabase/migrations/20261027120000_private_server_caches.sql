-- 2026-10-27 (daily_backend): make the three server-only AI/search caches private.
--
-- search_cache, dna_recommendation_cache and takeaway_questions_cache each had a
-- "publicly readable" (USING true) SELECT policy, so anyone holding the public
-- anon key could page through them via /rest/v1. No client (web or iOS) reads
-- these tables: every reader and writer is an edge function using the
-- service_role key, which bypasses RLS. The exposure was pure downside:
--   * search_cache.query_key is what readers typed into search, with
--     created_at/last_accessed_at timestamps -> a privacy leak once real users
--     arrive (launch wave 1).
--   * the other two let anyone bulk-scrape paid Gemini output for free.
-- novel_analyses / book_dna_consensus / book_rating_stats / pca_basis stay
-- public on purpose: the client reads them directly.
--
-- RLS stays enabled with no policy (deny for anon/authenticated); grants are
-- also revoked so a future permissive policy can't silently re-open them.

DROP POLICY IF EXISTS "search_cache is publicly readable" ON public.search_cache;
DROP POLICY IF EXISTS "DNA recommendation cache is publicly readable" ON public.dna_recommendation_cache;
DROP POLICY IF EXISTS "Cached takeaway questions are publicly readable" ON public.takeaway_questions_cache;

REVOKE ALL ON public.search_cache, public.dna_recommendation_cache, public.takeaway_questions_cache
  FROM anon, authenticated;

ALTER TABLE public.search_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dna_recommendation_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.takeaway_questions_cache ENABLE ROW LEVEL SECURITY;
