-- Round 123 (2026-10-24, daily novel_viz book-coverage task). Pairs with classic.ts round 123 per canon-coverage.test.ts. Idempotent.

insert into canon_books (title, author, source) values
  ('The Village', 'Ivan Bunin', 'classic_daily_curation_round123_2026_10_24'),
  ('The Hunger-Pastor', 'Wilhelm Raabe', 'classic_daily_curation_round123_2026_10_24'),
  ('The Peasants', 'Władysław Reymont', 'classic_daily_curation_round123_2026_10_24'),
  ('Green Henry', 'Gottfried Keller', 'classic_daily_curation_round123_2026_10_24'),
  ('Seven Brothers', 'Aleksis Kivi', 'classic_daily_curation_round123_2026_10_24'),
  ('The Maias', 'Eça de Queirós', 'classic_daily_curation_round123_2026_10_24'),
  ('Fortunata and Jacinta', 'Benito Pérez Galdós', 'classic_daily_curation_round123_2026_10_24'),
  ('Geographica', 'Strabo', 'classic_daily_curation_round123_2026_10_24'),
  ('The Later Roman Empire', 'Ammianus Marcellinus', 'classic_daily_curation_round123_2026_10_24'),
  ('On the Aesthetic Education of Man', 'Friedrich Schiller', 'classic_daily_curation_round123_2026_10_24'),
  ('The World and the Individual', 'Josiah Royce', 'classic_daily_curation_round123_2026_10_24'),
  ('Introduction to the Human Sciences', 'Wilhelm Dilthey', 'classic_daily_curation_round123_2026_10_24'),
  ('The History of Rome', 'Theodor Mommsen', 'classic_daily_curation_round123_2026_10_24'),
  ('What Is Christianity?', 'Adolf von Harnack', 'classic_daily_curation_round123_2026_10_24'),
  ('Psychology from an Empirical Standpoint', 'Franz Brentano', 'classic_daily_curation_round123_2026_10_24'),
  ('Principles of Physiological Psychology', 'Wilhelm Wundt', 'classic_daily_curation_round123_2026_10_24'),
  ('A History of Philosophy', 'Wilhelm Windelband', 'classic_daily_curation_round123_2026_10_24'),
  ('Microcosmos', 'Hermann Lotze', 'classic_daily_curation_round123_2026_10_24'),
  ('Conversations with Goethe', 'Johann Peter Eckermann', 'classic_daily_curation_round123_2026_10_24'),
  ('On the Law of Nature and of Nations', 'Samuel von Pufendorf', 'classic_daily_curation_round123_2026_10_24')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('The Village by Ivan Bunin'),
  ('The Hunger-Pastor by Wilhelm Raabe'),
  ('The Peasants by Władysław Reymont'),
  ('Green Henry by Gottfried Keller'),
  ('Seven Brothers by Aleksis Kivi'),
  ('The Maias by Eça de Queirós'),
  ('Fortunata and Jacinta by Benito Pérez Galdós'),
  ('Geographica by Strabo'),
  ('The Later Roman Empire by Ammianus Marcellinus'),
  ('On the Aesthetic Education of Man by Friedrich Schiller'),
  ('The World and the Individual by Josiah Royce'),
  ('Introduction to the Human Sciences by Wilhelm Dilthey'),
  ('The History of Rome by Theodor Mommsen'),
  ('What Is Christianity? by Adolf von Harnack'),
  ('Psychology from an Empirical Standpoint by Franz Brentano'),
  ('Principles of Physiological Psychology by Wilhelm Wundt'),
  ('A History of Philosophy by Wilhelm Windelband'),
  ('Microcosmos by Hermann Lotze'),
  ('Conversations with Goethe by Johann Peter Eckermann'),
  ('On the Law of Nature and of Nations by Samuel von Pufendorf')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
