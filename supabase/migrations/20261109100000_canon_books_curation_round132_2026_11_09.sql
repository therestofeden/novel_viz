-- Round 132 (2026-11-09, daily novel_viz book-coverage task). Pairs with classic.ts round 132 per canon-coverage.test.ts. Idempotent.

insert into canon_books (title, author, source) values
  ('Open Veins of Latin America', 'Eduardo Galeano', 'classic_daily_curation_round132_2026_11_09'),
  ('The Masters and the Slaves', 'Gilberto Freyre', 'classic_daily_curation_round132_2026_11_09'),
  ('Cuban Counterpoint', 'Fernando Ortiz', 'classic_daily_curation_round132_2026_11_09'),
  ('A Short Account of the Destruction of the Indies', 'Bartolomé de las Casas', 'classic_daily_curation_round132_2026_11_09'),
  ('Roots of Brazil', 'Sérgio Buarque de Holanda', 'classic_daily_curation_round132_2026_11_09'),
  ('The Cosmic Race', 'José Vasconcelos', 'classic_daily_curation_round132_2026_11_09'),
  ('Reply to Sister Philothea', 'Sor Juana Inés de la Cruz', 'classic_daily_curation_round132_2026_11_09'),
  ('Gesta Danorum', 'Saxo Grammaticus', 'classic_daily_curation_round132_2026_11_09'),
  ('Hikayat Abdullah', 'Abdullah bin Abdul Kadir Munshi', 'classic_daily_curation_round132_2026_11_09'),
  ('Out of Africa', 'Karen Blixen', 'classic_daily_curation_round132_2026_11_09'),
  ('The Muqaddimah', 'Ibn Khaldun', 'classic_daily_curation_round132_2026_11_09'),
  ('Noli Me Tangere', 'José Rizal', 'classic_daily_curation_round132_2026_11_09'),
  ('El Filibusterismo', 'José Rizal', 'classic_daily_curation_round132_2026_11_09'),
  ('Pelle the Conqueror', 'Martin Andersen Nexø', 'classic_daily_curation_round132_2026_11_09'),
  ('Barabbas', 'Pär Lagerkvist', 'classic_daily_curation_round132_2026_11_09'),
  ('The Emigrants', 'Vilhelm Moberg', 'classic_daily_curation_round132_2026_11_09'),
  ('Love to the Grave', 'Haddis Alemayehu', 'classic_daily_curation_round132_2026_11_09'),
  ('Rosa Mistika', 'Euphrase Kezilahabi', 'classic_daily_curation_round132_2026_11_09'),
  ('Kusadikika', 'Shaaban Robert', 'classic_daily_curation_round132_2026_11_09'),
  ('Twilight in Djakarta', 'Mochtar Lubis', 'classic_daily_curation_round132_2026_11_09')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('Open Veins of Latin America by Eduardo Galeano'),
  ('The Masters and the Slaves by Gilberto Freyre'),
  ('Cuban Counterpoint by Fernando Ortiz'),
  ('A Short Account of the Destruction of the Indies by Bartolomé de las Casas'),
  ('Roots of Brazil by Sérgio Buarque de Holanda'),
  ('The Cosmic Race by José Vasconcelos'),
  ('Reply to Sister Philothea by Sor Juana Inés de la Cruz'),
  ('Gesta Danorum by Saxo Grammaticus'),
  ('Hikayat Abdullah by Abdullah bin Abdul Kadir Munshi'),
  ('Out of Africa by Karen Blixen'),
  ('The Muqaddimah by Ibn Khaldun'),
  ('Noli Me Tangere by José Rizal'),
  ('El Filibusterismo by José Rizal'),
  ('Pelle the Conqueror by Martin Andersen Nexø'),
  ('Barabbas by Pär Lagerkvist'),
  ('The Emigrants by Vilhelm Moberg'),
  ('Love to the Grave by Haddis Alemayehu'),
  ('Rosa Mistika by Euphrase Kezilahabi'),
  ('Kusadikika by Shaaban Robert'),
  ('Twilight in Djakarta by Mochtar Lubis')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
