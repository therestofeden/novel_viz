-- Discovery guardrails (2026-11-18, live session with Stefano).
--
-- Rule: some books stay searchable and keep their analysis page, but NovelViz
-- never suggests them. Not on the home page, not in "If you loved this shape",
-- not as an AI pick, not in the autocomplete index, not in the constellation,
-- and never with a shop link. Mein Kampf was analysed on 2026-11-18, got a slug,
-- and was immediately eligible for the signed-out glyph wall and for every
-- non-fiction book's DNA neighbours. This closes that.
--
-- One source of truth: public.discovery_blocklist. Everything else (the
-- novel_analyses.discovery_blocked flag, the recommendation "hidden" flag,
-- every recommendation RPC and edge function) reads it through
-- public.is_discovery_blocked(). To add a book: INSERT a row; the statement
-- trigger at the bottom re-flags existing rows immediately.

-- ---------------------------------------------------------------- normaliser
-- Lowercase, strip accents, drop a subtitle (after ':' '(' '['), drop a
-- leading English article, collapse punctuation to single spaces.
--   'The Remains of the Day'                -> 'remains of the day'
--   'Sapiens: A Brief History of Humankind' -> 'sapiens'
--   'Gravity''s Rainbow'                    -> 'gravity s rainbow'
-- Used for guardrail matching and for de-duplicating DNA neighbours.
CREATE OR REPLACE FUNCTION public.book_norm_title(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, extensions, pg_temp
AS $$
  SELECT nullif(
    btrim(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p, ''))),
            '\s*[:(\[].*$', ''),
          '^(the|a|an)\s+', ''),
        '[^a-z0-9]+', ' ', 'g')),
    '');
$$;

-- ------------------------------------------------------------------ the list
CREATE TABLE IF NOT EXISTS public.discovery_blocklist (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- NULL title = every book by author_match
  title        text,
  title_norm   text GENERATED ALWAYS AS (public.book_norm_title(title)) STORED,
  -- normalised substring that must appear in the book's author; NULL = any
  -- author. When a title is set, a book with an EMPTY author also matches
  -- (Gemini sometimes caches a row with no author).
  author_match text,
  reason       text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discovery_blocklist_has_rule CHECK (title IS NOT NULL OR author_match IS NOT NULL)
);

ALTER TABLE public.discovery_blocklist ENABLE ROW LEVEL SECURITY;
-- No client policies: only SECURITY DEFINER functions and the service role read it.
REVOKE ALL ON public.discovery_blocklist FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS discovery_blocklist_title_norm_idx ON public.discovery_blocklist (title_norm);

-- Conservative starting list: Nazi and antisemitic propaganda, white-supremacist
-- movement texts, terrorist manifestos. Political or controversial books that
-- people read critically (The Communist Manifesto, The Prince, Camp of the
-- Saints, etc.) are deliberately NOT here. Author constraints keep namesakes
-- safe: Knausgard's "My Struggle" and Tabori's play "Mein Kampf" stay
-- recommendable.
INSERT INTO public.discovery_blocklist (title, author_match, reason) VALUES
  ('Mein Kampf',                              'hitler',          'Nazi propaganda'),
  ('My Struggle',                             'hitler',          'Nazi propaganda (English title of Mein Kampf)'),
  ('La mia battaglia',                        'hitler',          'Nazi propaganda (Italian title of Mein Kampf)'),
  (NULL,                                      'adolf hitler',    'Any work credited to Hitler'),
  ('The Protocols of the Elders of Zion',     NULL,              'Antisemitic forgery'),
  ('The Protocols of the Learned Elders of Zion', NULL,          'Antisemitic forgery'),
  ('The International Jew',                   'ford',            'Antisemitic propaganda'),
  ('The Myth of the Twentieth Century',       'rosenberg',       'Nazi ideology'),
  ('Der Giftpilz',                            NULL,              'Nazi antisemitic propaganda for children'),
  ('The Poisonous Mushroom',                  'hiemer',          'Nazi antisemitic propaganda for children'),
  ('The Turner Diaries',                      NULL,              'White-supremacist novel tied to terrorist attacks'),
  ('Hunter',                                  'andrew macdonald','White-supremacist novel (Turner Diaries author)'),
  ('Hunter',                                  'luther pierce',   'White-supremacist novel (Turner Diaries author)'),
  ('Siege',                                   'james mason',     'Neo-Nazi terror handbook'),
  ('Industrial Society and Its Future',       NULL,              'Terrorist manifesto (Unabomber)'),
  ('Le Grand Remplacement',                   NULL,              'Great Replacement conspiracy text'),
  ('The Great Replacement',                   'camus',           'Great Replacement conspiracy text')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------ matching
