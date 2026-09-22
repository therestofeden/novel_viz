-- Round 98 (2026-09-22, daily_novel_viz_feat task).
--
-- Landing classic.ts's two new round-98 titles into canon_books the same
-- day they were curated -- following the discipline canon-coverage.test.ts
-- (added 2026-09-20) enforces: every classic.ts/must-read.ts entry must
-- have a matching canon_books row under some title spelling, checked by an
-- automated cross-reference test on every `npm test` run.
--
-- Hugo Grotius's De Jure Belli ac Pacis (1625, international law's
-- founding text) and Alfred Thayer Mahan's The Influence of Sea Power upon
-- History, 1660-1783 (1890, naval-strategy counterpart to round 88's
-- Mackinder land-power entry) -- see src/lib/classic.ts's "Round 98"
-- comment block for the full reasoning behind each addition.
--
-- Same ON CONFLICT DO NOTHING / NOT EXISTS pattern as every prior
-- canon_books insert since 2026-07-17 -- safe to re-run, can't collide with
-- any existing row.

insert into canon_books (title, author, source) values
  ('De Jure Belli ac Pacis', 'Hugo Grotius', 'classic_daily_curation_round98_2026_09_22'),
  ('The Influence of Sea Power upon History, 1660-1783', 'Alfred Thayer Mahan', 'classic_daily_curation_round98_2026_09_22')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('De Jure Belli ac Pacis by Hugo Grotius'),
  ('The Influence of Sea Power upon History, 1660-1783 by Alfred Thayer Mahan')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
