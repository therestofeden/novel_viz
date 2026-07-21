-- Reconstructed local record of the live `get_constellation_anchor_candidates`
-- RPC (backs the "more anchors as your shelf grows" Constellation feature,
-- see memory: novelviz-constellation-dupes-and-anchors-2026-07-21). Applied
-- directly via the Supabase MCP tool on 2026-07-21; this file was written
-- retroactively the same day after an audit found it (along with the
-- 2026-07-20 nobel-gaps backfill above) had never been committed to the
-- repo, diverging local migration history from the live schema.
--
-- History note: this supersedes an earlier same-session attempt at
-- timestamp 20260721075418 that implemented the same query as a
-- `SECURITY DEFINER` VIEW. That view tripped an ERROR-level
-- `security_definer_view` advisor lint (stricter than the WARN-level flag
-- security-definer *functions* get for equivalent anon/authenticated
-- exposure) and was dropped and replaced with this function in the same
-- session, before ever being queried in production. Not reconstructed as
-- a separate migration file -- it no longer exists live, and replaying a
-- create-then-immediately-superseded view would add historical noise
-- without reproducing anything meaningful. This file represents the
-- actual, final, live state, confirmed byte-identical via pg_get_functiondef.
CREATE OR REPLACE FUNCTION public.get_constellation_anchor_candidates(p_book_type text)
RETURNS TABLE(cache_key text, title text, author text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT DISTINCT na.cache_key, na.title, na.author
  FROM canon_books cb
  JOIN novel_analyses na
    ON lower(regexp_replace(trim(na.title), '\s+', ' ', 'g')) = lower(regexp_replace(trim(cb.title), '\s+', ' ', 'g'))
   AND lower(regexp_replace(trim(na.author), '\s+', ' ', 'g')) = lower(regexp_replace(trim(cb.author), '\s+', ' ', 'g'))
  WHERE na.is_validated
    AND na.slug IS NOT NULL
    AND na.analysis -> 'dna' -> 'axes' IS NOT NULL
    AND (
      p_book_type IS NULL
      OR (CASE WHEN na.analysis->>'bookType' = 'nonfiction' THEN 'nonfiction' ELSE 'fiction' END) = p_book_type
    );
$function$;

REVOKE ALL ON FUNCTION public.get_constellation_anchor_candidates(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_constellation_anchor_candidates(text) TO anon, authenticated, service_role;
