-- Round 42 (2026-08-08, second same-day daily curation pass): backfill
-- canon_books for the 2 of 5 new classic.ts titles NOT already present.
-- Macbeth, The Castle (Kafka), and Thus Spoke Zarathustra were already in
-- canon_books (source classics_tier) despite never being in classic.ts
-- until this round — canon_books is a broader, separately-seeded
-- search-boost table that doesn't 1:1 mirror the hand-curated editorial
-- lists (see project memory). Only Kalevala and Popol Vuh needed inserting.
INSERT INTO canon_books (title, author, source)
SELECT v.title, v.author, 'classics_tier'
FROM (VALUES
  ('The Kalevala', 'Anonymous'),
  ('Kalevala', 'Anonymous'),
  ('Popol Vuh', 'Anonymous'),
  ('Popol Wuj', 'Anonymous')
) AS v(title, author)
WHERE NOT EXISTS (
  SELECT 1 FROM canon_books cb
  WHERE lower(cb.title) = lower(v.title) AND lower(cb.author) = lower(v.author)
);
