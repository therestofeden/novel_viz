-- Round 24 (2026-07-29, daily_novel_viz_feat): backfill canon_books with 9 gaps
-- found via a full classic.ts+must-read.ts vs canon_books diff (325 titles checked,
-- normalized-title/author matching with substring fallback). 6 are pre-existing
-- classic.ts entries (Red Sorghum, Elements, Principia, Enchiridion, Letters from a
-- Stoic, Theory of the Leisure Class) that were never backfilled in earlier rounds;
-- 3 are today's new classic.ts additions (Waste Land, A Theory of Justice, Logic of
-- Scientific Discovery). Also add "Capital, Volume I" as an additional title-alias
-- row for Marx alongside the existing "Das Kapital" row, since classic.ts's own
-- title string for the same work differs from the row already in canon_books and
-- search-books' canon-boost matches on literal title text.
INSERT INTO canon_books (title, author, source)
SELECT v.title, v.author, 'daily_agent_canon_backfill_2026_07_29'
FROM (VALUES
  ('Red Sorghum', 'Mo Yan'),
  ('Elements', 'Euclid'),
  ('The Principia', 'Isaac Newton'),
  ('The Enchiridion', 'Epictetus'),
  ('Letters from a Stoic', 'Seneca'),
  ('The Theory of the Leisure Class', 'Thorstein Veblen'),
  ('The Waste Land', 'T.S. Eliot'),
  ('A Theory of Justice', 'John Rawls'),
  ('The Logic of Scientific Discovery', 'Karl Popper'),
  ('Capital, Volume I', 'Karl Marx')
) AS v(title, author)
WHERE NOT EXISTS (
  SELECT 1 FROM canon_books cb
  WHERE lower(cb.title) = lower(v.title) AND lower(cb.author) = lower(v.author)
);
