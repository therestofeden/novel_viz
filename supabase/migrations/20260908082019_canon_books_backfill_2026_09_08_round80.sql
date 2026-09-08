-- Round 80 (2026-09-08, daily-must-read-and-classic): backfill canon_books
-- for the 4 titles added to classic.ts this round (Peirce, Gödel, Boas,
-- Piaget). Primaries + one genuinely-distinct aka each for Gödel (shortened
-- title) and Piaget (alternate English translation title); skipped
-- article-stripped near-duplicates per the established convention.

INSERT INTO canon_books (title, author, source)
SELECT v.title, v.author, 'daily_agent_canon_backfill_2026_09_08_round80'
FROM (VALUES
  ('How to Make Our Ideas Clear', 'Charles Sanders Peirce'),
  ('On Formally Undecidable Propositions of Principia Mathematica and Related Systems', 'Kurt Gödel'),
  ('On Formally Undecidable Propositions', 'Kurt Gödel'),
  ('The Mind of Primitive Man', 'Franz Boas'),
  ('The Origins of Intelligence in Children', 'Jean Piaget'),
  ('The Origin of Intelligence in the Child', 'Jean Piaget')
) AS v(title, author)
WHERE NOT EXISTS (
  SELECT 1 FROM canon_books cb
  WHERE cb.title = v.title AND cb.author = v.author
);

INSERT INTO seed_book_list (entry)
SELECT v.entry
FROM (VALUES
  ('How to Make Our Ideas Clear by Charles Sanders Peirce'),
  ('On Formally Undecidable Propositions of Principia Mathematica and Related Systems by Kurt Gödel'),
  ('The Mind of Primitive Man by Franz Boas'),
  ('The Origins of Intelligence in Children by Jean Piaget')
) AS v(entry)
WHERE NOT EXISTS (
  SELECT 1 FROM seed_book_list sbl WHERE sbl.entry = v.entry
);
