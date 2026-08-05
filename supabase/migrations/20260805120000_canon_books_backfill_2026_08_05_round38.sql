-- Round 38 (2026-08-05) canon curation backfill.
-- Adds The Idiot, In Praise of Folly, Common Sense, and Beyond Good and Evil
-- (this round's own additions), plus Long Day's Journey Into Night and The
-- Hour of the Star (found already present in src/lib/classic.ts mid-session,
-- added by a concurrent process but never backfilled to canon_books) —
-- src/lib/classic.ts 266 -> 272 total across both.

insert into canon_books (title, author, source)
select v.title, v.author, 'classic_editorial'
from (values
  ('The Idiot', 'Fyodor Dostoevsky'),
  ('In Praise of Folly', 'Desiderius Erasmus'),
  ('Common Sense', 'Thomas Paine'),
  ('Beyond Good and Evil', 'Friedrich Nietzsche'),
  ('Long Day''s Journey Into Night', 'Eugene O''Neill'),
  ('The Hour of the Star', 'Clarice Lispector')
) as v(title, author)
where not exists (
  select 1 from canon_books cb
  where lower(cb.title) = lower(v.title) and lower(cb.author) = lower(v.author)
);
