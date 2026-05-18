-- Server-side popularity-prefix cache for the search-books edge function.
-- Keyed by normalized query (lowercased + trimmed + collapsed whitespace).
-- TTL is enforced in code (we read with a freshness filter); a periodic purge keeps it small.

CREATE TABLE public.search_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query_key TEXT NOT NULL UNIQUE,
  results JSONB NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_search_cache_last_accessed ON public.search_cache(last_accessed_at DESC);

ALTER TABLE public.search_cache ENABLE ROW LEVEL SECURITY;

-- Public read so the edge function (or future client fallback) can hit it without service role.
-- Writes happen via service role from the edge function only — no client policy needed.
CREATE POLICY "search_cache is publicly readable"
  ON public.search_cache
  FOR SELECT
  USING (true);

-- Purge entries older than 24h. Called opportunistically from the edge function (~1% of requests).
CREATE OR REPLACE FUNCTION public.purge_old_search_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.search_cache
  WHERE last_accessed_at < now() - interval '24 hours';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;