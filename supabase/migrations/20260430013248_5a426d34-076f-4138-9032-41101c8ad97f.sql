-- =====================================================================
-- P1: Reader overrides on Gemini's analysis (per-user, per-book)
-- =====================================================================
CREATE TABLE public.book_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  cache_key TEXT NOT NULL,
  -- axis_overrides: { "<axis_id>": <number 0..10>, ... }
  axis_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- theme_weights: { "<theme_label>": <number -1..1> } where >0 = stronger, <0 = weaker
  theme_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- character_ranks: { "<character_id>": <integer rank 1..N> } — user-pinned ordering
  character_ranks JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- alt_climax_event_id: which event the reader thinks is the real climax
  alt_climax_event_id TEXT,
  -- centered_character_id: "your protagonist" — drives the centering stat
  centered_character_id TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, cache_key)
);

ALTER TABLE public.book_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own overrides" ON public.book_overrides FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own overrides" ON public.book_overrides FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own overrides" ON public.book_overrides FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own overrides" ON public.book_overrides FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_book_overrides_user ON public.book_overrides(user_id);
CREATE INDEX idx_book_overrides_user_cache ON public.book_overrides(user_id, cache_key);

CREATE TRIGGER update_book_overrides_updated_at
  BEFORE UPDATE ON public.book_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- P2a: Reading status on shelf books
-- =====================================================================
ALTER TABLE public.shelf_books
  ADD COLUMN status TEXT NOT NULL DEFAULT 'finished'
    CHECK (status IN ('want', 'reading', 'finished')),
  ADD COLUMN finished_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN rating SMALLINT CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));

CREATE INDEX idx_shelf_books_user_status ON public.shelf_books(user_id, status);

-- =====================================================================
-- P2b: Shelf clusters (lassoed groupings on the constellation)
-- =====================================================================
CREATE TABLE public.shelf_clusters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  -- color: optional accent (hsl string or token name); UI may default
  color TEXT,
  -- centroid_x / centroid_y cached for quick render (computed client-side from members)
  centroid_x DOUBLE PRECISION,
  centroid_y DOUBLE PRECISION,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shelf_clusters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own clusters" ON public.shelf_clusters FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own clusters" ON public.shelf_clusters FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own clusters" ON public.shelf_clusters FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own clusters" ON public.shelf_clusters FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_shelf_clusters_user ON public.shelf_clusters(user_id);

CREATE TRIGGER update_shelf_clusters_updated_at
  BEFORE UPDATE ON public.shelf_clusters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Join table: which shelf_books belong to which cluster
CREATE TABLE public.shelf_cluster_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  cluster_id UUID NOT NULL REFERENCES public.shelf_clusters(id) ON DELETE CASCADE,
  shelf_book_id UUID NOT NULL REFERENCES public.shelf_books(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(cluster_id, shelf_book_id)
);

ALTER TABLE public.shelf_cluster_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own cluster members" ON public.shelf_cluster_members FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own cluster members" ON public.shelf_cluster_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own cluster members" ON public.shelf_cluster_members FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_cluster_members_cluster ON public.shelf_cluster_members(cluster_id);
CREATE INDEX idx_cluster_members_user ON public.shelf_cluster_members(user_id);

-- =====================================================================
-- P3a: Recommendation feedback (👍/👎 per recommended book)
-- =====================================================================
CREATE TABLE public.recommendation_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  -- rec_key: stable identifier for a recommended book — we'll use slugified "title|author"
  rec_key TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  signal SMALLINT NOT NULL CHECK (signal IN (-1, 1)),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, rec_key)
);

ALTER TABLE public.recommendation_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own feedback" ON public.recommendation_feedback FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own feedback" ON public.recommendation_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own feedback" ON public.recommendation_feedback FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own feedback" ON public.recommendation_feedback FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_rec_feedback_user ON public.recommendation_feedback(user_id);
CREATE INDEX idx_rec_feedback_user_signal ON public.recommendation_feedback(user_id, signal);

CREATE TRIGGER update_rec_feedback_updated_at
  BEFORE UPDATE ON public.recommendation_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- P3b: Persistent recommendation blocks (author or vibe-tag)
-- =====================================================================
CREATE TABLE public.recommendation_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  block_type TEXT NOT NULL CHECK (block_type IN ('author', 'tag')),
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, block_type, value)
);

ALTER TABLE public.recommendation_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own blocks" ON public.recommendation_blocks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own blocks" ON public.recommendation_blocks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own blocks" ON public.recommendation_blocks FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_rec_blocks_user ON public.recommendation_blocks(user_id);