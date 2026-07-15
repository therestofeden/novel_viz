-- ============================================================================
-- Part 1: rating/status consistency
-- A rating with no "finished" status is a stale/orphaned state — e.g. a
-- reader rates a book, then cycles status back to "reading" or "want" (misclick
-- or genuine re-read), and the old rating silently persisted in the DB with
-- no UI to see or clear it. Enforced two ways so this can never regress:
--   1. CHECK constraint — rating can only be non-null when status='finished'.
--   2. BEFORE trigger — auto-clears rating the instant status leaves
--      'finished', so client code never has to remember to do it (defense
--      in depth alongside the Shelf.tsx / ShelfChip.tsx client-side clears).
-- ============================================================================

ALTER TABLE public.shelf_books DROP CONSTRAINT IF EXISTS shelf_books_rating_check;
ALTER TABLE public.shelf_books
  ADD CONSTRAINT shelf_books_rating_check
  CHECK (rating IS NULL OR (status = 'finished' AND rating >= 0 AND rating <= 10));

CREATE OR REPLACE FUNCTION public.clear_rating_on_unfinish()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'finished' AND NEW.rating IS NOT NULL THEN
    NEW.rating := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_rating_on_unfinish ON public.shelf_books;
CREATE TRIGGER trg_clear_rating_on_unfinish
  BEFORE INSERT OR UPDATE ON public.shelf_books
  FOR EACH ROW EXECUTE FUNCTION public.clear_rating_on_unfinish();

-- ============================================================================
-- Part 2: cached, cross-user per-book rating distribution
-- shelf_books is RLS'd to each user's own rows (auth.uid() = user_id, see
-- 20260702000000) — by design, so nobody can query "what did every other
-- reader rate this book." That means a per-book distribution chart can't be
-- computed with a live client-side query; it has to be maintained
-- server-side. This table holds only rounded aggregate counts (never
-- who-rated-what), so it's safe to expose publicly.
-- ============================================================================

CREATE TABLE public.book_rating_stats (
  cache_key     TEXT PRIMARY KEY,
  title         TEXT NOT NULL DEFAULT '',
  author        TEXT NOT NULL DEFAULT '',
  -- {"0": 2, "1": 0, ..., "10": 5} — only ratings present are keyed.
  rating_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_ratings INTEGER NOT NULL DEFAULT 0,
  avg_rating    NUMERIC(4,2),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.book_rating_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Book rating stats are publicly readable"
  ON public.book_rating_stats FOR SELECT USING (true);
-- No insert/update/delete policies for anon/authenticated — only the
-- SECURITY DEFINER trigger function below writes to this table.

CREATE OR REPLACE FUNCTION public.refresh_book_rating_stats(p_cache_key TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title   TEXT;
  v_author  TEXT;
  v_counts  JSONB;
  v_total   INTEGER;
  v_avg     NUMERIC(4,2);
BEGIN
  SELECT COALESCE(jsonb_object_agg(rating::text, cnt), '{}'::jsonb), COALESCE(SUM(cnt), 0)
  INTO v_counts, v_total
  FROM (
    SELECT rating, COUNT(*) AS cnt
    FROM public.shelf_books
    WHERE cache_key = p_cache_key AND rating IS NOT NULL
    GROUP BY rating
  ) t;

  IF v_total = 0 THEN
    DELETE FROM public.book_rating_stats WHERE cache_key = p_cache_key;
    RETURN;
  END IF;

  SELECT ROUND(AVG(rating)::numeric, 2)
  INTO v_avg
  FROM public.shelf_books
  WHERE cache_key = p_cache_key AND rating IS NOT NULL;

  SELECT title, author INTO v_title, v_author
  FROM public.shelf_books
  WHERE cache_key = p_cache_key
  ORDER BY added_at DESC
  LIMIT 1;

  INSERT INTO public.book_rating_stats (cache_key, title, author, rating_counts, total_ratings, avg_rating, updated_at)
  VALUES (p_cache_key, COALESCE(v_title, ''), COALESCE(v_author, ''), v_counts, v_total, v_avg, now())
  ON CONFLICT (cache_key) DO UPDATE SET
    title         = EXCLUDED.title,
    author        = EXCLUDED.author,
    rating_counts = EXCLUDED.rating_counts,
    total_ratings = EXCLUDED.total_ratings,
    avg_rating    = EXCLUDED.avg_rating,
    updated_at    = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_shelf_books_rating_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_book_rating_stats(OLD.cache_key);
    RETURN OLD;
  END IF;

  PERFORM public.refresh_book_rating_stats(NEW.cache_key);
  IF TG_OP = 'UPDATE' AND OLD.cache_key IS DISTINCT FROM NEW.cache_key THEN
    PERFORM public.refresh_book_rating_stats(OLD.cache_key);
  END IF;
  RETURN NEW;
END;
$$;

-- Fires on insert/delete (a rated row can appear/disappear entirely) and on
-- update of rating, status, or cache_key (rating changes AND, via the Part 1
-- trigger, status leaving 'finished' both touch `rating`, so this alone
-- covers both consistency paths without a second trigger).
DROP TRIGGER IF EXISTS trg_shelf_books_rating_stats ON public.shelf_books;
CREATE TRIGGER trg_shelf_books_rating_stats
  AFTER INSERT OR DELETE OR UPDATE OF rating, status, cache_key ON public.shelf_books
  FOR EACH ROW EXECUTE FUNCTION public.trg_shelf_books_rating_stats();

CREATE INDEX IF NOT EXISTS idx_book_rating_stats_total ON public.book_rating_stats(total_ratings);
