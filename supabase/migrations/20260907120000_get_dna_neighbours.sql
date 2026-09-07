-- get_dna_neighbours — nearest books in 12-axis DNA space.
--
-- Why this exists: `analysis->'recommendation'` is a single title Gemini
-- invents, and an audit on 2026-09-07 found only 111 of 427 validated
-- analyses (26%) recommend a book that actually has a NovelViz page. That
-- is the root cause of BuyButton being the recommendation panel's only
-- CTA — three times in four there is nowhere inward to send the reader.
--
-- Every validated analysis carries a full 12-axis DNA vector (427/427), so
-- the neighbourhood can be computed directly from data we already have:
-- no Gemini call, no latency, no spend, and — because the pool is filtered
-- to `slug IS NOT NULL` — every result is guaranteed to have a page.
--
-- Deliberately SECURITY INVOKER, not DEFINER: novel_analyses' RLS is
-- `USING (true)` for read, so no privilege escalation is needed and we
-- avoid adding a second security-definer advisor warning alongside
-- get_constellation_anchor_candidates. Kept as an RPC anyway so the 178
-- fiction × 12 axes never cross the wire — pulling them client-side would
-- walk straight into the PostREST db-max-rows silent truncation that bit
-- popular-books on 2026-08-30.
--
-- p_axes lets the client pass the reader's *perturbed* vector straight from
-- the BookDNA sliders, so dragging an axis re-ranks the neighbourhood
-- instantly and for free while the Gemini "kindred" pick re-fetches on its
-- own debounce. NULL falls back to the book's own stored axes.

CREATE OR REPLACE FUNCTION public.get_dna_neighbours(
  p_cache_key text,
  p_book_type text DEFAULT 'fiction',
  p_axes      jsonb DEFAULT NULL,
  p_limit     int   DEFAULT 8
)
RETURNS TABLE(
  cache_key   text,
  title       text,
  author      text,
  slug        text,
  distance    numeric,
  match_pct   int,
  shared_axes text[]
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH target_row AS (
    SELECT n.title, n.analysis->'dna'->'axes' AS axes
    FROM novel_analyses n
    WHERE n.cache_key = p_cache_key AND n.is_validated
    LIMIT 1
  ),
  target AS (
    SELECT a.value->>'id' AS axis_id, (a.value->>'score')::numeric AS score
    FROM (SELECT COALESCE(p_axes, (SELECT axes FROM target_row)) AS axes) src
    CROSS JOIN LATERAL jsonb_array_elements(src.axes) a
    WHERE src.axes IS NOT NULL
  ),
  pool AS (
    SELECT n.cache_key, n.title, n.author, n.slug,
           a.value->>'id' AS axis_id, (a.value->>'score')::numeric AS score
    FROM novel_analyses n
    CROSS JOIN LATERAL jsonb_array_elements(n.analysis->'dna'->'axes') a
    WHERE n.is_validated
      AND n.slug IS NOT NULL
      AND n.cache_key IS DISTINCT FROM p_cache_key
      -- duplicate rows for the same work exist (differing cache_key), so
      -- exclude the target by normalised title too, not just by key
      AND lower(regexp_replace(trim(n.title), '\s+', ' ', 'g'))
          IS DISTINCT FROM
          (SELECT lower(regexp_replace(trim(t.title), '\s+', ' ', 'g')) FROM target_row t)
      AND (CASE WHEN n.analysis->>'bookType' = 'nonfiction' THEN 'nonfiction' ELSE 'fiction' END)
          = COALESCE(p_book_type, 'fiction')
  ),
  scored AS (
    SELECT p.cache_key, p.title, p.author, p.slug,
           sqrt(sum(power(p.score - t.score, 2))) AS dist,
           count(*) AS n_axes,
           array_agg(p.axis_id ORDER BY abs(p.score - t.score))
             FILTER (WHERE abs(p.score - t.score) <= 10) AS shared
    FROM pool p
    JOIN target t ON t.axis_id = p.axis_id
    GROUP BY p.cache_key, p.title, p.author, p.slug
    HAVING count(*) >= 10
  ),
  deduped AS (
    -- one row per work: same title cached more than once keeps the closest
    SELECT DISTINCT ON (lower(regexp_replace(trim(title), '\s+', ' ', 'g')))
           cache_key, title, author, slug, dist, n_axes, shared
    FROM scored
    ORDER BY lower(regexp_replace(trim(title), '\s+', ' ', 'g')), dist ASC
  )
  SELECT
    d.cache_key,
    d.title,
    d.author,
    d.slug,
    round(d.dist, 1) AS distance,
    -- dist / sqrt(n) is the RMS gap per axis in the same 0-100 units the
    -- axes use, so 100 - RMS reads as "how alike, per axis". Honest but
    -- narrow in practice (~74-84 across a typical top 8), which is why the
    -- UI ranks the neighbourhood rather than leading with this number.
    greatest(0, least(100, round(100 - d.dist / sqrt(d.n_axes))))::int AS match_pct,
    (COALESCE(d.shared, ARRAY[]::text[]))[1:3] AS shared_axes
  FROM deduped d
  ORDER BY d.dist ASC
  LIMIT least(COALESCE(p_limit, 8), 24);
$function$;

REVOKE ALL ON FUNCTION public.get_dna_neighbours(text, text, jsonb, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dna_neighbours(text, text, jsonb, int) TO anon, authenticated, service_role;


-- resolve_book_page — does this title/author already have a NovelViz page?
--
-- Companion to the audit above: Gemini's "kindred" recommendation names a book
-- it may or may not know we have analysed, so the UI has to ask. When the
-- answer is a slug, the recommendation links inward; when it is NULL the CTA
-- becomes "Map this book" (a /?book= deep link that analyses it), which turns
-- the 74% miss into the corpus's own growth loop instead of a dead end.
--
-- Author is matched loosely on purpose: Gemini frequently returns a slightly
-- different author spelling than the cached row ("Gabriel Garcia Marquez" vs
-- "Gabriel García Márquez"), and a title match alone is a good enough key for
-- this corpus. Title match is exact-after-normalisation.

CREATE OR REPLACE FUNCTION public.resolve_book_page(p_title text, p_author text DEFAULT NULL)
RETURNS TABLE(slug text, title text, author text)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT n.slug, n.title, n.author
  FROM novel_analyses n
  WHERE n.is_validated
    AND n.slug IS NOT NULL
    AND lower(regexp_replace(trim(n.title), '\s+', ' ', 'g'))
        = lower(regexp_replace(trim(COALESCE(p_title, '')), '\s+', ' ', 'g'))
  ORDER BY
    -- prefer a row whose author also matches, then the most-visited row
    (CASE
       WHEN p_author IS NULL THEN 1
       WHEN lower(regexp_replace(trim(n.author), '\s+', ' ', 'g'))
            = lower(regexp_replace(trim(p_author), '\s+', ' ', 'g')) THEN 0
       ELSE 1
     END),
    n.hit_count DESC NULLS LAST
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.resolve_book_page(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_book_page(text, text) TO anon, authenticated, service_role;
