-- Round 54 daily canon curation (2026-08-19): five titles closing five
-- gaps in classic.ts (German Realism, Soviet-era Russian epic, Islamic
-- philosophy, Indian philosophy/practice, anthropology). See
-- src/lib/classic.ts round-54 comment block for full rationale.
INSERT INTO canon_books (title, author, source)
SELECT 'Effi Briest', 'Theodor Fontane', 'daily_agent_canon_backfill_2026_08_19'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'Effi Briest' AND author ILIKE 'Theodor Fontane');

INSERT INTO canon_books (title, author, source)
SELECT 'And Quiet Flows the Don', 'Mikhail Sholokhov', 'daily_agent_canon_backfill_2026_08_19'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'And Quiet Flows the Don' AND author ILIKE 'Mikhail Sholokhov');

INSERT INTO canon_books (title, author, source)
SELECT 'The Incoherence of the Philosophers', 'Al-Ghazali', 'daily_agent_canon_backfill_2026_08_19'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'The Incoherence of the Philosophers' AND author ILIKE 'Al-Ghazali');

INSERT INTO canon_books (title, author, source)
SELECT 'The Yoga Sutras', 'Patanjali', 'daily_agent_canon_backfill_2026_08_19'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'The Yoga Sutras' AND author ILIKE 'Patanjali');

INSERT INTO canon_books (title, author, source)
SELECT 'The Interpretation of Cultures', 'Clifford Geertz', 'daily_agent_canon_backfill_2026_08_19'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'The Interpretation of Cultures' AND author ILIKE 'Clifford Geertz');
