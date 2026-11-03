-- Round 127 (2026-11-03, daily novel_viz book-coverage task). Pairs with classic.ts round 127 per canon-coverage.test.ts. Idempotent.

insert into canon_books (title, author, source) values
  ('Family Chronicle', 'Sergei Aksakov', 'classic_daily_curation_round127_2026_11_03'),
  ('God and the State', 'Mikhail Bakunin', 'classic_daily_curation_round127_2026_11_03'),
  ('The Blind Musician', 'Vladimir Korolenko', 'classic_daily_curation_round127_2026_11_03'),
  ('Four Days', 'Vsevolod Garshin', 'classic_daily_curation_round127_2026_11_03'),
  ('The Golovlyov Family', 'Mikhail Saltykov-Shchedrin', 'classic_daily_curation_round127_2026_11_03'),
  ('One Thousand Souls', 'Aleksey Pisemsky', 'classic_daily_curation_round127_2026_11_03'),
  ('Ahasver in Rome', 'Robert Hamerling', 'classic_daily_curation_round127_2026_11_03'),
  ('The Forest Schoolmaster', 'Peter Rosegger', 'classic_daily_curation_round127_2026_11_03'),
  ('Maria Magdalena', 'Friedrich Hebbel', 'classic_daily_curation_round127_2026_11_03'),
  ('Munchhausen', 'Karl Immermann', 'classic_daily_curation_round127_2026_11_03'),
  ('Aladdin', 'Adam Oehlenschlager', 'classic_daily_curation_round127_2026_11_03'),
  ('L''Atlantida', 'Jacint Verdaguer', 'classic_daily_curation_round127_2026_11_03'),
  ('Kalevipoeg', 'Friedrich Reinhold Kreutzwald', 'classic_daily_curation_round127_2026_11_03'),
  ('Lacplesis', 'Andrejs Pumpurs', 'classic_daily_curation_round127_2026_11_03'),
  ('The Free Besieged', 'Dionysios Solomos', 'classic_daily_curation_round127_2026_11_03'),
  ('The Murderess', 'Alexandros Papadiamantis', 'classic_daily_curation_round127_2026_11_03'),
  ('Under the Yoke', 'Ivan Vazov', 'classic_daily_curation_round127_2026_11_03'),
  ('Hadji Dimitar', 'Hristo Botev', 'classic_daily_curation_round127_2026_11_03'),
  ('The Seasons', 'Kristijonas Donelaitis', 'classic_daily_curation_round127_2026_11_03'),
  ('Gold Fever', 'Narcis Oller', 'classic_daily_curation_round127_2026_11_03')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('Family Chronicle by Sergei Aksakov'),
  ('God and the State by Mikhail Bakunin'),
  ('The Blind Musician by Vladimir Korolenko'),
  ('Four Days by Vsevolod Garshin'),
  ('The Golovlyov Family by Mikhail Saltykov-Shchedrin'),
  ('One Thousand Souls by Aleksey Pisemsky'),
  ('Ahasver in Rome by Robert Hamerling'),
  ('The Forest Schoolmaster by Peter Rosegger'),
  ('Maria Magdalena by Friedrich Hebbel'),
  ('Munchhausen by Karl Immermann'),
  ('Aladdin by Adam Oehlenschlager'),
  ('L''Atlantida by Jacint Verdaguer'),
  ('Kalevipoeg by Friedrich Reinhold Kreutzwald'),
  ('Lacplesis by Andrejs Pumpurs'),
  ('The Free Besieged by Dionysios Solomos'),
  ('The Murderess by Alexandros Papadiamantis'),
  ('Under the Yoke by Ivan Vazov'),
  ('Hadji Dimitar by Hristo Botev'),
  ('The Seasons by Kristijonas Donelaitis'),
  ('Gold Fever by Narcis Oller')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
