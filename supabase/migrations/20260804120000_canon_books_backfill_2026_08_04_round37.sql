-- Round 37 (2026-08-04) canon curation backfill.
-- Adds The Spirit of the Laws, Self-Reliance, Miss Julie, and Runaway to
-- canon_books, matching the same-day Classic additions in src/lib/classic.ts
-- (262 -> 266).

insert into canon_books (title, author, source)
select v.title, v.author, 'classic_editorial'
from (values
  ('The Spirit of the Laws', 'Montesquieu'),
  ('Self-Reliance', 'Ralph Waldo Emerson'),
  ('Miss Julie', 'August Strindberg'),
  ('Runaway', 'Alice Munro')
) as v(title, author)
where not exists (
  select 1 from canon_books cb
  where lower(cb.title) = lower(v.title) and lower(cb.author) = lower(v.author)
);
