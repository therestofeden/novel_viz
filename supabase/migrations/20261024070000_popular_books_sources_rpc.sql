-- 2026-10-24 daily_backend: single-round-trip source fetch for popular-books.
--
-- popular-books (the Tier-1 instant autocomplete index loaded on every app
-- open) averaged 2.3 s on a memo miss in the last 24 h of edge logs, while
-- the same four source reads take ~38 ms inside Postgres. The gap is pure
-- PostgREST round trips: novel_analyses + search_cache, plus canon_books
-- (1202 rows -> 2 sequential 1000-row pages) and seed_book_list (2450 rows
-- -> 3 sequential pages), all to dodge db-max-rows' silent truncation.
-- canon_books grows ~20 rows/day, so the page chain only gets longer.
--
-- This returns all four sources as ONE jsonb scalar (a scalar is never
-- subject to db-max-rows), so the edge function makes one call instead of
-- up to 7. Row caps match the old per-source limits exactly.
--
-- Security: SECURITY INVOKER and executable by service_role ONLY. canon_books
-- / seed_book_list are deny-all under RLS; service_role bypasses RLS, anon
-- and authenticated cannot call this at all (no new public RPC surface, no
-- new SECURITY DEFINER advisor finding).
CREATE OR REPLACE FUNCTION public.get_popular_books_sources()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'analyses', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('title', x.title, 'author', x.author, 'hit_count', x.hit_count)
                                ORDER BY x.hit_count DESC NULLS FIRST), '[]'::jsonb)
      FROM (SELECT title, author, hit_count FROM novel_analyses
            ORDER BY hit_count DESC NULLS FIRST LIMIT 6000) x
    ),
    'search_cache', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('results', x.results, 'hit_count', x.hit_count)
                                ORDER BY x.hit_count DESC NULLS FIRST), '[]'::jsonb)
      FROM (SELECT results, hit_count FROM search_cache
            ORDER BY hit_count DESC NULLS FIRST LIMIT 3000) x
    ),
    'canon', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('title', c.title, 'author', c.author)), '[]'::jsonb)
      FROM (SELECT title, author FROM canon_books LIMIT 10000) c
    ),
    'seed', (
      SELECT COALESCE(jsonb_agg(s.entry), '[]'::jsonb)
      FROM (SELECT entry FROM seed_book_list LIMIT 10000) s
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_popular_books_sources() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_popular_books_sources() TO service_role;
