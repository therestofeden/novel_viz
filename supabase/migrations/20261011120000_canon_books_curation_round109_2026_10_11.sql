-- Round 109 (2026-10-11, daily novel_viz book-coverage task).
-- Pairs with classic.ts round 109 per canon-coverage.test.ts. Idempotent.

insert into canon_books (title, author, source) values
  ('Cranford', 'Elizabeth Gaskell', 'classic_daily_curation_round109_2026_10_11'),
  ('The Mill on the Floss', 'George Eliot', 'classic_daily_curation_round109_2026_10_11'),
  ('The Tenant of Wildfell Hall', 'Anne Brontë', 'classic_daily_curation_round109_2026_10_11'),
  ('North and South', 'Elizabeth Gaskell', 'classic_daily_curation_round109_2026_10_11'),
  ('Main Street', 'Sinclair Lewis', 'classic_daily_curation_round109_2026_10_11'),
  ('Cannery Row', 'John Steinbeck', 'classic_daily_curation_round109_2026_10_11'),
  ('Hadji Murat', 'Leo Tolstoy', 'classic_daily_curation_round109_2026_10_11'),
  ('Giovanni''s Room', 'James Baldwin', 'classic_daily_curation_round109_2026_10_11'),
  ('Critique of Judgment', 'Immanuel Kant', 'classic_daily_curation_round109_2026_10_11'),
  ('Growth of the Soil', 'Knut Hamsun', 'classic_daily_curation_round109_2026_10_11'),
  ('Kidnapped', 'Robert Louis Stevenson', 'classic_daily_curation_round109_2026_10_11'),
  ('Ethan Frome', 'Edith Wharton', 'classic_daily_curation_round109_2026_10_11')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('Cranford by Elizabeth Gaskell'),
  ('The Mill on the Floss by George Eliot'),
  ('The Tenant of Wildfell Hall by Anne Brontë'),
  ('North and South by Elizabeth Gaskell'),
  ('Main Street by Sinclair Lewis'),
  ('Cannery Row by John Steinbeck'),
  ('Hadji Murat by Leo Tolstoy'),
  ('Giovanni''s Room by James Baldwin'),
  ('Critique of Judgment by Immanuel Kant'),
  ('Growth of the Soil by Knut Hamsun'),
  ('Kidnapped by Robert Louis Stevenson'),
  ('Ethan Frome by Edith Wharton')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
