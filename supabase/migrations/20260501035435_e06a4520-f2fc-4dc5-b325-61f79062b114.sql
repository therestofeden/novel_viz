-- Evict cold, low-value cache rows from novel_analyses.
-- Keeps anything with hit_count >= 2 forever (popular books stay warm),
-- and anything accessed in the last 90 days. Drops the long tail of one-off
-- analyses that take up space and will likely never be re-requested.
CREATE OR REPLACE FUNCTION public.purge_cold_novel_analyses()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.novel_analyses
  WHERE hit_count < 2
    AND last_accessed_at < now() - interval '90 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;