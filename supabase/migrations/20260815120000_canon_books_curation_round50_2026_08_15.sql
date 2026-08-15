-- Canon curation round 50 (2026-08-15, second same-day pass): The Táin,
-- Code of Hammurabi, A Mathematical Theory of Communication (Shannon),
-- The Sceptical Chymist (Boyle), Fūshikaden (Zeami) + known aliases.
-- Guarded by WHERE NOT EXISTS so a re-run is a no-op.

INSERT INTO canon_books (title, author, source)
SELECT v.title, v.author, 'canon_books_curation_round50_2026_08_15'
FROM (VALUES
  ('The Táin', 'Anonymous'),
  ('Táin Bó Cúailnge', 'Anonymous'),
  ('The Cattle Raid of Cooley', 'Anonymous'),
  ('Code of Hammurabi', 'Hammurabi'),
  ('Hammurabi''s Code', 'Hammurabi'),
  ('A Mathematical Theory of Communication', 'Claude Shannon'),
  ('The Sceptical Chymist', 'Robert Boyle'),
  ('The Skeptical Chemist', 'Robert Boyle'),
  ('Fūshikaden', 'Zeami Motokiyo'),
  ('Fushikaden', 'Zeami Motokiyo'),
  ('Kadensho', 'Zeami Motokiyo')
) AS v(title, author)
WHERE NOT EXISTS (
  SELECT 1 FROM canon_books cb WHERE lower(cb.title) = lower(v.title)
);
