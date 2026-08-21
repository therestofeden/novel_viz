-- Round 57 daily canon curation (2026-08-21): five titles closing five
-- gaps in classic.ts (Christian scripture, Christian philosophy of
-- history, political-idealist theory, military memoir, early analytic
-- philosophy). See src/lib/classic.ts round-57 comment block for full
-- rationale. New Testament was explicitly flagged as a zero-hit back in
-- round 41 (2026-08-08) and left open until now.
INSERT INTO canon_books (title, author, source)
SELECT 'The New Testament', 'Anonymous', 'daily_agent_canon_backfill_2026_08_21'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'The New Testament' AND author ILIKE 'Anonymous');

INSERT INTO canon_books (title, author, source)
SELECT 'The City of God', 'Saint Augustine', 'daily_agent_canon_backfill_2026_08_21'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'The City of God' AND author ILIKE 'Saint Augustine');

INSERT INTO canon_books (title, author, source)
SELECT 'De Civitate Dei', 'Saint Augustine', 'daily_agent_canon_backfill_2026_08_21'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'De Civitate Dei' AND author ILIKE 'Saint Augustine');

INSERT INTO canon_books (title, author, source)
SELECT 'Utopia', 'Thomas More', 'daily_agent_canon_backfill_2026_08_21'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'Utopia' AND author ILIKE 'Thomas More');

INSERT INTO canon_books (title, author, source)
SELECT 'Anabasis', 'Xenophon', 'daily_agent_canon_backfill_2026_08_21'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'Anabasis' AND author ILIKE 'Xenophon');

INSERT INTO canon_books (title, author, source)
SELECT 'The March of the Ten Thousand', 'Xenophon', 'daily_agent_canon_backfill_2026_08_21'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'The March of the Ten Thousand' AND author ILIKE 'Xenophon');

INSERT INTO canon_books (title, author, source)
SELECT 'Tractatus Logico-Philosophicus', 'Ludwig Wittgenstein', 'daily_agent_canon_backfill_2026_08_21'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'Tractatus Logico-Philosophicus' AND author ILIKE 'Ludwig Wittgenstein');

INSERT INTO canon_books (title, author, source)
SELECT 'Logisch-Philosophische Abhandlung', 'Ludwig Wittgenstein', 'daily_agent_canon_backfill_2026_08_21'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'Logisch-Philosophische Abhandlung' AND author ILIKE 'Ludwig Wittgenstein');
