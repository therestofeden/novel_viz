-- Round 103 (2026-09-29, daily_novel_viz_feat / search-bar-to-viz task).
--
-- Landing classic.ts's two new round-103 titles into canon_books the same
-- day they were curated -- same discipline canon-coverage.test.ts (added
-- 2026-09-20) enforces: every classic.ts/must-read.ts entry must have a
-- matching canon_books row under some title spelling, checked by an
-- automated cross-reference test on every `npm test` run.
--
-- Numbered 103, not 102: this round's curation work (Ignaz Semmelweis's
-- The Etiology, Concept, and Prophylaxis of Childbed Fever, 1861, and
-- Florence Nightingale's Notes on Nursing: What It Is, and What It Is Not,
-- 1859) was drafted concurrently with another session's round 102 (Le
-- Corbusier's Toward an Architecture) against the same pre-101 base, and
-- lost the race to commit first (round 102 landed as 8c01cd1 first). Found
-- both drafted-but-uncommitted files sitting in this task's shared
-- worktree, verified them (WebSearch facts re-checked, zero title/author
-- collisions against the post-round-102 tree, full test suite green), and
-- re-numbered/re-based them onto round 102's actual resulting count (498)
-- rather than the 497 baseline they were originally drafted against. See
-- src/lib/classic.ts's "Round 103" comment block for the full reasoning.
--
-- Closing this list's total absence of clinical-practice hand hygiene and
-- of professional nursing's own founding text.
--
-- Same ON CONFLICT DO NOTHING / NOT EXISTS pattern as every prior
-- canon_books insert since 2026-07-17 -- safe to re-run, can't collide
-- with any existing row.

insert into canon_books (title, author, source) values
  ('The Etiology, Concept, and Prophylaxis of Childbed Fever', 'Ignaz Semmelweis', 'classic_daily_curation_round103_2026_09_29'),
  ('Notes on Nursing: What It Is, and What It Is Not', 'Florence Nightingale', 'classic_daily_curation_round103_2026_09_29')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('The Etiology, Concept, and Prophylaxis of Childbed Fever by Ignaz Semmelweis'),
  ('Notes on Nursing: What It Is, and What It Is Not by Florence Nightingale')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
