-- Round 117 (2026-10-19, daily novel_viz book-coverage task).
-- Pairs with classic.ts round 117 per canon-coverage.test.ts. Idempotent.

insert into canon_books (title, author, source) values
  ('Shirley', 'Charlotte Brontë', 'classic_daily_curation_round117_2026_10_19'),
  ('Daniel Deronda', 'George Eliot', 'classic_daily_curation_round117_2026_10_19'),
  ('Nana', 'Émile Zola', 'classic_daily_curation_round117_2026_10_19'),
  ('Pan Tadeusz', 'Adam Mickiewicz', 'classic_daily_curation_round117_2026_10_19'),
  ('The Way of All Flesh', 'Samuel Butler', 'classic_daily_curation_round117_2026_10_19'),
  ('Erewhon', 'Samuel Butler', 'classic_daily_curation_round117_2026_10_19'),
  ('Moll Flanders', 'Daniel Defoe', 'classic_daily_curation_round117_2026_10_19'),
  ('Kim', 'Rudyard Kipling', 'classic_daily_curation_round117_2026_10_19'),
  ('The Island of Doctor Moreau', 'H. G. Wells', 'classic_daily_curation_round117_2026_10_19'),
  ('Three Men in a Boat', 'Jerome K. Jerome', 'classic_daily_curation_round117_2026_10_19'),
  ('Civil Disobedience', 'Henry David Thoreau', 'classic_daily_curation_round117_2026_10_19'),
  ('Perpetual Peace', 'Immanuel Kant', 'classic_daily_curation_round117_2026_10_19'),
  ('Groundwork of the Metaphysics of Morals', 'Immanuel Kant', 'classic_daily_curation_round117_2026_10_19'),
  ('Either/Or', 'Søren Kierkegaard', 'classic_daily_curation_round117_2026_10_19'),
  ('Pragmatism', 'William James', 'classic_daily_curation_round117_2026_10_19'),
  ('The Problems of Philosophy', 'Bertrand Russell', 'classic_daily_curation_round117_2026_10_19'),
  ('The Book of the Courtier', 'Baldassare Castiglione', 'classic_daily_curation_round117_2026_10_19'),
  ('Discourses on Livy', 'Niccolò Machiavelli', 'classic_daily_curation_round117_2026_10_19'),
  ('Letters on the English', 'Voltaire', 'classic_daily_curation_round117_2026_10_19'),
  ('Philosophical Dictionary', 'Voltaire', 'classic_daily_curation_round117_2026_10_19')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('Shirley by Charlotte Brontë'),
  ('Daniel Deronda by George Eliot'),
  ('Nana by Émile Zola'),
  ('Pan Tadeusz by Adam Mickiewicz'),
  ('The Way of All Flesh by Samuel Butler'),
  ('Erewhon by Samuel Butler'),
  ('Moll Flanders by Daniel Defoe'),
  ('Kim by Rudyard Kipling'),
  ('The Island of Doctor Moreau by H. G. Wells'),
  ('Three Men in a Boat by Jerome K. Jerome'),
  ('Civil Disobedience by Henry David Thoreau'),
  ('Perpetual Peace by Immanuel Kant'),
  ('Groundwork of the Metaphysics of Morals by Immanuel Kant'),
  ('Either/Or by Søren Kierkegaard'),
  ('Pragmatism by William James'),
  ('The Problems of Philosophy by Bertrand Russell'),
  ('The Book of the Courtier by Baldassare Castiglione'),
  ('Discourses on Livy by Niccolò Machiavelli'),
  ('Letters on the English by Voltaire'),
  ('Philosophical Dictionary by Voltaire')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
