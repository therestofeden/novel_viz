-- 2026-09-08: search_canon compared p_q against cb.title/cb.author as raw
-- text, so any canon row with a diacritic (Gödel, Márquez's less-famous
-- works, Kierkegaard's ø, Brontë, Schrödinger, Molière, Saramago, etc. —
-- ~50 rows across ~30 authors) silently failed to match the plain-ASCII
-- spelling most users type on a US keyboard. Confirmed live: search_canon('godel')
-- returned zero rows (word_similarity('godel','Kurt Gödel')=0.33, below the
-- 0.42 threshold; the missing umlaut alone was enough to sink it), and this
-- wasn't masked by Open Library fallback the way it was for e.g. "marquez"
-- (OL has rich cataloging for One Hundred Years of Solitude but sparse
-- cataloging for a 1931 technical logic paper), so search-books returned
-- zero results end-to-end for "godel incompleteness" / "godel" alone.
-- Fix: install unaccent (Postgres contrib, ASCII-folds combining marks —
-- same effect as search-books.ts's own normalizeForSearch NFD-strip, just
-- applied server-side) and fold both sides of every comparison with it.
create extension if not exists unaccent with schema extensions;

create or replace function public.search_canon(p_q text)
returns table(title text, author text, sim real)
language plpgsql
stable security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
BEGIN
  PERFORM set_config('pg_trgm.similarity_threshold', '0.28', true);
  PERFORM set_config('pg_trgm.word_similarity_threshold', '0.42', true);
  RETURN QUERY
    SELECT
      cb.title,
      cb.author,
      GREATEST(
        similarity(unaccent(cb.title), unaccent(p_q)),
        similarity(unaccent(cb.author), unaccent(p_q)),
        word_similarity(unaccent(p_q), unaccent(cb.title)),
        word_similarity(unaccent(p_q), unaccent(cb.author))
      ) AS sim
    FROM public.canon_books cb
    WHERE unaccent(cb.title) % unaccent(p_q)
       OR unaccent(cb.author) % unaccent(p_q)
       OR unaccent(p_q) <% unaccent(cb.title)
       OR unaccent(p_q) <% unaccent(cb.author)
    ORDER BY sim DESC
    LIMIT 8;
END;
$function$;
