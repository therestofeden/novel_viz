-- Round 134 (2026-11-19, weekly canon task). Pairs with classic.ts round 134 per canon-coverage.test.ts. Idempotent.

insert into canon_books (title, author, source) values
  ('The Evolution of Cooperation', 'Robert Axelrod', 'classic_daily_curation_round134_2026_11_19'),
  ('Chance and Necessity', 'Jacques Monod', 'classic_daily_curation_round134_2026_11_19'),
  ('Against Method', 'Paul Feyerabend', 'classic_daily_curation_round134_2026_11_19'),
  ('Naming and Necessity', 'Saul Kripke', 'classic_daily_curation_round134_2026_11_19'),
  ('The Gift Relationship', 'Richard Titmuss', 'classic_daily_curation_round134_2026_11_19'),
  ('The Idea of History', 'R. G. Collingwood', 'classic_daily_curation_round134_2026_11_19'),
  ('Mohammed and Charlemagne', 'Henri Pirenne', 'classic_daily_curation_round134_2026_11_19'),
  ('Purity and Danger', 'Mary Douglas', 'classic_daily_curation_round134_2026_11_19'),
  ('The Civilizing Process', 'Norbert Elias', 'classic_daily_curation_round134_2026_11_19'),
  ('Imagined Communities', 'Benedict Anderson', 'classic_daily_curation_round134_2026_11_19'),
  ('The Sciences of the Artificial', 'Herbert A. Simon', 'classic_daily_curation_round134_2026_11_19'),
  ('Steps to an Ecology of Mind', 'Gregory Bateson', 'classic_daily_curation_round134_2026_11_19'),
  ('Under the Volcano', 'Malcolm Lowry', 'classic_daily_curation_round134_2026_11_19'),
  ('Stoner', 'John Williams', 'classic_daily_curation_round134_2026_11_19'),
  ('Chess Story', 'Stefan Zweig', 'classic_daily_curation_round134_2026_11_19'),
  ('On Heroes and Tombs', 'Ernesto Sabato', 'classic_daily_curation_round134_2026_11_19'),
  ('The Foundation Pit', 'Andrei Platonov', 'classic_daily_curation_round134_2026_11_19'),
  ('The Woman in the Dunes', 'Kōbō Abe', 'classic_daily_curation_round134_2026_11_19'),
  ('Pather Panchali', 'Bibhutibhushan Bandyopadhyay', 'classic_daily_curation_round134_2026_11_19'),
  ('The Ritual Process', 'Victor Turner', 'classic_daily_curation_round134_2026_11_19')
on conflict ((lower(title)), (lower(author))) do nothing;
