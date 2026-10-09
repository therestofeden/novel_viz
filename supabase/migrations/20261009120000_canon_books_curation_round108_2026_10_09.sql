-- Round 108 (2026-10-09, daily novel_viz book-coverage task).
-- Pairs with classic.ts round 108 per canon-coverage.test.ts. All titles checked
-- against every prior migration: zero existing hits. Idempotent.

insert into canon_books (title, author, source) values
  ('Absalom, Absalom!', 'William Faulkner', 'classic_daily_curation_round108_2026_10_09'),
  ('The House of Mirth', 'Edith Wharton', 'classic_daily_curation_round108_2026_10_09'),
  ('Nostromo', 'Joseph Conrad', 'classic_daily_curation_round108_2026_10_09'),
  ('The Moonstone', 'Wilkie Collins', 'classic_daily_curation_round108_2026_10_09'),
  ('Silas Marner', 'George Eliot', 'classic_daily_curation_round108_2026_10_09'),
  ('Cancer Ward', 'Aleksandr Solzhenitsyn', 'classic_daily_curation_round108_2026_10_09'),
  ('Black Boy', 'Richard Wright', 'classic_daily_curation_round108_2026_10_09'),
  ('Incidents in the Life of a Slave Girl', 'Harriet Jacobs', 'classic_daily_curation_round108_2026_10_09'),
  ('Emile, or On Education', 'Jean-Jacques Rousseau', 'classic_daily_curation_round108_2026_10_09'),
  ('Rights of Man', 'Thomas Paine', 'classic_daily_curation_round108_2026_10_09'),
  ('The Maltese Falcon', 'Dashiell Hammett', 'classic_daily_curation_round108_2026_10_09'),
  ('The Aleph', 'Jorge Luis Borges', 'classic_daily_curation_round108_2026_10_09')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('Absalom, Absalom! by William Faulkner'),
  ('The House of Mirth by Edith Wharton'),
  ('Nostromo by Joseph Conrad'),
  ('The Moonstone by Wilkie Collins'),
  ('Silas Marner by George Eliot'),
  ('Cancer Ward by Aleksandr Solzhenitsyn'),
  ('Black Boy by Richard Wright'),
  ('Incidents in the Life of a Slave Girl by Harriet Jacobs'),
  ('Emile, or On Education by Jean-Jacques Rousseau'),
  ('Rights of Man by Thomas Paine'),
  ('The Maltese Falcon by Dashiell Hammett'),
  ('The Aleph by Jorge Luis Borges')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
