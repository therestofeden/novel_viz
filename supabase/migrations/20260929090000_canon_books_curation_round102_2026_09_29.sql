-- Round 102 (2026-09-29, Daily_novel_viz_feat task).
--
-- Landing classic.ts's one new round-102 title into canon_books the same
-- day it was curated -- following the discipline canon-coverage.test.ts
-- (added 2026-09-20) enforces: every classic.ts/must-read.ts entry must
-- have a matching canon_books row under some title spelling, checked by an
-- automated cross-reference test on every `npm test` run.
--
-- Le Corbusier's Toward an Architecture (Vers une architecture, 1923) --
-- modernist architecture's founding manifesto, closing the 400-year gap
-- between Palladio (round 51) and Christopher Alexander's 1977 Pattern
-- Language, which was itself a reaction against the movement this book
-- founded. See src/lib/classic.ts's "Round 102" comment block for the
-- full reasoning.
--
-- Same ON CONFLICT DO NOTHING / NOT EXISTS pattern as every prior
-- canon_books insert since 2026-07-17 -- safe to re-run, can't collide with
-- any existing row.

insert into canon_books (title, author, source) values
  ('Toward an Architecture', 'Le Corbusier', 'classic_daily_curation_round102_2026_09_29')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('Toward an Architecture by Le Corbusier')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
