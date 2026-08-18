-- Round 53 daily canon curation (2026-08-18): five titles closing five
-- gaps in classic.ts (drama/Faust legend, children's literature, political
-- theory/law, foundational science, aesthetics). See src/lib/classic.ts
-- round-53 comment block for full rationale.
INSERT INTO canon_books (title, author, source)
SELECT 'The Tragical History of Doctor Faustus', 'Christopher Marlowe', 'daily_agent_canon_backfill_2026_08_18'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'The Tragical History of Doctor Faustus' AND author ILIKE 'Christopher Marlowe');

INSERT INTO canon_books (title, author, source)
SELECT 'The Adventures of Pinocchio', 'Carlo Collodi', 'daily_agent_canon_backfill_2026_08_18'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'The Adventures of Pinocchio' AND author ILIKE 'Carlo Collodi');

INSERT INTO canon_books (title, author, source)
SELECT 'On Crimes and Punishments', 'Cesare Beccaria', 'daily_agent_canon_backfill_2026_08_18'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'On Crimes and Punishments' AND author ILIKE 'Cesare Beccaria');

INSERT INTO canon_books (title, author, source)
SELECT 'Astronomia Nova', 'Johannes Kepler', 'daily_agent_canon_backfill_2026_08_18'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'Astronomia Nova' AND author ILIKE 'Johannes Kepler');

INSERT INTO canon_books (title, author, source)
SELECT 'On the Sublime', 'Longinus', 'daily_agent_canon_backfill_2026_08_18'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE title ILIKE 'On the Sublime' AND author ILIKE 'Longinus');
