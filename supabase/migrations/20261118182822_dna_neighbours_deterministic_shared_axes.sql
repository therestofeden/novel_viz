-- Follow-up to 20261118181417: "Closest on ..." listed tied axes in arbitrary
-- order, so the same book could show different axes on different loads, and
-- the published reference implementation (src/lib/dna-similarity.ts) could
-- not match it exactly. Ties now break by axis id, in both places.
CREATE OR REPLACE FUNCTION public.get_dna_neighbours(
  p_cache_key text,
  p_book_type text DEFAULT 'fiction',
  p_axes jsonb DEFAULT NULL,
  p_limit integer DEFAULT 8,
  p_exclude_titles text[] DEFAULT NULL
)
RETURNS TABLE(cache_key text, title text, author text, slug text, distance numeric, match_pct integer, shared_axes text[])
LANGUAGE sql
STABLE
SET search_path = public, extensions, pg_temp
AS $$
  WITH target_row AS (
    SELECT n.title, n.discovery_blocked, n.analysis->'dna'->'axes' AS axes
    FROM novel_analyses n
    WHERE n.cache_key = p_cache_key AND n.is_validated
    LIMIT 1
  ),
  excluded AS (
    SELECT coalesce(public.book_norm_title(tr.title), lower(btrim(tr.title))) AS t FROM target_row tr
    UNION
    SELECT coalesce(public.book_norm_title(x), lower(btrim(x))) FROM unnest(coalesce(p_exclude_titles, ARRAY[]::text[])) AS x
  ),
  target AS (
    SELECT a.value->>'id' AS axis_id, (a.value->>'score')::numeric AS score
    FROM (SELECT COALESCE(p_axes, (SELECT axes FROM target_row)) AS axes) src
    CROSS JOIN LATERAL jsonb_array_elements(src.axes) a
    WHERE src.axes IS NOT NULL
      AND NOT coalesce((SELECT tr.discovery_blocked FROM target_row tr), false)
  ),
  pool AS (
    SELECT n.cache_key, n.title, n.author, n.slug, coalesce(public.book_norm_title(n.title), lower(btrim(n.title))) AS norm,
           a.value->>'id' AS axis_id, (a.value->>'score')::numeric AS score
    FROM novel_analyses n
    CROSS JOIN LATERAL jsonb_array_elements(n.analysis->'dna'->'axes') a
    WHERE n.is_validated
      AND n.slug IS NOT NULL
      AND NOT n.discovery_blocked
      AND n.cache_key IS DISTINCT FROM p_cache_key
      AND coalesce(public.book_norm_title(n.title), lower(btrim(n.title))) NOT IN (SELECT e.t FROM excluded e WHERE e.t IS NOT NULL)
      AND (CASE WHEN n.analysis->>'bookType' = 'nonfiction' THEN 'nonfiction' ELSE 'fiction' END)
          = COALESCE(p_book_type, 'fiction')
  ),
  scored AS (
    SELECT p.cache_key, p.title, p.author, p.slug, p.norm,
           sqrt(sum(power(p.score - t.score, 2))) AS dist,
           count(*) AS n_axes,
           array_agg(p.axis_id ORDER BY abs(p.score - t.score), p.axis_id)
             FILTER (WHERE abs(p.score - t.score) <= 10) AS shared
    FROM pool p
    JOIN target t ON t.axis_id = p.axis_id
    GROUP BY p.cache_key, p.title, p.author, p.slug, p.norm
    HAVING count(*) >= 10
  ),
  deduped AS (
    SELECT DISTINCT ON (s.norm)
           s.cache_key, s.title, s.author, s.slug, s.dist, s.n_axes, s.shared
    FROM scored s
    ORDER BY s.norm, s.dist ASC, s.cache_key
  )
  SELECT
    d.cache_key,
    d.title,
    d.author,
    d.slug,
    round(d.dist, 1) AS distance,
    greatest(0, least(100, round(100 - d.dist / sqrt(d.n_axes))))::int AS match_pct,
    (COALESCE(d.shared, ARRAY[]::text[]))[1:3] AS shared_axes
  FROM deduped d
  ORDER BY d.dist ASC, d.cache_key
  LIMIT least(COALESCE(p_limit, 8), 24);
$$;
REVOKE ALL ON FUNCTION public.get_dna_neighbours(text, text, jsonb, integer, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dna_neighbours(text, text, jsonb, integer, text[]) TO anon, authenticated, service_role;
