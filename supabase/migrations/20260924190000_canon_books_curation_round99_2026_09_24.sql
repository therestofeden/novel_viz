-- Round 99 (2026-09-24, daily-must-read-and-classic task).
--
-- Landing classic.ts's one new round-99 title into canon_books the same
-- day it was curated -- following the discipline canon-coverage.test.ts
-- (added 2026-09-20) enforces: every classic.ts/must-read.ts entry must
-- have a matching canon_books row under some title spelling, checked by an
-- automated cross-reference test on every `npm test` run.
--
-- Edwin Hubble's The Realm of the Nebulae (1936, Silliman Memorial
-- Lectures, Yale University Press) -- founding text of observational
-- cosmology, establishing that spiral nebulae are separate galaxies and
-- that the universe is expanding (Hubble's Law) -- see src/lib/classic.ts's
-- "Round 99" comment block for the full reasoning behind the addition.
--
-- Same ON CONFLICT DO NOTHING / NOT EXISTS pattern as every prior
-- canon_books insert since 2026-07-17 -- safe to re-run, can't collide with
-- any existing row.

insert into canon_books (title, author, source) values
  ('The Realm of the Nebulae', 'Edwin Hubble', 'classic_daily_curation_round99_2026_09_24')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('The Realm of the Nebulae by Edwin Hubble')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
