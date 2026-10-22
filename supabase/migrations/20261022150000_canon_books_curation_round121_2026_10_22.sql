-- Round 121 (2026-10-22, daily novel_viz book-coverage task, second run).
-- Pairs with classic.ts round 121 per canon-coverage.test.ts. Idempotent.

insert into canon_books (title, author, source) values
  ('The Awkward Age', 'Henry James', 'classic_daily_curation_round121_2026_10_22'),
  ('The Good Soldier Svejk', 'Jaroslav Hasek', 'classic_daily_curation_round121_2026_10_22'),
  ('Doctor Glas', 'Hjalmar Soderberg', 'classic_daily_curation_round121_2026_10_22'),
  ('Poor Folk', 'Fyodor Dostoevsky', 'classic_daily_curation_round121_2026_10_22'),
  ('Mother', 'Maxim Gorky', 'classic_daily_curation_round121_2026_10_22'),
  ('Marius the Epicurean', 'Walter Pater', 'classic_daily_curation_round121_2026_10_22'),
  ('The Conspiracy of Catiline', 'Sallust', 'classic_daily_curation_round121_2026_10_22'),
  ('The Rise of the Roman Empire', 'Polybius', 'classic_daily_curation_round121_2026_10_22'),
  ('Naturalis Historia', 'Pliny the Elder', 'classic_daily_curation_round121_2026_10_22'),
  ('The Essence of Christianity', 'Ludwig Feuerbach', 'classic_daily_curation_round121_2026_10_22'),
  ('The Ego and Its Own', 'Max Stirner', 'classic_daily_curation_round121_2026_10_22'),
  ('The English Constitution', 'Walter Bagehot', 'classic_daily_curation_round121_2026_10_22'),
  ('Ancient Law', 'Henry Sumner Maine', 'classic_daily_curation_round121_2026_10_22'),
  ('Primitive Culture', 'Edward Burnett Tylor', 'classic_daily_curation_round121_2026_10_22'),
  ('Community and Society', 'Ferdinand Tonnies', 'classic_daily_curation_round121_2026_10_22'),
  ('One-Dimensional Man', 'Herbert Marcuse', 'classic_daily_curation_round121_2026_10_22'),
  ('Principia Ethica', 'G. E. Moore', 'classic_daily_curation_round121_2026_10_22'),
  ('Sketch for a Historical Picture of the Progress of the Human Mind', 'Marquis de Condorcet', 'classic_daily_curation_round121_2026_10_22'),
  ('Hojoki', 'Kamo no Chomei', 'classic_daily_curation_round121_2026_10_22'),
  ('Essays in Idleness', 'Yoshida Kenko', 'classic_daily_curation_round121_2026_10_22')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('The Awkward Age by Henry James'),
  ('The Good Soldier Svejk by Jaroslav Hasek'),
  ('Doctor Glas by Hjalmar Soderberg'),
  ('Poor Folk by Fyodor Dostoevsky'),
  ('Mother by Maxim Gorky'),
  ('Marius the Epicurean by Walter Pater'),
  ('The Conspiracy of Catiline by Sallust'),
  ('The Rise of the Roman Empire by Polybius'),
  ('Naturalis Historia by Pliny the Elder'),
  ('The Essence of Christianity by Ludwig Feuerbach'),
  ('The Ego and Its Own by Max Stirner'),
  ('The English Constitution by Walter Bagehot'),
  ('Ancient Law by Henry Sumner Maine'),
  ('Primitive Culture by Edward Burnett Tylor'),
  ('Community and Society by Ferdinand Tonnies'),
  ('One-Dimensional Man by Herbert Marcuse'),
  ('Principia Ethica by G. E. Moore'),
  ('Sketch for a Historical Picture of the Progress of the Human Mind by Marquis de Condorcet'),
  ('Hojoki by Kamo no Chomei'),
  ('Essays in Idleness by Yoshida Kenko')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
