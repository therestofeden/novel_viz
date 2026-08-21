-- Round 58 daily canon curation (2026-08-22): five titles closing five
-- gaps in classic.ts (Heian-era Japanese court prose, Greek cosmogony,
-- German Romanticism, Indian fable literature, Roman prose fiction). See
-- src/lib/classic.ts round-58 comment block for full rationale. Theogony
-- and Satyricon get only one row each -- the unique index normalizes away
-- leading "The", so "The Theogony"/"The Satyricon" would collide with
-- the bare title.

INSERT INTO canon_books (title, author, source)
SELECT 'The Pillow Book', 'Sei Shonagon', 'daily_agent_canon_backfill_2026_08_22'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'The Pillow Book' AND author ILIKE 'Sei Shonagon');

INSERT INTO canon_books (title, author, source)
SELECT 'Makura no Soshi', 'Sei Shonagon', 'daily_agent_canon_backfill_2026_08_22'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'Makura no Soshi' AND author ILIKE 'Sei Shonagon');

INSERT INTO canon_books (title, author, source)
SELECT 'Theogony', 'Hesiod', 'daily_agent_canon_backfill_2026_08_22'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'Theogony' AND author ILIKE 'Hesiod');

INSERT INTO canon_books (title, author, source)
SELECT 'The Sorrows of Young Werther', 'Johann Wolfgang von Goethe', 'daily_agent_canon_backfill_2026_08_22'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'The Sorrows of Young Werther' AND author ILIKE 'Johann Wolfgang von Goethe');

INSERT INTO canon_books (title, author, source)
SELECT 'Die Leiden des jungen Werthers', 'Johann Wolfgang von Goethe', 'daily_agent_canon_backfill_2026_08_22'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'Die Leiden des jungen Werthers' AND author ILIKE 'Johann Wolfgang von Goethe');

INSERT INTO canon_books (title, author, source)
SELECT 'Panchatantra', 'Vishnu Sharma', 'daily_agent_canon_backfill_2026_08_22'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'Panchatantra' AND author ILIKE 'Vishnu Sharma');

INSERT INTO canon_books (title, author, source)
SELECT 'The Fables of Bidpai', 'Vishnu Sharma', 'daily_agent_canon_backfill_2026_08_22'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'The Fables of Bidpai' AND author ILIKE 'Vishnu Sharma');

INSERT INTO canon_books (title, author, source)
SELECT 'Satyricon', 'Petronius', 'daily_agent_canon_backfill_2026_08_22'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'Satyricon' AND author ILIKE 'Petronius');
