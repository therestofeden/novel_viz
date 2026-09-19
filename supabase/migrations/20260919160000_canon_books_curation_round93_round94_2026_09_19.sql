-- Rounds 93 and 94 (2026-09-19, scheduled `daily-must-read-and-classic` task).
--
-- Round 93 (Bayes, Linnaeus) shipped in classic.ts earlier today (commit
-- 0998309) alongside a canon_books backfill for rounds 85-92, but round 93's
-- own two titles were never included in that backfill -- confirmed by
-- grepping every canon_books_curation_*/backfill_*.sql migration for both
-- titles and both authors, zero hits before this migration. Landing them
-- here closes that gap immediately rather than letting it compound the way
-- rounds 85-92 did before being caught.
--
-- Round 94 closes two more total-absence gaps found this session: Claude
-- Shannon's Communication Theory of Secrecy Systems (1949) founded
-- mathematical cryptography, distinct from his own A Mathematical Theory of
-- Communication (1948, information theory) already in canon_books; William
-- Henry Fox Talbot's The Pencil of Nature (1844-46) is photography's
-- founding text as a medium, distinct from Benjamin's essay about
-- photography's cultural effects. See src/lib/classic.ts's "Round 94"
-- comment block for the full reasoning behind each addition.
--
-- Same ON CONFLICT DO NOTHING / NOT EXISTS pattern as the rounds85_92
-- backfill -- safe to re-run, can't collide with any prior insert.

insert into canon_books (title, author, source) values
  ('An Essay towards Solving a Problem in the Doctrine of Chances', 'Thomas Bayes', 'classic_daily_curation_round93_2026_09_19'),
  ('Systema Naturae', 'Carl Linnaeus', 'classic_daily_curation_round93_2026_09_19'),
  ('Communication Theory of Secrecy Systems', 'Claude Shannon', 'classic_daily_curation_round94_2026_09_19'),
  ('The Pencil of Nature', 'William Henry Fox Talbot', 'classic_daily_curation_round94_2026_09_19')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('An Essay towards Solving a Problem in the Doctrine of Chances by Thomas Bayes'),
  ('Systema Naturae by Carl Linnaeus'),
  ('Communication Theory of Secrecy Systems by Claude Shannon'),
  ('The Pencil of Nature by William Henry Fox Talbot')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
