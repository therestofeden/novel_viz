-- Round 75 (2026-09-04): O'Connor's two titles (Wise Blood, A Good Man Is
-- Hard to Find) were already present in seed_book_list from an earlier,
-- independent addition -- only the 3 remaining round-75 titles are new here.
INSERT INTO seed_book_list (entry)
SELECT v.entry
FROM (VALUES
  ('The Wonderful Adventures of Nils by Selma Lagerlöf'),
  ('The General of the Dead Army by Ismail Kadare'),
  ('Quo Vadis by Henryk Sienkiewicz')
) AS v(entry)
WHERE NOT EXISTS (
  SELECT 1 FROM seed_book_list s WHERE lower(s.entry) = lower(v.entry)
);
