-- perf(constellation): get_constellation_anchor_candidates — O(n*m) regex
-- nested loop -> O(n+m) hash join.
--
-- The old body joined canon_books x novel_analyses ON lower(regexp_replace(..))
-- of BOTH sides, so Postgres could only nested-loop it and re-ran four
-- regexp_replace calls per (canon, analysis) pair: 1182 x 315 pairs ~= 1.5M
-- regex evals, 326 ms per call (2026-10-23, EXPLAIN ANALYZE). The function is
-- anon-callable (Constellation.tsx needs it; canon_books is deny-all under RLS,
-- hence SECURITY DEFINER stays) and canon_books grows ~20 rows/day, so the
-- cost was growing linearly every day on an unauthenticated endpoint — a
-- latency problem for every Constellation open and a cheap CPU-burn lever for
-- anyone hammering /rest/v1/rpc.
--
-- Fix: normalise each side exactly once in a MATERIALIZED CTE, then equi-join
-- on the normalised keys (hash join). Measured 23 ms, same 86 rows; the
-- fiction/nonfiction split was verified set-equal (EXCEPT both ways = 0).
-- Signature, return shape, SECURITY DEFINER, search_path and grants unchanged.
CREATE OR REPLACE FUNCTION public.get_constellation_anchor_candidates(p_book_type text)
 RETURNS TABLE(cache_key text, title text, author text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH cb AS MATERIALIZED (
    SELECT DISTINCT
      lower(regexp_replace(trim(c.title),  '\s+', ' ', 'g')) AS t,
      lower(regexp_replace(trim(c.author), '\s+', ' ', 'g')) AS a
    FROM canon_books c
  ),
  na AS MATERIALIZED (
    SELECT n.cache_key, n.title, n.author,
      lower(regexp_replace(trim(n.title),  '\s+', ' ', 'g')) AS t,
      lower(regexp_replace(trim(n.author), '\s+', ' ', 'g')) AS a,
      CASE WHEN n.analysis->>'bookType' = 'nonfiction' THEN 'nonfiction' ELSE 'fiction' END AS kind
    FROM novel_analyses n
    WHERE n.is_validated
      AND n.slug IS NOT NULL
      AND n.analysis -> 'dna' -> 'axes' IS NOT NULL
  )
  SELECT DISTINCT na.cache_key, na.title, na.author
  FROM na
  JOIN cb ON cb.t = na.t AND cb.a = na.a
  WHERE p_book_type IS NULL OR na.kind = p_book_type;
$function$;
