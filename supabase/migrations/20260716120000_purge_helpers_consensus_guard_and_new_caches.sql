-- Fix: purge_cold_novel_analyses cascades DELETE to book_dna_consensus
-- (FK book_dna_consensus_cache_key_fkey ... ON DELETE CASCADE), so a novel_analyses
-- row going "cold" (hit_count < 2, not accessed in 90 days) silently destroys any
-- crowd-sourced DNA consensus votes tied to it, even though the consensus itself
-- may still be live/useful independent of how often the raw analysis cache is hit.
-- Guard against that by excluding rows that have consensus data attached.
CREATE OR REPLACE FUNCTION public.purge_cold_novel_analyses()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM public.novel_analyses na
  WHERE na.hit_count < 2
    AND na.last_accessed_at < now() - interval '90 days'
    AND NOT EXISTS (
      SELECT 1 FROM public.book_dna_consensus c WHERE c.cache_key = na.cache_key
    );
  GET DIAGNOSTICS v_deleted = ROW_COUNT; RETURN v_deleted;
END; $function$;

-- New: dna_recommendation_cache had no purge path at all (hit_count/last_accessed_at
-- present but orphaned, same AI-cost-cache pattern as novel_analyses -> same 90-day rule).
CREATE OR REPLACE FUNCTION public.purge_cold_dna_recommendation_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM public.dna_recommendation_cache
  WHERE hit_count < 2 AND last_accessed_at < now() - interval '90 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT; RETURN v_deleted;
END; $function$;

-- New: takeaway_questions_cache, same AI-cost-cache pattern, 90-day rule.
CREATE OR REPLACE FUNCTION public.purge_cold_takeaway_questions_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM public.takeaway_questions_cache
  WHERE hit_count < 2 AND last_accessed_at < now() - interval '90 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT; RETURN v_deleted;
END; $function$;

-- New: shelf_recommendations has no hit_count column (personal per-user cache keyed
-- on a shelf's content signature) -- a signature goes permanently stale the moment the
-- user edits their shelf, so gate purely on staleness of last_accessed_at, same 90-day
-- window as the other Gemini-backed caches.
CREATE OR REPLACE FUNCTION public.purge_cold_shelf_recommendations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM public.shelf_recommendations
  WHERE last_accessed_at < now() - interval '90 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT; RETURN v_deleted;
END; $function$;

-- Lock all four down to service_role only (SECURITY DEFINER functions are
-- PUBLICLY EXECUTABLE by default via PostgREST unless explicitly revoked --
-- same class of bug caught and fixed in the 2026-07-05 cost-incident migration).
REVOKE EXECUTE ON FUNCTION public.purge_cold_novel_analyses() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_cold_dna_recommendation_cache() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_cold_takeaway_questions_cache() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_cold_shelf_recommendations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_cold_novel_analyses() TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_cold_dna_recommendation_cache() TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_cold_takeaway_questions_cache() TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_cold_shelf_recommendations() TO service_role;
