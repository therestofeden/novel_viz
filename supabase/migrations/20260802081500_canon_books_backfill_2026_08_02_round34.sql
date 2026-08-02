-- Round 34 (2026-08-02, daily_novel_viz_feat): backfill canon_books against
-- the classic.ts curation pass (250->254), closing political-philosophy,
-- French sociology, linguistics/cognitive-science, and Chicago-School
-- economics gaps.
INSERT INTO canon_books (title, author, source)
SELECT v.title, v.author, 'daily_agent_canon_backfill_2026_08_02'
FROM (VALUES
  ('Reflections on the Revolution in France', 'Edmund Burke'),
  ('Distinction', 'Pierre Bourdieu'),
  ('Syntactic Structures', 'Noam Chomsky'),
  ('Capitalism and Freedom', 'Milton Friedman')
) AS v(title, author)
WHERE NOT EXISTS (
  SELECT 1 FROM canon_books cb
  WHERE lower(cb.title) = lower(v.title) AND lower(cb.author) = lower(v.author)
);
