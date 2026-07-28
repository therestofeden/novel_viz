-- Round 23 (2026-07-28, daily_novel_viz_feat): backfill canon_books with 14
-- widely-taught classics (novels + non-fiction) found missing via a targeted
-- gap-check against Bloom/Britannica-tier staples not yet in the table.
INSERT INTO canon_books (title, author, source)
SELECT v.title, v.author, 'daily_agent_canon_backfill_2026_07_28'
FROM (VALUES
  ('Cosmos', 'Carl Sagan'),
  ('Common Sense', 'Thomas Paine'),
  ('Bleak House', 'Charles Dickens'),
  ('Civil Disobedience', 'Henry David Thoreau'),
  ('The Gulag Archipelago', 'Aleksandr Solzhenitsyn'),
  ('Demons', 'Fyodor Dostoevsky'),
  ('A People''s History of the United States', 'Howard Zinn'),
  ('The Waves', 'Virginia Woolf'),
  ('Das Kapital', 'Karl Marx'),
  ('Labyrinths', 'Jorge Luis Borges'),
  ('The Structure of Scientific Revolutions', 'Thomas Kuhn'),
  ('Civilization and Its Discontents', 'Sigmund Freud'),
  ('The Origin of Species', 'Charles Darwin'),
  ('The Bluest Eye', 'Toni Morrison')
) AS v(title, author)
WHERE NOT EXISTS (
  SELECT 1 FROM canon_books cb
  WHERE lower(cb.title) = lower(v.title) AND lower(cb.author) = lower(v.author)
);
