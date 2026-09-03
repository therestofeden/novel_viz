-- Canon curation round 73 (2026-09-03): Booker Prize sweep closes gaps for
-- Ondaatje, Mantel, and Keneally (Life of Pi/Martel already existed, id 46).
insert into canon_books (title, author, source) values
  ('The English Patient', 'Michael Ondaatje', 'manual'),
  ('Wolf Hall', 'Hilary Mantel', 'manual'),
  ('Schindler''s Ark', 'Thomas Keneally', 'manual')
on conflict do nothing;

-- seed_book_list: only Schindler's Ark was missing (English Patient/Wolf
-- Hall/Life of Pi were already present from the 2026-08-25 bulk import).
insert into seed_book_list (entry) values
  ('Schindler''s Ark by Thomas Keneally')
on conflict do nothing;
