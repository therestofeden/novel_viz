-- Round 129 (2026-11-05, daily novel_viz book-coverage task). Pairs with classic.ts round 129 per canon-coverage.test.ts. Idempotent.

insert into canon_books (title, author, source) values
  ('Doña Bárbara', 'Rómulo Gallegos', 'classic_daily_curation_round129_2026_11_05'),
  ('Don Segundo Sombra', 'Ricardo Güiraldes', 'classic_daily_curation_round129_2026_11_05'),
  ('The Underdogs', 'Mariano Azuela', 'classic_daily_curation_round129_2026_11_05'),
  ('Facundo: Civilization and Barbarism', 'Domingo Faustino Sarmiento', 'classic_daily_curation_round129_2026_11_05'),
  ('Martín Fierro', 'José Hernández', 'classic_daily_curation_round129_2026_11_05'),
  ('María', 'Jorge Isaacs', 'classic_daily_curation_round129_2026_11_05'),
  ('Rebellion in the Backlands', 'Euclides da Cunha', 'classic_daily_curation_round129_2026_11_05'),
  ('Azul...', 'Rubén Darío', 'classic_daily_curation_round129_2026_11_05'),
  ('The President', 'Miguel Ángel Asturias', 'classic_daily_curation_round129_2026_11_05'),
  ('The Itching Parrot', 'José Joaquín Fernández de Lizardi', 'classic_daily_curation_round129_2026_11_05'),
  ('Seven Interpretive Essays on Peruvian Reality', 'José Carlos Mariátegui', 'classic_daily_curation_round129_2026_11_05'),
  ('Collected Poems', 'C. P. Cavafy', 'classic_daily_curation_round129_2026_11_05'),
  ('The Axion Esti', 'Odysseas Elytis', 'classic_daily_curation_round129_2026_11_05'),
  ('Mythistorema', 'George Seferis', 'classic_daily_curation_round129_2026_11_05'),
  ('Florante at Laura', 'Francisco Balagtas', 'classic_daily_curation_round129_2026_11_05'),
  ('Malay Annals', 'Tun Sri Lanang', 'classic_daily_curation_round129_2026_11_05'),
  ('Letters of a Javanese Princess', 'Raden Adjeng Kartini', 'classic_daily_curation_round129_2026_11_05'),
  ('The Lonely Londoners', 'Sam Selvon', 'classic_daily_curation_round129_2026_11_05'),
  ('In the Castle of My Skin', 'George Lamming', 'classic_daily_curation_round129_2026_11_05'),
  ('The Black Jacobins', 'C. L. R. James', 'classic_daily_curation_round129_2026_11_05')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('Doña Bárbara by Rómulo Gallegos'),
  ('Don Segundo Sombra by Ricardo Güiraldes'),
  ('The Underdogs by Mariano Azuela'),
  ('Facundo: Civilization and Barbarism by Domingo Faustino Sarmiento'),
  ('Martín Fierro by José Hernández'),
  ('María by Jorge Isaacs'),
  ('Rebellion in the Backlands by Euclides da Cunha'),
  ('Azul... by Rubén Darío'),
  ('The President by Miguel Ángel Asturias'),
  ('The Itching Parrot by José Joaquín Fernández de Lizardi'),
  ('Seven Interpretive Essays on Peruvian Reality by José Carlos Mariátegui'),
  ('Collected Poems by C. P. Cavafy'),
  ('The Axion Esti by Odysseas Elytis'),
  ('Mythistorema by George Seferis'),
  ('Florante at Laura by Francisco Balagtas'),
  ('Malay Annals by Tun Sri Lanang'),
  ('Letters of a Javanese Princess by Raden Adjeng Kartini'),
  ('The Lonely Londoners by Sam Selvon'),
  ('In the Castle of My Skin by George Lamming'),
  ('The Black Jacobins by C. L. R. James')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
