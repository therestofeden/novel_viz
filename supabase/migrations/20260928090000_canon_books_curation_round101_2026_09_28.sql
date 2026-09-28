-- Round 101 (2026-09-28, daily-must-read-and-classic task).
--
-- Landing classic.ts's one new round-101 title into canon_books the same
-- day it was curated -- following the discipline canon-coverage.test.ts
-- (added 2026-09-20) enforces: every classic.ts/must-read.ts entry must
-- have a matching canon_books row under some title spelling, checked by an
-- automated cross-reference test on every `npm test` run.
--
-- Alfred Marshall's Principles of Economics: An Introductory Volume
-- (1890) -- the neoclassical founding text round 81 (2026-09-09) flagged
-- as a real gap but held back only because its title collided exactly
-- with Carl Menger's own already-present entry in classic.ts's
-- title-keyed lookup table. Resolved this round using the book's genuine
-- full 1890 title -- see src/lib/classic.ts's "Round 101" comment block
-- for the full reasoning.
--
-- Same ON CONFLICT DO NOTHING / NOT EXISTS pattern as every prior
-- canon_books insert since 2026-07-17 -- safe to re-run, can't collide with
-- any existing row.

insert into canon_books (title, author, source) values
  ('Principles of Economics: An Introductory Volume', 'Alfred Marshall', 'classic_daily_curation_round101_2026_09_28')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('Principles of Economics: An Introductory Volume by Alfred Marshall')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
