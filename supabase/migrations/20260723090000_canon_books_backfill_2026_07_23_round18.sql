-- Backfill canon_books with the 6 titles (+ 2 genuinely-distinct aka rows)
-- classic.ts gained on 2026-07-23 (detective fiction's founding two, scientific
-- romance's founding two, and children's/fable literature's founding two) but
-- canon_books had not yet caught up to. Confirmed via direct query before
-- writing this migration: none of these titles/authors existed under any
-- source (organic novel_analyses or prior backfill rounds). Round 18 of the
-- reconciliation practice established 2026-07-19/07-20/07-21/07-22 (see
-- memory: novelviz-book-coverage-strategy).
INSERT INTO public.canon_books (title, author, source)
SELECT v.title, v.author, 'daily_agent_canon_backfill_2026_07_23'
FROM (VALUES
  ('The Murders in the Rue Morgue', 'Edgar Allan Poe'),
  ('The Adventures of Sherlock Holmes', 'Arthur Conan Doyle'),
  ('Twenty Thousand Leagues Under the Sea', 'Jules Verne'),
  ('The Time Machine', 'H.G. Wells'),
  ('Alice''s Adventures in Wonderland', 'Lewis Carroll'),
  ('Alice in Wonderland', 'Lewis Carroll'),
  ('The Little Prince', 'Antoine de Saint-Exupéry'),
  ('Le Petit Prince', 'Antoine de Saint-Exupéry')
) AS v(title, author)
WHERE NOT EXISTS (
  SELECT 1 FROM public.canon_books cb
  WHERE cb.title = v.title AND cb.author = v.author
);