CREATE OR REPLACE FUNCTION public.is_discovery_blocked(p_title text, p_author text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.discovery_blocklist b
    WHERE (b.title_norm IS NULL OR b.title_norm = public.book_norm_title(p_title))
      AND (
        b.author_match IS NULL
        OR (b.title_norm IS NOT NULL AND coalesce(btrim(p_author), '') = '')
        OR coalesce(public.book_norm_title(p_author), '') LIKE '%' || b.author_match || '%'
      )
      AND (b.title_norm IS NOT NULL OR coalesce(btrim(p_author), '') <> '')
  );
$$;

-- Bulk form for edge functions that filter whole lists (popular-books,
-- recommend-anti-shelf): returns the 1-based positions that are blocked.
CREATE OR REPLACE FUNCTION public.discovery_blocked_positions(p_titles text[], p_authors text[])
RETURNS int[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  SELECT coalesce(array_agg(t.ord ORDER BY t.ord), ARRAY[]::int[])::int[]
  FROM unnest(p_titles, p_authors) WITH ORDINALITY AS t(title, author, ord)
  WHERE public.is_discovery_blocked(t.title, t.author);
$$;

-- A recommendation object ({title, author, why, ...}) comes back with
-- "hidden": true when it points at a blocked book, and without the key
-- otherwise. Clients skip hidden picks; the shape stays valid so nothing that
-- expects a recommendation breaks.
CREATE OR REPLACE FUNCTION public.guard_recommendation(p_rec jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  SELECT CASE
    WHEN p_rec IS NULL OR jsonb_typeof(p_rec) <> 'object' THEN p_rec
    WHEN public.is_discovery_blocked(p_rec->>'title', p_rec->>'author') THEN p_rec || '{"hidden": true}'::jsonb
    ELSE p_rec - 'hidden'
  END;
$$;

-- Lists (shelf_recommendations.recommendations) simply lose blocked entries.
CREATE OR REPLACE FUNCTION public.guard_recommendation_list(p_list jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  SELECT CASE
    WHEN p_list IS NULL OR jsonb_typeof(p_list) <> 'array' THEN p_list
    ELSE coalesce(
      (SELECT jsonb_agg(e ORDER BY ord)
       FROM jsonb_array_elements(p_list) WITH ORDINALITY AS x(e, ord)
       WHERE NOT (jsonb_typeof(e) = 'object' AND public.is_discovery_blocked(e->>'title', e->>'author'))),
      '[]'::jsonb)
  END;
$$;

REVOKE ALL ON FUNCTION public.is_discovery_blocked(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.discovery_blocked_positions(text[], text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_recommendation(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_recommendation_list(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_discovery_blocked(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.discovery_blocked_positions(text[], text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.guard_recommendation(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.guard_recommendation_list(jsonb) TO service_role;

-- ------------------------------------------------------- flags on stored rows
ALTER TABLE public.novel_analyses
  ADD COLUMN IF NOT EXISTS discovery_blocked boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.novel_analyses_guardrails()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  g jsonb;
BEGIN
  NEW.discovery_blocked := public.is_discovery_blocked(NEW.title, NEW.author);
  IF NEW.analysis IS NOT NULL AND jsonb_typeof(NEW.analysis) = 'object' AND NEW.analysis ? 'recommendation' THEN
    g := public.guard_recommendation(NEW.analysis->'recommendation');
    IF g IS DISTINCT FROM NEW.analysis->'recommendation' THEN
      NEW.analysis := jsonb_set(NEW.analysis, '{recommendation}', g);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_novel_analyses_guardrails ON public.novel_analyses;
CREATE TRIGGER trg_novel_analyses_guardrails
  BEFORE INSERT OR UPDATE OF title, author, analysis ON public.novel_analyses
  FOR EACH ROW EXECUTE FUNCTION public.novel_analyses_guardrails();

CREATE OR REPLACE FUNCTION public.single_recommendation_guardrail()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  NEW.recommendation := public.guard_recommendation(NEW.recommendation);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_book_dna_consensus_guardrail ON public.book_dna_consensus;
CREATE TRIGGER trg_book_dna_consensus_guardrail
  BEFORE INSERT OR UPDATE OF recommendation ON public.book_dna_consensus
  FOR EACH ROW EXECUTE FUNCTION public.single_recommendation_guardrail();

DROP TRIGGER IF EXISTS trg_dna_recommendation_cache_guardrail ON public.dna_recommendation_cache;
CREATE TRIGGER trg_dna_recommendation_cache_guardrail
  BEFORE INSERT OR UPDATE OF recommendation ON public.dna_recommendation_cache
  FOR EACH ROW EXECUTE FUNCTION public.single_recommendation_guardrail();

CREATE OR REPLACE FUNCTION public.shelf_recommendations_guardrail()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  NEW.recommendations := public.guard_recommendation_list(NEW.recommendations);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shelf_recommendations_guardrail ON public.shelf_recommendations;
CREATE TRIGGER trg_shelf_recommendations_guardrail
  BEFORE INSERT OR UPDATE OF recommendations ON public.shelf_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.shelf_recommendations_guardrail();

-- Re-apply everything after the list changes (and once now, as the backfill).
CREATE OR REPLACE FUNCTION public.refresh_discovery_guardrails()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  UPDATE public.novel_analyses n
     SET discovery_blocked = public.is_discovery_blocked(n.title, n.author)
   WHERE n.discovery_blocked IS DISTINCT FROM public.is_discovery_blocked(n.title, n.author);

  UPDATE public.novel_analyses n
     SET analysis = jsonb_set(n.analysis, '{recommendation}', public.guard_recommendation(n.analysis->'recommendation'))
   WHERE jsonb_typeof(n.analysis) = 'object' AND n.analysis ? 'recommendation'
     AND public.guard_recommendation(n.analysis->'recommendation') IS DISTINCT FROM n.analysis->'recommendation';

  UPDATE public.book_dna_consensus c
     SET recommendation = public.guard_recommendation(c.recommendation)
   WHERE public.guard_recommendation(c.recommendation) IS DISTINCT FROM c.recommendation;

  UPDATE public.dna_recommendation_cache d
     SET recommendation = public.guard_recommendation(d.recommendation)
   WHERE public.guard_recommendation(d.recommendation) IS DISTINCT FROM d.recommendation;

  UPDATE public.shelf_recommendations s
     SET recommendations = public.guard_recommendation_list(s.recommendations)
   WHERE public.guard_recommendation_list(s.recommendations) IS DISTINCT FROM s.recommendations;
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_discovery_guardrails() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.discovery_blocklist_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  PERFORM public.refresh_discovery_guardrails();
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_discovery_blocklist_changed ON public.discovery_blocklist;
CREATE TRIGGER trg_discovery_blocklist_changed
  AFTER INSERT OR UPDATE OR DELETE ON public.discovery_blocklist
  FOR EACH STATEMENT EXECUTE FUNCTION public.discovery_blocklist_changed();

SELECT public.refresh_discovery_guardrails();

-- ------------------------------------------------- recommendation surfaces
-- "If you loved this shape": blocked books never appear as neighbours, a
-- blocked book gets no neighbours at all, the judged pick shown beside the
-- list can be excluded (p_exclude_titles) so it never appears twice, and
-- near-identical titles ('The Odyssey' / 'Odyssey') collapse to one row.
-- The distance itself is unchanged; see docs/dna-similarity.md.
DROP FUNCTION IF EXISTS public.get_dna_neighbours(text, text, jsonb, integer);
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
    SELECT public.book_norm_title(tr.title) AS t FROM target_row tr
    UNION
    SELECT public.book_norm_title(x) FROM unnest(coalesce(p_exclude_titles, ARRAY[]::text[])) AS x
  ),
  target AS (
    SELECT a.value->>'id' AS axis_id, (a.value->>'score')::numeric AS score
    FROM (SELECT COALESCE(p_axes, (SELECT axes FROM target_row)) AS axes) src
    CROSS JOIN LATERAL jsonb_array_elements(src.axes) a
    WHERE src.axes IS NOT NULL
      AND NOT coalesce((SELECT tr.discovery_blocked FROM target_row tr), false)
  ),
  pool AS (
    SELECT n.cache_key, n.title, n.author, n.slug, public.book_norm_title(n.title) AS norm,
           a.value->>'id' AS axis_id, (a.value->>'score')::numeric AS score
    FROM novel_analyses n
    CROSS JOIN LATERAL jsonb_array_elements(n.analysis->'dna'->'axes') a
    WHERE n.is_validated
      AND n.slug IS NOT NULL
      AND NOT n.discovery_blocked
      AND n.cache_key IS DISTINCT FROM p_cache_key
      AND public.book_norm_title(n.title) IS NOT NULL
      AND public.book_norm_title(n.title) NOT IN (SELECT e.t FROM excluded e WHERE e.t IS NOT NULL)
      AND (CASE WHEN n.analysis->>'bookType' = 'nonfiction' THEN 'nonfiction' ELSE 'fiction' END)
          = COALESCE(p_book_type, 'fiction')
  ),
  scored AS (
    SELECT p.cache_key, p.title, p.author, p.slug, p.norm,
           sqrt(sum(power(p.score - t.score, 2))) AS dist,
           count(*) AS n_axes,
           array_agg(p.axis_id ORDER BY abs(p.score - t.score))
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

-- Constellation anchors come from the canon join; exclude blocked rows anyway.
CREATE OR REPLACE FUNCTION public.get_constellation_anchor_candidates(p_book_type text)
RETURNS TABLE(cache_key text, title text, author text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
      AND NOT n.discovery_blocked
      AND n.analysis -> 'dna' -> 'axes' IS NOT NULL
  )
  SELECT DISTINCT na.cache_key, na.title, na.author
  FROM na
  JOIN cb ON cb.t = na.t AND cb.a = na.a
  WHERE p_book_type IS NULL OR na.kind = p_book_type;
$$;
