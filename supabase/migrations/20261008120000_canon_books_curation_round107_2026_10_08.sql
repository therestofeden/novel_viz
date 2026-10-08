-- Round 107 (2026-10-08, daily_novel_viz_feat / book-coverage task).
--
-- Landing classic.ts's new round-107 titles into canon_books the same day
-- they were curated, per canon-coverage.test.ts's enforced discipline
-- (added 2026-09-20): every classic.ts/must-read.ts entry must have a
-- matching canon_books row under some title spelling.
--
-- All three titles (Novum Organum, The Sociological Imagination,
-- Correction) had zero canon_books rows under any migration -- checked
-- every migration file for each title first, zero hits -- so this is a
-- genuine new-title addition on the searchability side, same as the
-- round-105/106 titles, not just a classic.ts badge fix. See
-- src/lib/classic.ts's "round 107" comment block for the full curation
-- reasoning.
--
-- Same ON CONFLICT DO NOTHING / NOT EXISTS pattern as every prior
-- canon_books insert since 2026-07-17 -- safe to re-run, can't collide
-- with any existing row.

insert into canon_books (title, author, source) values
  ('Novum Organum', 'Francis Bacon', 'classic_daily_curation_round107_2026_10_08'),
  ('The Sociological Imagination', 'C. Wright Mills', 'classic_daily_curation_round107_2026_10_08'),
  ('Correction', 'Thomas Bernhard', 'classic_daily_curation_round107_2026_10_08')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('Novum Organum by Francis Bacon'),
  ('The Sociological Imagination by C. Wright Mills'),
  ('Correction by Thomas Bernhard')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
