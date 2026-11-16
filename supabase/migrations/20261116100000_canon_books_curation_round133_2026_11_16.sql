-- Round 133 (2026-11-16, weekly canon task). Pairs with classic.ts round 133 per canon-coverage.test.ts. Idempotent.

insert into canon_books (title, author, source) values
  ('Patterns of Culture', 'Ruth Benedict', 'classic_daily_curation_round133_2026_11_16'),
  ('Evolution and the Theory of Games', 'John Maynard Smith', 'classic_daily_curation_round133_2026_11_16'),
  ('The Art of Computer Programming', 'Donald Knuth', 'classic_daily_curation_round133_2026_11_16'),
  ('The Structure of Social Action', 'Talcott Parsons', 'classic_daily_curation_round133_2026_11_16'),
  ('Social Theory and Social Structure', 'Robert K. Merton', 'classic_daily_curation_round133_2026_11_16'),
  ('Human Action', 'Ludwig von Mises', 'classic_daily_curation_round133_2026_11_16'),
  ('Political Parties', 'Robert Michels', 'classic_daily_curation_round133_2026_11_16'),
  ('Ideology and Utopia', 'Karl Mannheim', 'classic_daily_curation_round133_2026_11_16'),
  ('Nations and Nationalism', 'Ernest Gellner', 'classic_daily_curation_round133_2026_11_16'),
  ('The Making of the English Working Class', 'E. P. Thompson', 'classic_daily_curation_round133_2026_11_16'),
  ('The Fractal Geometry of Nature', 'Benoît Mandelbrot', 'classic_daily_curation_round133_2026_11_16'),
  ('Exit, Voice, and Loyalty', 'Albert O. Hirschman', 'classic_daily_curation_round133_2026_11_16'),
  ('Proofs and Refutations', 'Imre Lakatos', 'classic_daily_curation_round133_2026_11_16'),
  ('Zeno''s Conscience', 'Italo Svevo', 'classic_daily_curation_round133_2026_11_16'),
  ('The Recognitions', 'William Gaddis', 'classic_daily_curation_round133_2026_11_16'),
  ('The Assistant', 'Bernard Malamud', 'classic_daily_curation_round133_2026_11_16'),
  ('Love in a Fallen City', 'Eileen Chang', 'classic_daily_curation_round133_2026_11_16'),
  ('The Shipyard', 'Juan Carlos Onetti', 'classic_daily_curation_round133_2026_11_16'),
  ('Jakob von Gunten', 'Robert Walser', 'classic_daily_curation_round133_2026_11_16'),
  ('Kolyma Tales', 'Varlam Shalamov', 'classic_daily_curation_round133_2026_11_16')
on conflict ((lower(title)), (lower(author))) do nothing;
