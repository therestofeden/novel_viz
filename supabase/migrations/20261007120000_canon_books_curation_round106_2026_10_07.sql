-- Round 106 (2026-10-07, daily_novel_viz_feat / search-bar-to-viz +
-- book-coverage task).
--
-- Landing classic.ts's new round-106 titles into canon_books the same day
-- they were curated, per canon-coverage.test.ts's enforced discipline
-- (added 2026-09-20): every classic.ts/must-read.ts entry must have a
-- matching canon_books row under some title spelling.
--
-- All three titles (The Works of Archimedes, The Malay Archipelago, The
-- Practice of Management) had zero canon_books rows under any migration --
-- checked every migration file for each title first, zero hits -- so this
-- is a genuine new-title addition on the searchability side, same as
-- Flatland in round 104 and the round-105 titles, not just a classic.ts
-- badge fix. See src/lib/classic.ts's "round 106" comment block for the
-- full curation reasoning.
--
-- Same ON CONFLICT DO NOTHING / NOT EXISTS pattern as every prior
-- canon_books insert since 2026-07-17 -- safe to re-run, can't collide
-- with any existing row.

insert into canon_books (title, author, source) values
  ('The Works of Archimedes', 'Archimedes', 'classic_daily_curation_round106_2026_10_07'),
  ('The Malay Archipelago', 'Alfred Russel Wallace', 'classic_daily_curation_round106_2026_10_07'),
  ('The Practice of Management', 'Peter Drucker', 'classic_daily_curation_round106_2026_10_07')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('The Works of Archimedes by Archimedes'),
  ('The Malay Archipelago by Alfred Russel Wallace'),
  ('The Practice of Management by Peter Drucker')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
