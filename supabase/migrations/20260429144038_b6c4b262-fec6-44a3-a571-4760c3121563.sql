-- 1. Add is_validated flag
ALTER TABLE public.novel_analyses
  ADD COLUMN is_validated boolean NOT NULL DEFAULT false;

UPDATE public.novel_analyses SET is_validated = true;

-- 2. Cache key shape: bounded length + Unicode-letter-aware charset
-- Allows any letter/mark (Latin accents, Hangul, CJK, etc.), digits, spaces, and common punctuation including '||'
ALTER TABLE public.novel_analyses
  ADD CONSTRAINT novel_analyses_cache_key_shape
  CHECK (
    char_length(cache_key) BETWEEN 3 AND 160
    AND cache_key ~ '^[[:alnum:][:space:][:alpha:]''\-\.,:;&!?\(\)\|]+$'
  );

-- 3. Partial index for the hot read path
CREATE INDEX IF NOT EXISTS novel_analyses_cache_key_validated_idx
  ON public.novel_analyses (cache_key)
  WHERE is_validated = true;