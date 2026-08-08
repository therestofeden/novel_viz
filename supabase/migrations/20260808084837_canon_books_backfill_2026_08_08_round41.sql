-- Round 41 (2026-08-08) daily canon curation backfill.
-- 4 new primaries (Antigone/Sophocles already existed in canon_books via
-- the classics_tier source since 2026-07-17, even though it was never in
-- classic.ts until this round — no insert needed for it) + 4 genuinely
-- distinct akas (alternate spelling / translated title / original-
-- language title), each guarded by WHERE NOT EXISTS on title+author.

INSERT INTO canon_books (title, author, source)
SELECT 'The Quran', 'Anonymous', 'classic_daily_curation_round41_2026_08_08'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE lower(title) = lower('The Quran') AND lower(author) = lower('Anonymous'));

INSERT INTO canon_books (title, author, source)
SELECT 'Koran', 'Anonymous', 'classic_daily_curation_round41_2026_08_08'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE lower(title) = lower('Koran') AND lower(author) = lower('Anonymous'));

INSERT INTO canon_books (title, author, source)
SELECT 'Les Fleurs du Mal', 'Charles Baudelaire', 'classic_daily_curation_round41_2026_08_08'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE lower(title) = lower('Les Fleurs du Mal') AND lower(author) = lower('Charles Baudelaire'));

INSERT INTO canon_books (title, author, source)
SELECT 'The Flowers of Evil', 'Charles Baudelaire', 'classic_daily_curation_round41_2026_08_08'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE lower(title) = lower('The Flowers of Evil') AND lower(author) = lower('Charles Baudelaire'));

INSERT INTO canon_books (title, author, source)
SELECT 'Duino Elegies', 'Rainer Maria Rilke', 'classic_daily_curation_round41_2026_08_08'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE lower(title) = lower('Duino Elegies') AND lower(author) = lower('Rainer Maria Rilke'));

INSERT INTO canon_books (title, author, source)
SELECT 'Duineser Elegien', 'Rainer Maria Rilke', 'classic_daily_curation_round41_2026_08_08'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE lower(title) = lower('Duineser Elegien') AND lower(author) = lower('Rainer Maria Rilke'));

INSERT INTO canon_books (title, author, source)
SELECT 'Dialogue Concerning the Two Chief World Systems', 'Galileo Galilei', 'classic_daily_curation_round41_2026_08_08'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE lower(title) = lower('Dialogue Concerning the Two Chief World Systems') AND lower(author) = lower('Galileo Galilei'));

INSERT INTO canon_books (title, author, source)
SELECT 'Dialogo sopra i due massimi sistemi del mondo', 'Galileo Galilei', 'classic_daily_curation_round41_2026_08_08'
WHERE NOT EXISTS (SELECT 1 FROM canon_books WHERE lower(title) = lower('Dialogo sopra i due massimi sistemi del mondo') AND lower(author) = lower('Galileo Galilei'));
