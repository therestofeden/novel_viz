-- Round 115 (2026-10-17, daily novel_viz book-coverage task).
-- Pairs with classic.ts round 115 per canon-coverage.test.ts. Idempotent.

insert into canon_books (title, author, source) values
  ('Villette', 'Charlotte Brontë', 'classic_daily_curation_round115_2026_10_17'),
  ('Death in Venice', 'Thomas Mann', 'classic_daily_curation_round115_2026_10_17'),
  ('Wilhelm Meister''s Apprenticeship', 'Johann Wolfgang von Goethe', 'classic_daily_curation_round115_2026_10_17'),
  ('The Three Musketeers', 'Alexandre Dumas', 'classic_daily_curation_round115_2026_10_17'),
  ('Sentimental Education', 'Gustave Flaubert', 'classic_daily_curation_round115_2026_10_17'),
  ('The Princess of Clèves', 'Madame de La Fayette', 'classic_daily_curation_round115_2026_10_17'),
  ('Gil Blas', 'Alain-René Lesage', 'classic_daily_curation_round115_2026_10_17'),
  ('The Seagull', 'Anton Chekhov', 'classic_daily_curation_round115_2026_10_17'),
  ('Jacob''s Room', 'Virginia Woolf', 'classic_daily_curation_round115_2026_10_17'),
  ('Cousin Bette', 'Honoré de Balzac', 'classic_daily_curation_round115_2026_10_17'),
  ('Science of Logic', 'G. W. F. Hegel', 'classic_daily_curation_round115_2026_10_17'),
  ('The Elementary Forms of Religious Life', 'Émile Durkheim', 'classic_daily_curation_round115_2026_10_17'),
  ('The Old Regime and the Revolution', 'Alexis de Tocqueville', 'classic_daily_curation_round115_2026_10_17'),
  ('Persian Letters', 'Montesquieu', 'classic_daily_curation_round115_2026_10_17'),
  ('On the Soul', 'Aristotle', 'classic_daily_curation_round115_2026_10_17'),
  ('Timaeus', 'Plato', 'classic_daily_curation_round115_2026_10_17'),
  ('Lives of the Most Eminent English Poets', 'Samuel Johnson', 'classic_daily_curation_round115_2026_10_17'),
  ('The Anatomy of Melancholy', 'Robert Burton', 'classic_daily_curation_round115_2026_10_17'),
  ('Lectures on the Philosophy of History', 'G. W. F. Hegel', 'classic_daily_curation_round115_2026_10_17'),
  ('Religio Medici', 'Thomas Browne', 'classic_daily_curation_round115_2026_10_17')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('Villette by Charlotte Brontë'),
  ('Death in Venice by Thomas Mann'),
  ('Wilhelm Meister''s Apprenticeship by Johann Wolfgang von Goethe'),
  ('The Three Musketeers by Alexandre Dumas'),
  ('Sentimental Education by Gustave Flaubert'),
  ('The Princess of Clèves by Madame de La Fayette'),
  ('Gil Blas by Alain-René Lesage'),
  ('The Seagull by Anton Chekhov'),
  ('Jacob''s Room by Virginia Woolf'),
  ('Cousin Bette by Honoré de Balzac'),
  ('Science of Logic by G. W. F. Hegel'),
  ('The Elementary Forms of Religious Life by Émile Durkheim'),
  ('The Old Regime and the Revolution by Alexis de Tocqueville'),
  ('Persian Letters by Montesquieu'),
  ('On the Soul by Aristotle'),
  ('Timaeus by Plato'),
  ('Lives of the Most Eminent English Poets by Samuel Johnson'),
  ('The Anatomy of Melancholy by Robert Burton'),
  ('Lectures on the Philosophy of History by G. W. F. Hegel'),
  ('Religio Medici by Thomas Browne')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
