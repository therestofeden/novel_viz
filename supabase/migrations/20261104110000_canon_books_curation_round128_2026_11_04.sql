-- Round 128 (2026-11-04, daily novel_viz book-coverage task). Pairs with classic.ts round 128 per canon-coverage.test.ts. Idempotent.

insert into canon_books (title, author, source) values
  ('Layla and Majnun', 'Nizami Ganjavi', 'classic_daily_curation_round128_2026_11_04'),
  ('The Days', 'Taha Hussein', 'classic_daily_curation_round128_2026_11_04'),
  ('Return of the Spirit', 'Tawfiq al-Hakim', 'classic_daily_curation_round128_2026_11_04'),
  ('Epistle of Forgiveness', 'Abu al-Ala al-Maarri', 'classic_daily_curation_round128_2026_11_04'),
  ('Godaan', 'Premchand', 'classic_daily_curation_round128_2026_11_04'),
  ('Ramcharitmanas', 'Tulsidas', 'classic_daily_curation_round128_2026_11_04'),
  ('The Little Clay Cart', 'Shudraka', 'classic_daily_curation_round128_2026_11_04'),
  ('Anandamath', 'Bankim Chandra Chatterjee', 'classic_daily_curation_round128_2026_11_04'),
  ('Songs of Kabir', 'Kabir', 'classic_daily_curation_round128_2026_11_04'),
  ('Diwan-e-Ghalib', 'Mirza Ghalib', 'classic_daily_curation_round128_2026_11_04'),
  ('Tirukkural', 'Thiruvalluvar', 'classic_daily_curation_round128_2026_11_04'),
  ('Silappatikaram', 'Ilango Adigal', 'classic_daily_curation_round128_2026_11_04'),
  ('Chaka', 'Thomas Mofolo', 'classic_daily_curation_round128_2026_11_04'),
  ('The Story of an African Farm', 'Olive Schreiner', 'classic_daily_curation_round128_2026_11_04'),
  ('Mhudi', 'Sol Plaatje', 'classic_daily_curation_round128_2026_11_04'),
  ('The Interesting Narrative of the Life of Olaudah Equiano', 'Olaudah Equiano', 'classic_daily_curation_round128_2026_11_04'),
  ('The Life of an Amorous Man', 'Ihara Saikaku', 'classic_daily_curation_round128_2026_11_04'),
  ('The Love Suicides at Sonezaki', 'Chikamatsu Monzaemon', 'classic_daily_curation_round128_2026_11_04'),
  ('The Blind Owl', 'Sadegh Hedayat', 'classic_daily_curation_round128_2026_11_04'),
  ('Hayy ibn Yaqzan', 'Ibn Tufayl', 'classic_daily_curation_round128_2026_11_04')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('Layla and Majnun by Nizami Ganjavi'),
  ('The Days by Taha Hussein'),
  ('Return of the Spirit by Tawfiq al-Hakim'),
  ('Epistle of Forgiveness by Abu al-Ala al-Maarri'),
  ('Godaan by Premchand'),
  ('Ramcharitmanas by Tulsidas'),
  ('The Little Clay Cart by Shudraka'),
  ('Anandamath by Bankim Chandra Chatterjee'),
  ('Songs of Kabir by Kabir'),
  ('Diwan-e-Ghalib by Mirza Ghalib'),
  ('Tirukkural by Thiruvalluvar'),
  ('Silappatikaram by Ilango Adigal'),
  ('Chaka by Thomas Mofolo'),
  ('The Story of an African Farm by Olive Schreiner'),
  ('Mhudi by Sol Plaatje'),
  ('The Interesting Narrative of the Life of Olaudah Equiano by Olaudah Equiano'),
  ('The Life of an Amorous Man by Ihara Saikaku'),
  ('The Love Suicides at Sonezaki by Chikamatsu Monzaemon'),
  ('The Blind Owl by Sadegh Hedayat'),
  ('Hayy ibn Yaqzan by Ibn Tufayl')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
