-- Round 35 (2026-08-03, daily_novel_viz_feat): backfill canon_books against
-- the classic.ts curation pass (254->258), closing Portuguese/Nobel fiction,
-- second-wave feminist fiction, libertarian political philosophy, and
-- Schumpeterian economics gaps.
INSERT INTO canon_books (title, author, source)
SELECT v.title, v.author, 'daily_agent_canon_backfill_2026_08_03'
FROM (VALUES
  ('Blindness', 'José Saramago'),
  ('The Golden Notebook', 'Doris Lessing'),
  ('Anarchy, State, and Utopia', 'Robert Nozick'),
  ('Capitalism, Socialism and Democracy', 'Joseph Schumpeter')
) AS v(title, author)
WHERE NOT EXISTS (
  SELECT 1 FROM canon_books cb
  WHERE lower(cb.title) = lower(v.title) AND lower(cb.author) = lower(v.author)
);
