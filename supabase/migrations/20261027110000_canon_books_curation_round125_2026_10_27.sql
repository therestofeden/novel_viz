-- Round 125 (2026-10-27, daily novel_viz book-coverage task). Pairs with classic.ts round 125 per canon-coverage.test.ts. Idempotent.

insert into canon_books (title, author, source) values
  ('Il santo', 'Antonio Fogazzaro', 'classic_daily_curation_round125_2026_10_27'),
  ('Reeds in the Wind', 'Grazia Deledda', 'classic_daily_curation_round125_2026_10_27'),
  ('Odi barbare', 'Giosue Carducci', 'classic_daily_curation_round125_2026_10_27'),
  ('Orlando Innamorato', 'Matteo Maria Boiardo', 'classic_daily_curation_round125_2026_10_27'),
  ('Memoirs of a Good-for-Nothing', 'Joseph von Eichendorff', 'classic_daily_curation_round125_2026_10_27'),
  ('Lichtenstein', 'Wilhelm Hauff', 'classic_daily_curation_round125_2026_10_27'),
  ('The Black Spider', 'Jeremias Gotthelf', 'classic_daily_curation_round125_2026_10_27'),
  ('Debit and Credit', 'Gustav Freytag', 'classic_daily_curation_round125_2026_10_27'),
  ('L''Arrabbiata', 'Paul Heyse', 'classic_daily_curation_round125_2026_10_27'),
  ('The Child of the Parish', 'Marie von Ebner-Eschenbach', 'classic_daily_curation_round125_2026_10_27'),
  ('Poor Liza', 'Nikolay Karamzin', 'classic_daily_curation_round125_2026_10_27'),
  ('Eurico the Presbyter', 'Alexandre Herculano', 'classic_daily_curation_round125_2026_10_27'),
  ('Synnove Solbakken', 'Bjornstjerne Bjornson', 'classic_daily_curation_round125_2026_10_27'),
  ('The Jews'' Beech', 'Annette von Droste-Hulshoff', 'classic_daily_curation_round125_2026_10_27'),
  ('The Rider on the White Horse', 'Theodor Storm', 'classic_daily_curation_round125_2026_10_27'),
  ('Jurg Jenatsch', 'Conrad Ferdinand Meyer', 'classic_daily_curation_round125_2026_10_27'),
  ('Doomed Love', 'Camilo Castelo Branco', 'classic_daily_curation_round125_2026_10_27'),
  ('The Life of Jesus', 'Ernest Renan', 'classic_daily_curation_round125_2026_10_27'),
  ('History of France', 'Jules Michelet', 'classic_daily_curation_round125_2026_10_27'),
  ('History of the Popes', 'Leopold von Ranke', 'classic_daily_curation_round125_2026_10_27')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('Il santo by Antonio Fogazzaro'),
  ('Reeds in the Wind by Grazia Deledda'),
  ('Odi barbare by Giosue Carducci'),
  ('Orlando Innamorato by Matteo Maria Boiardo'),
  ('Memoirs of a Good-for-Nothing by Joseph von Eichendorff'),
  ('Lichtenstein by Wilhelm Hauff'),
  ('The Black Spider by Jeremias Gotthelf'),
  ('Debit and Credit by Gustav Freytag'),
  ('L''Arrabbiata by Paul Heyse'),
  ('The Child of the Parish by Marie von Ebner-Eschenbach'),
  ('Poor Liza by Nikolay Karamzin'),
  ('Eurico the Presbyter by Alexandre Herculano'),
  ('Synnove Solbakken by Bjornstjerne Bjornson'),
  ('The Jews'' Beech by Annette von Droste-Hulshoff'),
  ('The Rider on the White Horse by Theodor Storm'),
  ('Jurg Jenatsch by Conrad Ferdinand Meyer'),
  ('Doomed Love by Camilo Castelo Branco'),
  ('The Life of Jesus by Ernest Renan'),
  ('History of France by Jules Michelet'),
  ('History of the Popes by Leopold von Ranke')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
