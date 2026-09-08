-- search_canon previously filtered with similarity(a,b) > threshold / word_similarity(a,b) > threshold
-- as raw function calls. Postgres's pg_trgm GIN indexes (idx_canon_books_title_trgm,
-- idx_canon_books_author_trgm) can only be matched to the %, <%, %> trigram operators,
-- never to a bare function-call comparison -- so this function was structurally
-- incapable of using either index at ANY table size, which is exactly why both show
-- up as "unused" in Supabase's performance advisor (canon_books currently 871 rows,
-- growing ~5/day via daily curation, see project memory).
--
-- Rewritten to use the % (similarity) and <% (word_similarity, same operand order as
-- the original word_similarity(p_q, col) calls -- verified empirically: 'cat' <% long
-- text matches word_similarity('cat', long_text), not the reverse) operators. The
-- 0.28 / 0.42 thresholds are pg_trgm session GUCs (pg_trgm.similarity_threshold /
-- pg_trgm.word_similarity_threshold); tried pinning them via the function's own SET
-- clause first but Supabase's migration role gets "permission denied to set
-- parameter" for that path, so switched from LANGUAGE sql to LANGUAGE plpgsql and set
-- them at runtime via set_config(..., true) (transaction-local, auto-reset), which is
-- an ordinary function call and not privilege-gated.
--
-- Verified before deploying: ran both the old (function-call) and new (operator) WHERE
-- clauses side by side across 12 test queries (typos, author-only, partial title, case
-- variants) covering 24 total matches -- zero rows differed either direction. Also
-- confirmed with enable_seqscan=off that the new form produces a BitmapOr over both
-- trgm indexes (not a plan error) -- the operators are genuinely index-eligible, not
-- just syntactically similar.
--
-- At the current row count Postgres's planner still (correctly) prefers a seq scan
-- over the index -- an 871-row table fits in ~13 pages, cheaper to scan directly than
-- pay index-scan overhead. This change has no measurable effect today. What it fixes
-- is that the query is now index-*eligible*: once canon_books grows past the point
-- where a bitmap index scan beats a seq scan (low thousands of rows, on current
-- growth pace roughly a year out), the planner will switch automatically with no
-- further code change. Under the old function-call form it could never have switched,
-- regardless of table size -- the two trgm indexes would have sat permanently unused.
CREATE OR REPLACE FUNCTION public.search_canon(p_q text)
RETURNS TABLE(title text, author text, sim real)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
  PERFORM set_config('pg_trgm.similarity_threshold', '0.28', true);
  PERFORM set_config('pg_trgm.word_similarity_threshold', '0.42', true);
  RETURN QUERY
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
    WHERE cb.title % p_q
       OR cb.author % p_q
       OR p_q <% cb.title
       OR p_q <% cb.author
    ORDER BY sim DESC
    LIMIT 8;
END;
$function$;
