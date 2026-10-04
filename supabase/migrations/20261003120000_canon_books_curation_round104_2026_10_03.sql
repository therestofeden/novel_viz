-- Round 104 (2026-10-03, daily_novel_viz_feat / search-bar-to-viz task).
--
-- Landing classic.ts's new round-104 title into canon_books the same day
-- it was curated, per canon-coverage.test.ts's enforced discipline (added
-- 2026-09-20): every classic.ts/must-read.ts entry must have a matching
-- canon_books row under some title spelling.
--
-- Unlike round 104's immediate predecessor (Cosmos, 2026-09-30), which was
-- already in canon_books from the 2026-07-28 backfill and only needed a
-- classic.ts badge, Flatland (Edwin A. Abbott, 1884) had no canon_books row
-- at all -- checked every migration file for "Flatland" first, zero hits --
-- so this is a genuine new-title addition on the searchability side too,
-- not just a badge-coverage fix. See src/lib/classic.ts's "round 104"
-- comment block for the full curation reasoning.
--
-- Same ON CONFLICT DO NOTHING / NOT EXISTS pattern as every prior
-- canon_books insert since 2026-07-17 -- safe to re-run, can't collide
-- with any existing row.

insert into canon_books (title, author, source) values
  ('Flatland', 'Edwin A. Abbott', 'classic_daily_curation_round104_2026_10_03')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('Flatland by Edwin A. Abbott')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
