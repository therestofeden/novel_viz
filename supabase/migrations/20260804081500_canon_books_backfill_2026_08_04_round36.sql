-- Round 36 (2026-08-04) canon curation backfill.
-- Adds Sundiata: An Epic of Old Mali, The Poetic Edda, The Theory of Moral
-- Sentiments, and Mencius to canon_books, matching the same-day Classic
-- additions in src/lib/classic.ts (258 -> 262).

insert into canon_books (title, author, source)
select v.title, v.author, 'classic_editorial'
from (values
  ('Sundiata: An Epic of Old Mali', 'Anonymous'),
  ('The Poetic Edda', 'Anonymous'),
  ('The Theory of Moral Sentiments', 'Adam Smith'),
  ('Mencius', 'Mencius')
) as v(title, author)
where not exists (
  select 1 from canon_books cb
  where lower(cb.title) = lower(v.title) and lower(cb.author) = lower(v.author)
);
