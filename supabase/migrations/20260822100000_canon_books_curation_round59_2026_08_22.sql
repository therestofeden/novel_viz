-- Round 59 daily canon curation (2026-08-22): five titles closing five
-- gaps in classic.ts (English tragic drama, French Renaissance comic
-- fiction, Enlightenment empiricist epistemology, Italian Renaissance
-- epic, and Freud's second entry on culture/civilization). See
-- src/lib/classic.ts round-59 comment block for full rationale. "An Essay
-- Concerning Human Understanding" gets only one row -- the unique index
-- normalizes away leading "An", so a de-articled alt ("Essay Concerning
-- Human Understanding") would collide with the bare title. Two of the
-- WHERE NOT EXISTS guards below turned out to be no-ops on apply: bare
-- "Othello" and bare "Civilization and Its Discontents" were already
-- present in canon_books (a search-boost list distinct from classic.ts,
-- which is the curated list actually missing them) -- only their alt-title
-- rows were genuinely new.

INSERT INTO canon_books (title, author, source)
SELECT 'Othello', 'William Shakespeare', 'daily_agent_canon_backfill_2026_08_22'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'Othello' AND author ILIKE 'William Shakespeare');

INSERT INTO canon_books (title, author, source)
SELECT 'The Tragedy of Othello, the Moor of Venice', 'William Shakespeare', 'daily_agent_canon_backfill_2026_08_22'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'The Tragedy of Othello, the Moor of Venice' AND author ILIKE 'William Shakespeare');

INSERT INTO canon_books (title, author, source)
SELECT 'Gargantua and Pantagruel', 'François Rabelais', 'daily_agent_canon_backfill_2026_08_22'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'Gargantua and Pantagruel' AND author ILIKE 'François Rabelais');

INSERT INTO canon_books (title, author, source)
SELECT 'Gargantua et Pantagruel', 'François Rabelais', 'daily_agent_canon_backfill_2026_08_22'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'Gargantua et Pantagruel' AND author ILIKE 'François Rabelais');

INSERT INTO canon_books (title, author, source)
SELECT 'An Essay Concerning Human Understanding', 'John Locke', 'daily_agent_canon_backfill_2026_08_22'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'An Essay Concerning Human Understanding' AND author ILIKE 'John Locke');

INSERT INTO canon_books (title, author, source)
SELECT 'Jerusalem Delivered', 'Torquato Tasso', 'daily_agent_canon_backfill_2026_08_22'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'Jerusalem Delivered' AND author ILIKE 'Torquato Tasso');

INSERT INTO canon_books (title, author, source)
SELECT 'Gerusalemme Liberata', 'Torquato Tasso', 'daily_agent_canon_backfill_2026_08_22'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'Gerusalemme Liberata' AND author ILIKE 'Torquato Tasso');

INSERT INTO canon_books (title, author, source)
SELECT 'Civilization and Its Discontents', 'Sigmund Freud', 'daily_agent_canon_backfill_2026_08_22'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'Civilization and Its Discontents' AND author ILIKE 'Sigmund Freud');

INSERT INTO canon_books (title, author, source)
SELECT 'Das Unbehagen in der Kultur', 'Sigmund Freud', 'daily_agent_canon_backfill_2026_08_22'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'Das Unbehagen in der Kultur' AND author ILIKE 'Sigmund Freud');
