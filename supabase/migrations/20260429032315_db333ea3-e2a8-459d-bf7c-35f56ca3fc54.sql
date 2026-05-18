CREATE TABLE public.novel_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  analysis JSONB NOT NULL,
  model TEXT NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_novel_analyses_cache_key ON public.novel_analyses(cache_key);
CREATE INDEX idx_novel_analyses_hit_count ON public.novel_analyses(hit_count DESC);

ALTER TABLE public.novel_analyses ENABLE ROW LEVEL SECURITY;

-- Public read: anyone can browse cached analyses (not user data)
CREATE POLICY "Cached analyses are publicly readable"
ON public.novel_analyses
FOR SELECT
USING (true);

-- No public INSERT/UPDATE/DELETE policies — only service role (which bypasses RLS) can write.
