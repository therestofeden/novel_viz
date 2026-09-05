-- Round 76 (2026-09-05): backfill seed_book_list ("Title by Author" entry
-- format, per the DB-backed migration of 2026-08-25) for the same 2 new
-- classic.ts additions, already confirmed absent.
INSERT INTO seed_book_list (entry)
SELECT v.entry
FROM (VALUES
  ('Fairy Tales Told for Children by Hans Christian Andersen'),
  ('Max Havelaar by Multatuli')
) AS v(entry)
WHERE NOT EXISTS (
  SELECT 1 FROM seed_book_list s WHERE s.entry = v.entry
);
