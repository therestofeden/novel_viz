-- Round 81 canon curation (2026-09-09): closes 4 founder/major-author gaps found after
-- the data-quality pass in this session (Frost missing from American poetry canon;
-- Wiener missing from the info-theory/computing-founders trio alongside Shannon/von Neumann;
-- Poincaré missing as a foundational philosophy-of-science/math-physics precursor;
-- Sacks missing from narrative-medicine nonfiction alongside Frankl/Kalanithi).
insert into canon_books (title, author, source) values
  ('North of Boston', 'Robert Frost', 'classic_daily_curation_round81_2026_09_09'),
  ('Cybernetics: Or Control and Communication in the Animal and the Machine', 'Norbert Wiener', 'classic_daily_curation_round81_2026_09_09'),
  ('Science and Hypothesis', 'Henri Poincaré', 'classic_daily_curation_round81_2026_09_09'),
  ('The Man Who Mistook His Wife for a Hat', 'Oliver Sacks', 'classic_daily_curation_round81_2026_09_09');
