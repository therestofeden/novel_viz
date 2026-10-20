-- Round 118 (2026-10-20, daily novel_viz book-coverage task).
-- Pairs with classic.ts round 118 per canon-coverage.test.ts. Idempotent.

insert into canon_books (title, author, source) values
  ('Castle Rackrent', 'Maria Edgeworth', 'classic_daily_curation_round118_2026_10_20'),
  ('The Castle of Otranto', 'Horace Walpole', 'classic_daily_curation_round118_2026_10_20'),
  ('Typee', 'Herman Melville', 'classic_daily_curation_round118_2026_10_20'),
  ('The Confidence-Man', 'Herman Melville', 'classic_daily_curation_round118_2026_10_20'),
  ('Pudd''nhead Wilson', 'Mark Twain', 'classic_daily_curation_round118_2026_10_20'),
  ('The Jungle Book', 'Rudyard Kipling', 'classic_daily_curation_round118_2026_10_20'),
  ('The Thirty-Nine Steps', 'John Buchan', 'classic_daily_curation_round118_2026_10_20'),
  ('The Call of the Wild', 'Jack London', 'classic_daily_curation_round118_2026_10_20'),
  ('The Hound of the Baskervilles', 'Arthur Conan Doyle', 'classic_daily_curation_round118_2026_10_20'),
  ('Of Human Bondage', 'W. Somerset Maugham', 'classic_daily_curation_round118_2026_10_20'),
  ('Apology', 'Plato', 'classic_daily_curation_round118_2026_10_20'),
  ('Phaedo', 'Plato', 'classic_daily_curation_round118_2026_10_20'),
  ('Discourse on Inequality', 'Jean-Jacques Rousseau', 'classic_daily_curation_round118_2026_10_20'),
  ('Reveries of the Solitary Walker', 'Jean-Jacques Rousseau', 'classic_daily_curation_round118_2026_10_20'),
  ('The Gay Science', 'Friedrich Nietzsche', 'classic_daily_curation_round118_2026_10_20'),
  ('The Antichrist', 'Friedrich Nietzsche', 'classic_daily_curation_round118_2026_10_20'),
  ('The Sickness Unto Death', 'Soren Kierkegaard', 'classic_daily_curation_round118_2026_10_20'),
  ('Considerations on Representative Government', 'John Stuart Mill', 'classic_daily_curation_round118_2026_10_20'),
  ('The New Atlantis', 'Francis Bacon', 'classic_daily_curation_round118_2026_10_20'),
  ('Nature', 'Ralph Waldo Emerson', 'classic_daily_curation_round118_2026_10_20')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('Castle Rackrent by Maria Edgeworth'),
  ('The Castle of Otranto by Horace Walpole'),
  ('Typee by Herman Melville'),
  ('The Confidence-Man by Herman Melville'),
  ('Pudd''nhead Wilson by Mark Twain'),
  ('The Jungle Book by Rudyard Kipling'),
  ('The Thirty-Nine Steps by John Buchan'),
  ('The Call of the Wild by Jack London'),
  ('The Hound of the Baskervilles by Arthur Conan Doyle'),
  ('Of Human Bondage by W. Somerset Maugham'),
  ('Apology by Plato'),
  ('Phaedo by Plato'),
  ('Discourse on Inequality by Jean-Jacques Rousseau'),
  ('Reveries of the Solitary Walker by Jean-Jacques Rousseau'),
  ('The Gay Science by Friedrich Nietzsche'),
  ('The Antichrist by Friedrich Nietzsche'),
  ('The Sickness Unto Death by Soren Kierkegaard'),
  ('Considerations on Representative Government by John Stuart Mill'),
  ('The New Atlantis by Francis Bacon'),
  ('Nature by Ralph Waldo Emerson')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
