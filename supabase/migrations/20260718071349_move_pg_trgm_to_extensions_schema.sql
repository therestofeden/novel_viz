-- Move pg_trgm out of the public schema (2026-07-18 daily backend audit).
-- Supabase security advisor flags "Extension in Public" (WARN): extensions
-- installed in public share the namespace with application objects and are
-- writable by roles with CREATE on public. This project already keeps
-- pgcrypto, pg_stat_statements, and uuid-ossp in the standard "extensions"
-- schema (Supabase's own convention, and already on every role's default
-- search_path: "$user", public, extensions) — pg_trgm, added yesterday for
-- canon_books typo-tolerant search, was the only project extension left in
-- public. Confirmed via repo grep that the ONLY dependent object is
-- search_canon() (canon_books_typo_search / search_canon_threshold_tune
-- migrations) — a SECURITY DEFINER function that pins its own search_path,
-- so it must add "extensions" to that pin or it breaks the moment the
-- extension moves (SECURITY DEFINER functions don't inherit the caller's
-- or database's default search_path). No GIN trigram indexes exist yet
-- (canon_books is seq-scanned at 350 rows), so this is the only fix needed.

ALTER EXTENSION pg_trgm SET SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.search_canon(p_q text)
RETURNS TABLE (title text, author text, sim real)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
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
