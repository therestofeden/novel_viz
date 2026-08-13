INSERT INTO canon_books (title, author, source)
SELECT v.title, v.author, 'daily_agent_canon_backfill_2026_08_13'
FROM (VALUES
  ('On Duties', 'Cicero'),
  ('De Officiis', 'Cicero'),
  ('On Obligations', 'Cicero'),
  ('The Dhammapada', 'Anonymous'),
  ('Dhammapada', 'Anonymous'),
  ('The Divan of Hafez', 'Hafez'),
  ('Divan-e Hafez', 'Hafez'),
  ('The Divan-i-Hafiz', 'Hafez'),
  ('Diwan of Hafez', 'Hafez'),
  ('The Mabinogion', 'Anonymous'),
  ('Mabinogion', 'Anonymous'),
  ('Life Is a Dream', 'Pedro Calderón de la Barca'),
  ('La vida es sueño', 'Pedro Calderón de la Barca')
) AS v(title, author)
WHERE NOT EXISTS (
  SELECT 1 FROM canon_books cb WHERE cb.title = v.title AND cb.author = v.author
);
