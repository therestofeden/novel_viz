-- Round 75 (2026-09-04): backfill canon_books for the 4 national-literature-gap
-- additions to classic.ts this round (Lagerlöf/Sweden, O'Connor/American
-- Southern Gothic, Kadare/Albania, Sienkiewicz/Poland).
INSERT INTO canon_books (title, author, source)
SELECT v.title, v.author, 'daily_canon_curation_round75'
FROM (VALUES
  ('The Wonderful Adventures of Nils', 'Selma Lagerlöf'),
  ('Nils Holgerssons underbara resa genom Sverige', 'Selma Lagerlöf'),
  ('A Good Man Is Hard to Find', 'Flannery O''Connor'),
  ('The General of the Dead Army', 'Ismail Kadare'),
  ('Gjenerali i ushtrisë së vdekur', 'Ismail Kadare'),
  ('Quo Vadis', 'Henryk Sienkiewicz')
) AS v(title, author)
WHERE NOT EXISTS (
  SELECT 1 FROM canon_books cb
  WHERE lower(cb.title) = lower(v.title) AND lower(cb.author) = lower(v.author)
);
