-- Backfill canon_books for round 43 of daily-must-read-and-classic curation
-- (Canzoniere/Petrarch, Gitanjali/Tagore, Requiem/Akhmatova, Wallenstein/Schiller,
-- The Collected Poems of W.B. Yeats) — 5 primaries + 3 genuinely-distinct akas.
INSERT INTO canon_books (title, author, source)
SELECT v.title, v.author, 'classic_daily_curation_round43_2026_08_09'
FROM (VALUES
  ('Canzoniere', 'Petrarch'),
  ('Rerum vulgarium fragmenta', 'Petrarch'),
  ('Sonnets to Laura', 'Petrarch'),
  ('Gitanjali', 'Rabindranath Tagore'),
  ('Song Offerings', 'Rabindranath Tagore'),
  ('Requiem', 'Anna Akhmatova'),
  ('Rekviem', 'Anna Akhmatova'),
  ('Wallenstein', 'Friedrich Schiller'),
  ('The Collected Poems of W.B. Yeats', 'W.B. Yeats')
) AS v(title, author)
WHERE NOT EXISTS (
  SELECT 1 FROM canon_books cb WHERE lower(cb.title) = lower(v.title)
);
