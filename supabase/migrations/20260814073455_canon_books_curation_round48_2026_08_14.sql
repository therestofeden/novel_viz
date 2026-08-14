-- Round 48 (2026-08-14) canon curation backfill.
-- Guru Granth Sahib / Vasari's Lives / Pirandello's Six Characters / Milton's Areopagitica.
-- The Gulag Archipelago (Solzhenitsyn) was already seeded 2026-07-28 (id 754) despite
-- classic.ts never carrying it until this round -- skipped here, no duplicate needed.
INSERT INTO canon_books (title, author, source)
SELECT v.title, v.author, 'daily_agent_canon_backfill_2026_08_14'
FROM (VALUES
  ('Guru Granth Sahib', 'Guru Arjan Dev'),
  ('Adi Granth', 'Guru Arjan Dev'),
  ('Sri Guru Granth Sahib', 'Guru Arjan Dev'),
  ('Lives of the Most Excellent Painters, Sculptors, and Architects', 'Giorgio Vasari'),
  ('The Lives of the Artists', 'Giorgio Vasari'),
  ('Six Characters in Search of an Author', 'Luigi Pirandello'),
  ('Areopagitica', 'John Milton')
) AS v(title, author)
WHERE NOT EXISTS (
  SELECT 1 FROM canon_books cb WHERE cb.title = v.title AND cb.author = v.author
);
