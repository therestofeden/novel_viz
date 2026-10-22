-- Round 120 (2026-10-22, daily novel_viz book-coverage task).
-- Pairs with classic.ts round 120 per canon-coverage.test.ts. Idempotent.

insert into canon_books (title, author, source) values
  ('Lady Chatterley''s Lover', 'D. H. Lawrence', 'classic_daily_curation_round120_2026_10_22'),
  ('Barry Lyndon', 'William Makepeace Thackeray', 'classic_daily_curation_round120_2026_10_22'),
  ('Sybil', 'Benjamin Disraeli', 'classic_daily_curation_round120_2026_10_22'),
  ('Omoo', 'Herman Melville', 'classic_daily_curation_round120_2026_10_22'),
  ('Nightmare Abbey', 'Thomas Love Peacock', 'classic_daily_curation_round120_2026_10_22'),
  ('Peter Pan', 'J. M. Barrie', 'classic_daily_curation_round120_2026_10_22'),
  ('The Gift', 'Marcel Mauss', 'classic_daily_curation_round120_2026_10_22'),
  ('Feudal Society', 'Marc Bloch', 'classic_daily_curation_round120_2026_10_22'),
  ('The Waning of the Middle Ages', 'Johan Huizinga', 'classic_daily_curation_round120_2026_10_22'),
  ('The Civilization of the Renaissance in Italy', 'Jacob Burckhardt', 'classic_daily_curation_round120_2026_10_22'),
  ('Creative Evolution', 'Henri Bergson', 'classic_daily_curation_round120_2026_10_22'),
  ('Phenomenology of Perception', 'Maurice Merleau-Ponty', 'classic_daily_curation_round120_2026_10_22'),
  ('Truth and Method', 'Hans-Georg Gadamer', 'classic_daily_curation_round120_2026_10_22'),
  ('History and Class Consciousness', 'Georg Lukacs', 'classic_daily_curation_round120_2026_10_22'),
  ('Dialectic of Enlightenment', 'Theodor W. Adorno and Max Horkheimer', 'classic_daily_curation_round120_2026_10_22'),
  ('A Treatise Concerning the Principles of Human Knowledge', 'George Berkeley', 'classic_daily_curation_round120_2026_10_22'),
  ('Witchcraft, Oracles and Magic among the Azande', 'E. E. Evans-Pritchard', 'classic_daily_curation_round120_2026_10_22'),
  ('Mutual Aid: A Factor of Evolution', 'Peter Kropotkin', 'classic_daily_curation_round120_2026_10_22'),
  ('Mind, Self, and Society', 'George Herbert Mead', 'classic_daily_curation_round120_2026_10_22'),
  ('The Jewish War', 'Flavius Josephus', 'classic_daily_curation_round120_2026_10_22')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('Lady Chatterley''s Lover by D. H. Lawrence'),
  ('Barry Lyndon by William Makepeace Thackeray'),
  ('Sybil by Benjamin Disraeli'),
  ('Omoo by Herman Melville'),
  ('Nightmare Abbey by Thomas Love Peacock'),
  ('Peter Pan by J. M. Barrie'),
  ('The Gift by Marcel Mauss'),
  ('Feudal Society by Marc Bloch'),
  ('The Waning of the Middle Ages by Johan Huizinga'),
  ('The Civilization of the Renaissance in Italy by Jacob Burckhardt'),
  ('Creative Evolution by Henri Bergson'),
  ('Phenomenology of Perception by Maurice Merleau-Ponty'),
  ('Truth and Method by Hans-Georg Gadamer'),
  ('History and Class Consciousness by Georg Lukacs'),
  ('Dialectic of Enlightenment by Theodor W. Adorno and Max Horkheimer'),
  ('A Treatise Concerning the Principles of Human Knowledge by George Berkeley'),
  ('Witchcraft, Oracles and Magic among the Azande by E. E. Evans-Pritchard'),
  ('Mutual Aid: A Factor of Evolution by Peter Kropotkin'),
  ('Mind, Self, and Society by George Herbert Mead'),
  ('The Jewish War by Flavius Josephus')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
