-- Round 113 (2026-10-15, daily novel_viz book-coverage task).
-- Pairs with classic.ts round 113 per canon-coverage.test.ts. Idempotent.

insert into canon_books (title, author, source) values
  ('Little Dorrit', 'Charles Dickens', 'classic_daily_curation_round113_2026_10_15'),
  ('Barnaby Rudge', 'Charles Dickens', 'classic_daily_curation_round113_2026_10_15'),
  ('Pamela', 'Samuel Richardson', 'classic_daily_curation_round113_2026_10_15'),
  ('Phineas Finn', 'Anthony Trollope', 'classic_daily_curation_round113_2026_10_15'),
  ('The Golden Bowl', 'Henry James', 'classic_daily_curation_round113_2026_10_15'),
  ('Light in August', 'William Faulkner', 'classic_daily_curation_round113_2026_10_15'),
  ('A Handful of Dust', 'Evelyn Waugh', 'classic_daily_curation_round113_2026_10_15'),
  ('Scoop', 'Evelyn Waugh', 'classic_daily_curation_round113_2026_10_15'),
  ('Lost Illusions', 'Honoré de Balzac', 'classic_daily_curation_round113_2026_10_15'),
  ('The House of the Dead', 'Fyodor Dostoevsky', 'classic_daily_curation_round113_2026_10_15'),
  ('The Cossacks', 'Leo Tolstoy', 'classic_daily_curation_round113_2026_10_15'),
  ('The Kreutzer Sonata', 'Leo Tolstoy', 'classic_daily_curation_round113_2026_10_15'),
  ('Lorna Doone', 'R. D. Blackmore', 'classic_daily_curation_round113_2026_10_15'),
  ('Arrowsmith', 'Sinclair Lewis', 'classic_daily_curation_round113_2026_10_15'),
  ('Elmer Gantry', 'Sinclair Lewis', 'classic_daily_curation_round113_2026_10_15'),
  ('Peer Gynt', 'Henrik Ibsen', 'classic_daily_curation_round113_2026_10_15'),
  ('Rob Roy', 'Walter Scott', 'classic_daily_curation_round113_2026_10_15'),
  ('Monadology', 'Gottfried Wilhelm Leibniz', 'classic_daily_curation_round113_2026_10_15'),
  ('Germania', 'Tacitus', 'classic_daily_curation_round113_2026_10_15')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('Little Dorrit by Charles Dickens'),
  ('Barnaby Rudge by Charles Dickens'),
  ('Pamela by Samuel Richardson'),
  ('Phineas Finn by Anthony Trollope'),
  ('The Golden Bowl by Henry James'),
  ('Light in August by William Faulkner'),
  ('A Handful of Dust by Evelyn Waugh'),
  ('Scoop by Evelyn Waugh'),
  ('Lost Illusions by Honoré de Balzac'),
  ('The House of the Dead by Fyodor Dostoevsky'),
  ('The Cossacks by Leo Tolstoy'),
  ('The Kreutzer Sonata by Leo Tolstoy'),
  ('Lorna Doone by R. D. Blackmore'),
  ('Arrowsmith by Sinclair Lewis'),
  ('Elmer Gantry by Sinclair Lewis'),
  ('Peer Gynt by Henrik Ibsen'),
  ('Rob Roy by Walter Scott'),
  ('Monadology by Gottfried Wilhelm Leibniz'),
  ('Germania by Tacitus')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
