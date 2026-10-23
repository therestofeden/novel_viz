-- Round 122 (2026-10-23, daily novel_viz book-coverage task). Pairs with classic.ts round 122 per canon-coverage.test.ts. Idempotent.

insert into canon_books (title, author, source) values
  ('Indian Summer', 'Adalbert Stifter', 'classic_daily_curation_round122_2026_10_23'),
  ('Niels Lyhne', 'J. P. Jacobsen', 'classic_daily_curation_round122_2026_10_23'),
  ('Dream Story', 'Arthur Schnitzler', 'classic_daily_curation_round122_2026_10_23'),
  ('The Sleepwalkers', 'Hermann Broch', 'classic_daily_curation_round122_2026_10_23'),
  ('Lady Macbeth of the Mtsensk District', 'Nikolai Leskov', 'classic_daily_curation_round122_2026_10_23'),
  ('Gosta Berling''s Saga', 'Selma Lagerlöf', 'classic_daily_curation_round122_2026_10_23'),
  ('Black Diamonds', 'Mor Jokai', 'classic_daily_curation_round122_2026_10_23'),
  ('Biographia Literaria', 'Samuel Taylor Coleridge', 'classic_daily_curation_round122_2026_10_23'),
  ('A Defence of Poetry', 'Percy Bysshe Shelley', 'classic_daily_curation_round122_2026_10_23'),
  ('Ideas for the Philosophy of History of Mankind', 'Johann Gottfried Herder', 'classic_daily_curation_round122_2026_10_23'),
  ('Addresses to the German Nation', 'Johann Gottlieb Fichte', 'classic_daily_curation_round122_2026_10_23'),
  ('The Life of Reason', 'George Santayana', 'classic_daily_curation_round122_2026_10_23'),
  ('The Study of Sociology', 'Herbert Spencer', 'classic_daily_curation_round122_2026_10_23'),
  ('The Mind and Society', 'Vilfredo Pareto', 'classic_daily_curation_round122_2026_10_23'),
  ('The Andaman Islanders', 'A. R. Radcliffe-Brown', 'classic_daily_curation_round122_2026_10_23'),
  ('Totality and Infinity', 'Emmanuel Levinas', 'classic_daily_curation_round122_2026_10_23'),
  ('The Structural Transformation of the Public Sphere', 'Jürgen Habermas', 'classic_daily_curation_round122_2026_10_23'),
  ('The Wars of Justinian', 'Procopius', 'classic_daily_curation_round122_2026_10_23'),
  ('Institutio Oratoria', 'Quintilian', 'classic_daily_curation_round122_2026_10_23'),
  ('Kama Sutra', 'Vatsyayana', 'classic_daily_curation_round122_2026_10_23')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('Indian Summer by Adalbert Stifter'),
  ('Niels Lyhne by J. P. Jacobsen'),
  ('Dream Story by Arthur Schnitzler'),
  ('The Sleepwalkers by Hermann Broch'),
  ('Lady Macbeth of the Mtsensk District by Nikolai Leskov'),
  ('Gosta Berling''s Saga by Selma Lagerlöf'),
  ('Black Diamonds by Mor Jokai'),
  ('Biographia Literaria by Samuel Taylor Coleridge'),
  ('A Defence of Poetry by Percy Bysshe Shelley'),
  ('Ideas for the Philosophy of History of Mankind by Johann Gottfried Herder'),
  ('Addresses to the German Nation by Johann Gottlieb Fichte'),
  ('The Life of Reason by George Santayana'),
  ('The Study of Sociology by Herbert Spencer'),
  ('The Mind and Society by Vilfredo Pareto'),
  ('The Andaman Islanders by A. R. Radcliffe-Brown'),
  ('Totality and Infinity by Emmanuel Levinas'),
  ('The Structural Transformation of the Public Sphere by Jürgen Habermas'),
  ('The Wars of Justinian by Procopius'),
  ('Institutio Oratoria by Quintilian'),
  ('Kama Sutra by Vatsyayana')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
