-- Round 100 (2026-09-26, daily-must-read-and-classic task).
--
-- Landing classic.ts's one new round-100 title into canon_books the same
-- day it was curated -- following the discipline canon-coverage.test.ts
-- (added 2026-09-20) enforces: every classic.ts/must-read.ts entry must
-- have a matching canon_books row under some title spelling, checked by an
-- automated cross-reference test on every `npm test` run.
--
-- Robert Hooke's Micrographia (1665, published under the Royal Society's
-- own imprimatur) -- the book that coined the word "cell" for a biological
-- structure, from Hooke's own observation of cork under a microscope he
-- built himself -- see src/lib/classic.ts's "Round 100" comment block for
-- the full reasoning behind the addition.
--
-- Same ON CONFLICT DO NOTHING / NOT EXISTS pattern as every prior
-- canon_books insert since 2026-07-17 -- safe to re-run, can't collide with
-- any existing row.

insert into canon_books (title, author, source) values
  ('Micrographia', 'Robert Hooke', 'classic_daily_curation_round100_2026_09_26')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('Micrographia by Robert Hooke')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
