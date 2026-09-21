-- Round 96 (2026-09-21, daily_novel_viz_feat / search-bar-to-viz task).
--
-- Landing classic.ts's three new round-96 titles into canon_books the same
-- day they were curated -- following the discipline canon-coverage.test.ts
-- (added 2026-09-20) now enforces: every classic.ts/must-read.ts entry must
-- have a matching canon_books row under some title spelling, checked by an
-- automated cross-reference test on every `npm test` run, not just caught
-- by a manual spot-check days or weeks later the way rounds 85-92 were.
--
-- Marie Curie's Radioactive Substances (1904 English publication of her
-- 1903 Sorbonne doctoral thesis), Michael Faraday's Experimental Researches
-- in Electricity (1839/1844/1855, three volumes), and Ludwig Boltzmann's
-- Lectures on Gas Theory (Vorlesungen über Gastheorie, 1896/1898) -- see
-- src/lib/classic.ts's "Round 96" comment block for the full reasoning
-- behind each addition.
--
-- Same ON CONFLICT DO NOTHING / NOT EXISTS pattern as every prior
-- canon_books insert since 2026-07-17 -- safe to re-run, can't collide with
-- any existing row.

insert into canon_books (title, author, source) values
  ('Radioactive Substances', 'Marie Curie', 'classic_daily_curation_round96_2026_09_21'),
  ('Experimental Researches in Electricity', 'Michael Faraday', 'classic_daily_curation_round96_2026_09_21'),
  ('Lectures on Gas Theory', 'Ludwig Boltzmann', 'classic_daily_curation_round96_2026_09_21')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('Radioactive Substances by Marie Curie'),
  ('Experimental Researches in Electricity by Michael Faraday'),
  ('Lectures on Gas Theory by Ludwig Boltzmann')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
