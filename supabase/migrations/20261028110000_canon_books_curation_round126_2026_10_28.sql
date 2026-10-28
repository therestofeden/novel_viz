-- Round 126 (2026-10-28, daily novel_viz book-coverage task). Pairs with classic.ts round 126 per canon-coverage.test.ts. Idempotent.

insert into canon_books (title, author, source) values
  ('The Origins of Contemporary France', 'Hippolyte Taine', 'classic_daily_curation_round126_2026_10_28'),
  ('The New Science', 'Giambattista Vico', 'classic_daily_curation_round126_2026_10_28'),
  ('Travels in My Homeland', 'Almeida Garrett', 'classic_daily_curation_round126_2026_10_28'),
  ('John the Valiant', 'Sandor Petofi', 'classic_daily_curation_round126_2026_10_28'),
  ('The Tragedy of Man', 'Imre Madach', 'classic_daily_curation_round126_2026_10_28'),
  ('The Mountain Wreath', 'Petar II Petrovic-Njegos', 'classic_daily_curation_round126_2026_10_28'),
  ('Luceafarul', 'Mihai Eminescu', 'classic_daily_curation_round126_2026_10_28'),
  ('Childhood Memories', 'Ion Creanga', 'classic_daily_curation_round126_2026_10_28'),
  ('A Lost Letter', 'Ion Luca Caragiale', 'classic_daily_curation_round126_2026_10_28'),
  ('Tales of Ensign Stal', 'Johan Ludvig Runeberg', 'classic_daily_curation_round126_2026_10_28'),
  ('The Surgeon''s Stories', 'Zacharias Topelius', 'classic_daily_curation_round126_2026_10_28'),
  ('Frithiof''s Saga', 'Esaias Tegner', 'classic_daily_curation_round126_2026_10_28'),
  ('The Undivine Comedy', 'Zygmunt Krasinski', 'classic_daily_curation_round126_2026_10_28'),
  ('Kordian', 'Juliusz Slowacki', 'classic_daily_curation_round126_2026_10_28'),
  ('Oberon', 'Christoph Martin Wieland', 'classic_daily_curation_round126_2026_10_28'),
  ('Siebenkas', 'Jean Paul', 'classic_daily_curation_round126_2026_10_28'),
  ('Heinrich von Ofterdingen', 'Novalis', 'classic_daily_curation_round126_2026_10_28'),
  ('The Blond Eckbert', 'Ludwig Tieck', 'classic_daily_curation_round126_2026_10_28'),
  ('Sappho', 'Franz Grillparzer', 'classic_daily_curation_round126_2026_10_28'),
  ('My Past and Thoughts', 'Alexander Herzen', 'classic_daily_curation_round126_2026_10_28')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('The Origins of Contemporary France by Hippolyte Taine'),
  ('The New Science by Giambattista Vico'),
  ('Travels in My Homeland by Almeida Garrett'),
  ('John the Valiant by Sandor Petofi'),
  ('The Tragedy of Man by Imre Madach'),
  ('The Mountain Wreath by Petar II Petrovic-Njegos'),
  ('Luceafarul by Mihai Eminescu'),
  ('Childhood Memories by Ion Creanga'),
  ('A Lost Letter by Ion Luca Caragiale'),
  ('Tales of Ensign Stal by Johan Ludvig Runeberg'),
  ('The Surgeon''s Stories by Zacharias Topelius'),
  ('Frithiof''s Saga by Esaias Tegner'),
  ('The Undivine Comedy by Zygmunt Krasinski'),
  ('Kordian by Juliusz Slowacki'),
  ('Oberon by Christoph Martin Wieland'),
  ('Siebenkas by Jean Paul'),
  ('Heinrich von Ofterdingen by Novalis'),
  ('The Blond Eckbert by Ludwig Tieck'),
  ('Sappho by Franz Grillparzer'),
  ('My Past and Thoughts by Alexander Herzen')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
