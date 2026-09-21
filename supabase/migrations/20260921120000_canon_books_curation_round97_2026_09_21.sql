-- Round 97 (2026-09-21, daily-must-read-and-classic task).
--
-- Landing classic.ts's three new round-97 titles into canon_books the same
-- day they were curated -- following the discipline canon-coverage.test.ts
-- (added 2026-09-20, restored to HEAD this same session after a prior
-- merge commit (ecc54fc) silently dropped it from the tree -- see that
-- day's daily-must-read-and-classic memory entry for the full story) now
-- enforces: every classic.ts/must-read.ts entry must have a matching
-- canon_books row under some title spelling, checked by an automated
-- cross-reference test on every `npm test` run.
--
-- Louis Pasteur's The Germ Theory and Its Applications to Medicine and
-- Surgery (1878), Robert Koch's The Aetiology of Tuberculosis (1882), and
-- Luke Howard's On the Modification of Clouds (1803) -- see
-- src/lib/classic.ts's "Round 97" comment block for the full reasoning
-- behind each addition.
--
-- Same ON CONFLICT DO NOTHING / NOT EXISTS pattern as every prior
-- canon_books insert since 2026-07-17 -- safe to re-run, can't collide with
-- any existing row.

insert into canon_books (title, author, source) values
  ('The Germ Theory and Its Applications to Medicine and Surgery', 'Louis Pasteur', 'classic_daily_curation_round97_2026_09_21'),
  ('The Aetiology of Tuberculosis', 'Robert Koch', 'classic_daily_curation_round97_2026_09_21'),
  ('On the Modification of Clouds', 'Luke Howard', 'classic_daily_curation_round97_2026_09_21')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('The Germ Theory and Its Applications to Medicine and Surgery by Louis Pasteur'),
  ('The Aetiology of Tuberculosis by Robert Koch'),
  ('On the Modification of Clouds by Luke Howard')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
