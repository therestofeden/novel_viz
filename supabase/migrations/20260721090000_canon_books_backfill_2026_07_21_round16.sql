-- Backfill canon_books with 4 titles (+ 3 genuinely-distinct akas) that
-- classic.ts gained on 2026-07-21 (WWI fiction, a second Woolf work, a
-- linguistics/anthropology non-fiction pair, and the third angle of the
-- Holocaust-testimony triangle) but canon_books had not yet caught up to.
-- Mrs Dalloway (also new to classic.ts today) is deliberately excluded
-- here: already present in canon_books under source='novel_analyses'
-- (organic user search), confirmed via direct query before writing this
-- migration. Round 16 of the reconciliation practice established
-- 2026-07-19/07-20 (see memory: novelviz-book-coverage-strategy).
INSERT INTO public.canon_books (title, author, source)
SELECT v.title, v.author, 'daily_agent_canon_backfill_2026_07_21'
FROM (VALUES
  ('All Quiet on the Western Front', 'Erich Maria Remarque'),
  ('Im Westen nichts Neues', 'Erich Maria Remarque'),
  ('Course in General Linguistics', 'Ferdinand de Saussure'),
  ('Cours de linguistique générale', 'Ferdinand de Saussure'),
  ('Tristes Tropiques', 'Claude Lévi-Strauss'),
  ('Night', 'Elie Wiesel'),
  ('La Nuit', 'Elie Wiesel')
) AS v(title, author)
WHERE NOT EXISTS (
  SELECT 1 FROM public.canon_books cb
  WHERE cb.title = v.title AND cb.author = v.author
);
