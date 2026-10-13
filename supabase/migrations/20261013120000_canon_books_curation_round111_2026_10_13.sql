-- Round 111 (2026-10-13, daily novel_viz book-coverage task).
-- Pairs with classic.ts round 111 per canon-coverage.test.ts. Idempotent.

insert into canon_books (title, author, source) values
  ('Northanger Abbey', 'Jane Austen', 'classic_daily_curation_round111_2026_10_13'),
  ('The Return of the Native', 'Thomas Hardy', 'classic_daily_curation_round111_2026_10_13'),
  ('Billy Budd', 'Herman Melville', 'classic_daily_curation_round111_2026_10_13'),
  ('The Last of the Mohicans', 'James Fenimore Cooper', 'classic_daily_curation_round111_2026_10_13'),
  ('The Wind in the Willows', 'Kenneth Grahame', 'classic_daily_curation_round111_2026_10_13'),
  ('Black Beauty', 'Anna Sewell', 'classic_daily_curation_round111_2026_10_13'),
  ('Heidi', 'Johanna Spyri', 'classic_daily_curation_round111_2026_10_13'),
  ('Demian', 'Hermann Hesse', 'classic_daily_curation_round111_2026_10_13'),
  ('Thérèse Raquin', 'Émile Zola', 'classic_daily_curation_round111_2026_10_13'),
  ('Bel-Ami', 'Guy de Maupassant', 'classic_daily_curation_round111_2026_10_13'),
  ('The Charterhouse of Parma', 'Stendhal', 'classic_daily_curation_round111_2026_10_13'),
  ('The Gambler', 'Fyodor Dostoevsky', 'classic_daily_curation_round111_2026_10_13'),
  ('Washington Square', 'Henry James', 'classic_daily_curation_round111_2026_10_13'),
  ('Winesburg, Ohio', 'Sherwood Anderson', 'classic_daily_curation_round111_2026_10_13'),
  ('Babbitt', 'Sinclair Lewis', 'classic_daily_curation_round111_2026_10_13'),
  ('Martin Eden', 'Jack London', 'classic_daily_curation_round111_2026_10_13'),
  ('The Descent of Man', 'Charles Darwin', 'classic_daily_curation_round111_2026_10_13'),
  ('The Birth of Tragedy', 'Friedrich Nietzsche', 'classic_daily_curation_round111_2026_10_13')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('Northanger Abbey by Jane Austen'),
  ('The Return of the Native by Thomas Hardy'),
  ('Billy Budd by Herman Melville'),
  ('The Last of the Mohicans by James Fenimore Cooper'),
  ('The Wind in the Willows by Kenneth Grahame'),
  ('Black Beauty by Anna Sewell'),
  ('Heidi by Johanna Spyri'),
  ('Demian by Hermann Hesse'),
  ('Thérèse Raquin by Émile Zola'),
  ('Bel-Ami by Guy de Maupassant'),
  ('The Charterhouse of Parma by Stendhal'),
  ('The Gambler by Fyodor Dostoevsky'),
  ('Washington Square by Henry James'),
  ('Winesburg, Ohio by Sherwood Anderson'),
  ('Babbitt by Sinclair Lewis'),
  ('Martin Eden by Jack London'),
  ('The Descent of Man by Charles Darwin'),
  ('The Birth of Tragedy by Friedrich Nietzsche')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
