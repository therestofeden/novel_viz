CREATE TABLE public.pinned_characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cache_key text NOT NULL,
  character_id text NOT NULL,
  character_name text NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, cache_key, character_id)
);

CREATE INDEX pinned_characters_user_book_idx
  ON public.pinned_characters (user_id, cache_key);

ALTER TABLE public.pinned_characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own pins"
  ON public.pinned_characters FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own pins"
  ON public.pinned_characters FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own pins"
  ON public.pinned_characters FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own pins"
  ON public.pinned_characters FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER pinned_characters_set_updated_at
  BEFORE UPDATE ON public.pinned_characters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();