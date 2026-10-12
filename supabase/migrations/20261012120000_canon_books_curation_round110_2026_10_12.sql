-- Round 110 (2026-10-12, daily novel_viz book-coverage task).
-- Pairs with classic.ts round 110 per canon-coverage.test.ts. Idempotent.

insert into canon_books (title, author, source) values
  ('Hard Times', 'Charles Dickens', 'classic_daily_curation_round110_2026_10_12'),
  ('Our Mutual Friend', 'Charles Dickens', 'classic_daily_curation_round110_2026_10_12'),
  ('The Pickwick Papers', 'Charles Dickens', 'classic_daily_curation_round110_2026_10_12'),
  ('Jude the Obscure', 'Thomas Hardy', 'classic_daily_curation_round110_2026_10_12'),
  ('The Mayor of Casterbridge', 'Thomas Hardy', 'classic_daily_curation_round110_2026_10_12'),
  ('Far from the Madding Crowd', 'Thomas Hardy', 'classic_daily_curation_round110_2026_10_12'),
  ('Ivanhoe', 'Walter Scott', 'classic_daily_curation_round110_2026_10_12'),
  ('Treasure Island', 'Robert Louis Stevenson', 'classic_daily_curation_round110_2026_10_12'),
  ('Lord Jim', 'Joseph Conrad', 'classic_daily_curation_round110_2026_10_12'),
  ('The Secret Agent', 'Joseph Conrad', 'classic_daily_curation_round110_2026_10_12'),
  ('Howards End', 'E. M. Forster', 'classic_daily_curation_round110_2026_10_12'),
  ('Daisy Miller', 'Henry James', 'classic_daily_curation_round110_2026_10_12'),
  ('Resurrection', 'Leo Tolstoy', 'classic_daily_curation_round110_2026_10_12'),
  ('The Jungle', 'Upton Sinclair', 'classic_daily_curation_round110_2026_10_12'),
  ('Ecce Homo', 'Friedrich Nietzsche', 'classic_daily_curation_round110_2026_10_12'),
  ('The Voyage of the Beagle', 'Charles Darwin', 'classic_daily_curation_round110_2026_10_12')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('Hard Times by Charles Dickens'),
  ('Our Mutual Friend by Charles Dickens'),
  ('The Pickwick Papers by Charles Dickens'),
  ('Jude the Obscure by Thomas Hardy'),
  ('The Mayor of Casterbridge by Thomas Hardy'),
  ('Far from the Madding Crowd by Thomas Hardy'),
  ('Ivanhoe by Walter Scott'),
  ('Treasure Island by Robert Louis Stevenson'),
  ('Lord Jim by Joseph Conrad'),
  ('The Secret Agent by Joseph Conrad'),
  ('Howards End by E. M. Forster'),
  ('Daisy Miller by Henry James'),
  ('Resurrection by Leo Tolstoy'),
  ('The Jungle by Upton Sinclair'),
  ('Ecce Homo by Friedrich Nietzsche'),
  ('The Voyage of the Beagle by Charles Darwin')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
