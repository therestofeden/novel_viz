-- Per-user, per-shelf-state cached recommendations.
-- Frozen until the user explicitly regenerates.

CREATE TABLE public.shelf_recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  shelf_signature TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('similar', 'stretch')),
  recommendations JSONB NOT NULL,
  source_titles JSONB NOT NULL DEFAULT '[]'::jsonb,
  model TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, shelf_signature, mode)
);

ALTER TABLE public.shelf_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own recommendations"
  ON public.shelf_recommendations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own recommendations"
  ON public.shelf_recommendations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own recommendations"
  ON public.shelf_recommendations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete their own recommendations"
  ON public.shelf_recommendations FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_shelf_recs_lookup
  ON public.shelf_recommendations (user_id, shelf_signature, mode);
