-- Tune search_canon (2026-07-17, same session as canon_books_typo_search):
-- word_similarity 0.40 let a wall of weak title noise (all exactly 0.40)
-- fill LIMIT 6 and crowd out a real author near-miss ("hoer" -> Homer at
-- similarity 0.375). Raise word_similarity gates to 0.42 and LIMIT to 8.
CREATE OR REPLACE FUNCTION public.search_canon(p_q text)
RETURNS TABLE (title text, author text, sim real)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    cb.title,
    cb.author,
    GREATEST(
      similarity(cb.title, p_q),
      similarity(cb.author, p_q),
      word_similarity(p_q, cb.title),
      word_similarity(p_q, cb.author)
    ) AS sim
  FROM public.canon_books cb
  WHERE similarity(cb.title, p_q) > 0.28
     OR similarity(cb.author, p_q) > 0.28
     OR word_similarity(p_q, cb.title) > 0.42
     OR word_similarity(p_q, cb.author) > 0.42
  ORDER BY sim DESC
  LIMIT 8;
$$;

REVOKE EXECUTE ON FUNCTION public.search_canon(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_canon(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.search_canon(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.search_canon(text) TO service_role;
