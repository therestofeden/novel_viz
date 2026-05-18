-- =========================================================================
-- PHASE 0: Shelf foundations
-- =========================================================================

-- ----- helper: updated_at trigger fn (idempotent) ------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ----- profiles ----------------------------------------------------------
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT,
  handle        TEXT UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----- shelves -----------------------------------------------------------
CREATE TABLE public.shelves (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'My Shelf',
  is_default  BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shelves_user ON public.shelves(user_id);

ALTER TABLE public.shelves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own shelves"
  ON public.shelves FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert their own shelves"
  ON public.shelves FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own shelves"
  ON public.shelves FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete their own shelves"
  ON public.shelves FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_shelves_updated_at
  BEFORE UPDATE ON public.shelves
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----- shelf_books -------------------------------------------------------
-- Note: cache_key is a soft reference to novel_analyses.cache_key.
-- We deliberately do NOT use a hard FK so users can save a book even if
-- the cache row is later wiped/regenerated — title/author keep it usable.
CREATE TABLE public.shelf_books (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shelf_id    UUID NOT NULL REFERENCES public.shelves(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cache_key   TEXT NOT NULL,
  title       TEXT NOT NULL,
  author      TEXT NOT NULL DEFAULT '',
  position    INTEGER NOT NULL DEFAULT 0,
  note        TEXT,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shelf_id, cache_key)
);

CREATE INDEX idx_shelf_books_shelf ON public.shelf_books(shelf_id);
CREATE INDEX idx_shelf_books_user  ON public.shelf_books(user_id);
CREATE INDEX idx_shelf_books_cache ON public.shelf_books(cache_key);

ALTER TABLE public.shelf_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own shelf books"
  ON public.shelf_books FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert their own shelf books"
  ON public.shelf_books FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own shelf books"
  ON public.shelf_books FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete their own shelf books"
  ON public.shelf_books FOR DELETE USING (auth.uid() = user_id);

-- ----- pca_basis ---------------------------------------------------------
-- Immutable, versioned. Stores the 12-axis order, the 2x12 projection
-- matrix, the per-axis means used for centering, the seed corpus list
-- (for transparency), and human-readable axis labels.
CREATE TABLE public.pca_basis (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version         INTEGER NOT NULL UNIQUE,
  axis_order      JSONB NOT NULL,    -- e.g. ["interiority", "plot_density", ...]
  means           JSONB NOT NULL,    -- length-12 array of axis means
  components      JSONB NOT NULL,    -- 2x12 matrix [[...], [...]]
  x_axis_label    TEXT NOT NULL DEFAULT 'PC1',
  y_axis_label    TEXT NOT NULL DEFAULT 'PC2',
  seed_corpus     JSONB NOT NULL,    -- [{title, author, cache_key}, ...]
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pca_basis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PCA basis is publicly readable"
  ON public.pca_basis FOR SELECT USING (true);
-- No insert/update/delete policies → only service role can write.

-- ----- new-user trigger: create profile + default shelf ------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_name TEXT;
BEGIN
  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, v_display_name);

  INSERT INTO public.shelves (user_id, name, is_default)
  VALUES (NEW.id, 'My Shelf', true);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
