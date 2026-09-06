-- Round 78 (2026-09-06): backfill seed_book_list ("Title by Author" entry
-- format) for the same 5 new classic.ts additions (4 this round + the
-- concurrent session's Secret History of the Mongols), already confirmed
-- absent.
INSERT INTO seed_book_list (entry)
SELECT v.entry
FROM (VALUES
  ('The Incoherence of the Incoherence by Averroes'),
  ('A Tale of Love and Darkness by Amos Oz'),
  ('Too Loud a Solitude by Bohumil Hrabal'),
  ('The Great Enigma by Tomas Tranströmer'),
  ('The Secret History of the Mongols by Anonymous')
) AS v(entry)
WHERE NOT EXISTS (
  SELECT 1 FROM seed_book_list s WHERE s.entry = v.entry
);
