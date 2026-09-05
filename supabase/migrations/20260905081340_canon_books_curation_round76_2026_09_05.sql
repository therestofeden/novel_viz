-- Round 76 (2026-09-05, scheduled daily-must-read-and-classic task):
-- backfill canon_books for the 2 titles added to classic.ts this round
-- (Hans Christian Andersen's Fairy Tales Told for Children / Denmark,
-- Multatuli's Max Havelaar / Netherlands) — both confirmed absent from
-- canon_books first. Primaries + genuinely-distinct akas only (original-
-- language titles and the full historical English title), skipping
-- near-duplicate subtitle variants, per the established convention.
INSERT INTO canon_books (title, author, source)
SELECT v.title, v.author, 'daily_agent_canon_backfill_2026_09_05'
FROM (VALUES
  ('Fairy Tales Told for Children', 'Hans Christian Andersen'),
  ('Eventyr, fortalte for børn', 'Hans Christian Andersen'),
  ('Andersen''s Fairy Tales', 'Hans Christian Andersen'),
  ('Max Havelaar', 'Multatuli'),
  ('Max Havelaar, of de koffiveilingen der Nederlandsche Handel-Maatschappy', 'Multatuli'),
  ('Max Havelaar; or, The Coffee Auctions of the Dutch Trading Company', 'Multatuli')
) AS v(title, author)
WHERE NOT EXISTS (
  SELECT 1 FROM canon_books cb
  WHERE cb.title = v.title AND cb.author = v.author
);
