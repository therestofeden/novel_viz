-- Round 124 (2026-10-26, daily novel_viz book-coverage task). Pairs with classic.ts round 124 per canon-coverage.test.ts. Idempotent.

insert into canon_books (title, author, source) values
  ('The House by the Medlar Tree', 'Giovanni Verga', 'classic_daily_curation_round124_2026_10_26'),
  ('History of Italy', 'Francesco Guicciardini', 'classic_daily_curation_round124_2026_10_26'),
  ('Gulistan', 'Saadi', 'classic_daily_curation_round124_2026_10_26'),
  ('Strange Tales from a Chinese Studio', 'Pu Songling', 'classic_daily_curation_round124_2026_10_26'),
  ('Memoirs of the Duke of Saint-Simon', 'Duc de Saint-Simon', 'classic_daily_curation_round124_2026_10_26'),
  ('Discourse on Universal History', 'Jacques-Benigne Bossuet', 'classic_daily_curation_round124_2026_10_26'),
  ('Autobiography', 'Benvenuto Cellini', 'classic_daily_curation_round124_2026_10_26'),
  ('History of Italian Literature', 'Francesco De Sanctis', 'classic_daily_curation_round124_2026_10_26'),
  ('Operette morali', 'Giacomo Leopardi', 'classic_daily_curation_round124_2026_10_26'),
  ('The Three-Cornered Hat', 'Pedro Antonio de Alarcon', 'classic_daily_curation_round124_2026_10_26'),
  ('La Regenta', 'Leopoldo Alas Clarin', 'classic_daily_curation_round124_2026_10_26'),
  ('The House of Ulloa', 'Emilia Pardo Bazan', 'classic_daily_curation_round124_2026_10_26'),
  ('Pepita Jimenez', 'Juan Valera', 'classic_daily_curation_round124_2026_10_26'),
  ('The Doll', 'Boleslaw Prus', 'classic_daily_curation_round124_2026_10_26'),
  ('The Golden Man', 'Mor Jokai', 'classic_daily_curation_round124_2026_10_26'),
  ('Iracema', 'Jose de Alencar', 'classic_daily_curation_round124_2026_10_26'),
  ('La Celestina', 'Fernando de Rojas', 'classic_daily_curation_round124_2026_10_26'),
  ('Hyperion', 'Friedrich Holderlin', 'classic_daily_curation_round124_2026_10_26'),
  ('The Last Letters of Jacopo Ortis', 'Ugo Foscolo', 'classic_daily_curation_round124_2026_10_26'),
  ('Confessions of an Italian', 'Ippolito Nievo', 'classic_daily_curation_round124_2026_10_26')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('The House by the Medlar Tree by Giovanni Verga'),
  ('History of Italy by Francesco Guicciardini'),
  ('Gulistan by Saadi'),
  ('Strange Tales from a Chinese Studio by Pu Songling'),
  ('Memoirs of the Duke of Saint-Simon by Duc de Saint-Simon'),
  ('Discourse on Universal History by Jacques-Benigne Bossuet'),
  ('Autobiography by Benvenuto Cellini'),
  ('History of Italian Literature by Francesco De Sanctis'),
  ('Operette morali by Giacomo Leopardi'),
  ('The Three-Cornered Hat by Pedro Antonio de Alarcon'),
  ('La Regenta by Leopoldo Alas Clarin'),
  ('The House of Ulloa by Emilia Pardo Bazan'),
  ('Pepita Jimenez by Juan Valera'),
  ('The Doll by Boleslaw Prus'),
  ('The Golden Man by Mor Jokai'),
  ('Iracema by Jose de Alencar'),
  ('La Celestina by Fernando de Rojas'),
  ('Hyperion by Friedrich Holderlin'),
  ('The Last Letters of Jacopo Ortis by Ugo Foscolo'),
  ('Confessions of an Italian by Ippolito Nievo')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
