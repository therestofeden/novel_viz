-- Round 131 (2026-11-08, daily novel_viz book-coverage task). Pairs with classic.ts round 131 per canon-coverage.test.ts. Idempotent.

insert into canon_books (title, author, source) values
  ('Rajatarangini', 'Kalhana', 'classic_daily_curation_round131_2026_11_08'),
  ('Akbarnama', 'Abul Fazl', 'classic_daily_curation_round131_2026_11_08'),
  ('Kitab al-Hind', 'Al-Biruni', 'classic_daily_curation_round131_2026_11_08'),
  ('The Description of Africa', 'Leo Africanus', 'classic_daily_curation_round131_2026_11_08'),
  ('God''s Bits of Wood', 'Ousmane Sembène', 'classic_daily_curation_round131_2026_11_08'),
  ('The African Child', 'Camara Laye', 'classic_daily_curation_round131_2026_11_08'),
  ('The African Origin of Civilization', 'Cheikh Anta Diop', 'classic_daily_curation_round131_2026_11_08'),
  ('Annihilation of Caste', 'B. R. Ambedkar', 'classic_daily_curation_round131_2026_11_08'),
  ('The Discovery of India', 'Jawaharlal Nehru', 'classic_daily_curation_round131_2026_11_08'),
  ('Dnyaneshwari', 'Dnyaneshwar', 'classic_daily_curation_round131_2026_11_08'),
  ('The Book of Animals', 'Al-Jahiz', 'classic_daily_curation_round131_2026_11_08'),
  ('The Ring of the Dove', 'Ibn Hazm', 'classic_daily_curation_round131_2026_11_08'),
  ('History of the Prophets and Kings', 'Al-Tabari', 'classic_daily_curation_round131_2026_11_08'),
  ('Compendium of Chronicles', 'Rashid al-Din', 'classic_daily_curation_round131_2026_11_08'),
  ('Book of Han', 'Ban Gu', 'classic_daily_curation_round131_2026_11_08'),
  ('Ferdydurke', 'Witold Gombrowicz', 'classic_daily_curation_round131_2026_11_08'),
  ('Saint Peter''s Umbrella', 'Kálmán Mikszáth', 'classic_daily_curation_round131_2026_11_08'),
  ('Forest of the Hanged', 'Liviu Rebreanu', 'classic_daily_curation_round131_2026_11_08'),
  ('The Beautyful Ones Are Not Yet Born', 'Ayi Kwei Armah', 'classic_daily_curation_round131_2026_11_08'),
  ('Woman at Point Zero', 'Nawal El Saadawi', 'classic_daily_curation_round131_2026_11_08')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('Rajatarangini by Kalhana'),
  ('Akbarnama by Abul Fazl'),
  ('Kitab al-Hind by Al-Biruni'),
  ('The Description of Africa by Leo Africanus'),
  ('God''s Bits of Wood by Ousmane Sembène'),
  ('The African Child by Camara Laye'),
  ('The African Origin of Civilization by Cheikh Anta Diop'),
  ('Annihilation of Caste by B. R. Ambedkar'),
  ('The Discovery of India by Jawaharlal Nehru'),
  ('Dnyaneshwari by Dnyaneshwar'),
  ('The Book of Animals by Al-Jahiz'),
  ('The Ring of the Dove by Ibn Hazm'),
  ('History of the Prophets and Kings by Al-Tabari'),
  ('Compendium of Chronicles by Rashid al-Din'),
  ('Book of Han by Ban Gu'),
  ('Ferdydurke by Witold Gombrowicz'),
  ('Saint Peter''s Umbrella by Kálmán Mikszáth'),
  ('Forest of the Hanged by Liviu Rebreanu'),
  ('The Beautyful Ones Are Not Yet Born by Ayi Kwei Armah'),
  ('Woman at Point Zero by Nawal El Saadawi')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
