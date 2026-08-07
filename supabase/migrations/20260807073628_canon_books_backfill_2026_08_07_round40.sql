-- Round 40 (2026-08-07) daily canon curation backfill.
-- 5 new classic.ts titles (Li Bai, Omar Khayyam, Langston Hughes, Lorca, Avicenna)
-- + genuinely-distinct akas (romanizations/alternate titles actually used in search).
INSERT INTO canon_books (title, author, source)
SELECT v.title, v.author, 'classic_daily_curation_round40_2026_08_07'
FROM (VALUES
  ('Selected Poems of Li Bai', 'Li Bai'),
  ('Selected Poems of Li Po', 'Li Po'),
  ('The Rubaiyat of Omar Khayyam', 'Omar Khayyam'),
  ('Rubaiyat of Omar Khayyam', 'Omar Khayyam'),
  ('The Weary Blues', 'Langston Hughes'),
  ('Gypsy Ballads', 'Federico García Lorca'),
  ('Romancero Gitano', 'Federico García Lorca'),
  ('The Canon of Medicine', 'Avicenna'),
  ('The Canon of Medicine', 'Ibn Sina')
) AS v(title, author)
WHERE NOT EXISTS (
  SELECT 1 FROM canon_books cb
  WHERE lower(cb.title) = lower(v.title) AND lower(cb.author) = lower(v.author)
);
