-- Round 105 (2026-10-06, daily_novel_viz_feat / search-bar-to-viz +
-- book-coverage task).
--
-- Landing classic.ts's new round-105 titles into canon_books the same day
-- they were curated, per canon-coverage.test.ts's enforced discipline
-- (added 2026-09-20): every classic.ts/must-read.ts entry must have a
-- matching canon_books row under some title spelling.
--
-- All four titles (Little Women, Anne of Green Gables, Rebecca, A Sand
-- County Almanac) had zero canon_books rows under any migration -- checked
-- every migration file for each title first, zero hits -- so this is a
-- genuine new-title addition on the searchability side, same as Flatland
-- in round 104, not just a classic.ts badge fix. See src/lib/classic.ts's
-- "round 105" comment block for the full curation reasoning.
--
-- Same ON CONFLICT DO NOTHING / NOT EXISTS pattern as every prior
-- canon_books insert since 2026-07-17 -- safe to re-run, can't collide
-- with any existing row.

insert into canon_books (title, author, source) values
  ('Little Women', 'Louisa May Alcott', 'classic_daily_curation_round105_2026_10_06'),
  ('Anne of Green Gables', 'L.M. Montgomery', 'classic_daily_curation_round105_2026_10_06'),
  ('Rebecca', 'Daphne du Maurier', 'classic_daily_curation_round105_2026_10_06'),
  ('A Sand County Almanac', 'Aldo Leopold', 'classic_daily_curation_round105_2026_10_06')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('Little Women by Louisa May Alcott'),
  ('Anne of Green Gables by L.M. Montgomery'),
  ('Rebecca by Daphne du Maurier'),
  ('A Sand County Almanac by Aldo Leopold')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
