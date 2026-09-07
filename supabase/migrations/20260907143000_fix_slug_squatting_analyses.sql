-- Fix mislabelled analyses squatting canonical /book/ slugs (2026-09-07)
--
-- Found while preparing what was meant to be a simple "backfill author from
-- canon_books" pass over the 8 rows where novel_analyses.author disagreed with
-- canon_books.author. That backfill would have been actively harmful: the rows
-- do not share one cause, and for three of them the AUTHOR IS CORRECT and the
-- analysis is simply of a different work than its slug claims.
--
--   /book/the-stranger            -> Mark Twain's "The Mysterious Stranger"
--                                    (Eseldorf, Theodor Fischer, Satan) —
--                                    NOT Camus. Renaming the author to Camus
--                                    would have published Twain's plot under
--                                    Camus's title.
--   /book/the-master-and-margarita-> Edward Kemp's 2004 stage adaptation.
--                                    Author correct; the canonical slug is
--                                    wrong. An honest twin of the same
--                                    analysis already lives at
--                                    .../-edward-kemp-stage-adaptation.
--   /book/1984                    -> a graded-reader adaptation ("Textbooks
--                                    for foreign speakers", 3 characters).
--                                    Left alone here — see the note at the end.
--
-- Only ONE of the eight was a genuine metadata-only error (Love in the Time of
-- Cholera, attributed to the film's director). Three others were merely verbose
-- but accurate ("Leo Tolstoy (Translator: Louise Maude)") and are left as-is.
--
-- Verified before applying: no shelf_books rows reference any affected
-- cache_key, the target slug was free, and the Kemp twin is validated+slugged.
-- cache_key is deliberately NOT changed anywhere here — it is referenced by
-- book_dna_consensus and shelf_books and is an opaque lookup key, not a label.

-- 1. Genuine metadata-only fix: Mike Newell directed the film; the analysis
--    itself is unmistakably the novel (Florentino Ariza, Fermina Daza).
UPDATE novel_analyses
SET author   = 'Gabriel García Márquez',
    analysis = jsonb_set(analysis, '{author}', '"Gabriel García Márquez"'::jsonb)
WHERE cache_key = 'v3|love in the time of cholera||mike newell';

-- 2. Relabel rather than delete: the analysis is valid Twain, just mis-titled.
--    This also frees /book/the-stranger for the real Camus novel, which is not
--    yet cached (the new "Map this book" CTA will fill it).
UPDATE novel_analyses
SET title    = 'The Mysterious Stranger',
    slug     = 'the-mysterious-stranger',
    analysis = jsonb_set(analysis, '{title}', '"The Mysterious Stranger"'::jsonb)
WHERE cache_key = 'v3|the stranger||mark twain';

-- 3. Free the canonical slug; the identical analysis keeps its honest slug, so
--    no content is lost. Row stays validated and reachable by cache_key.
UPDATE novel_analyses
SET slug = NULL
WHERE cache_key = 'v3|the master and margarita||edward kemp';

-- 4. canon_books held TWO "The Brothers Karamazov" rows — id 87 with the
--    correct Latin spelling and id 228 spelling the forename with a Cyrillic
--    'ё' ("Fёdor Mikhaylovich Dostoyevsky"). The mixed-script duplicate evaded
--    the 2026-08-18 dedupe unique index because the author string differs, and
--    it is what made this book show up as an author "mismatch" at all.
DELETE FROM canon_books
WHERE title = 'The Brothers Karamazov'
  AND author = 'Fёdor Mikhaylovich Dostoyevsky';

-- NOT fixed here, needs a product call: /book/1984 still serves the
-- graded-reader adaptation, and unlike the Kemp case it has no honest twin to
-- fall back on, so freeing the slug would 404 a canonical URL until someone
-- maps the real Orwell. Left in place deliberately rather than guessed at.
