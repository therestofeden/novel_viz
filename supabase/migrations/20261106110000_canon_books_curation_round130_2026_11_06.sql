-- Round 130 (2026-11-06, daily novel_viz book-coverage task). Pairs with classic.ts round 130 per canon-coverage.test.ts. Idempotent.

insert into canon_books (title, author, source) values
  ('Truth and Justice', 'A. H. Tammsaare', 'classic_daily_curation_round130_2026_11_06'),
  ('The Milkman of Mäeküla', 'Eduard Vilde', 'classic_daily_curation_round130_2026_11_06'),
  ('Fire and Night', 'Rainis', 'classic_daily_curation_round130_2026_11_06'),
  ('In the Shadow of Death', 'Rūdolfs Blaumanis', 'classic_daily_curation_round130_2026_11_06'),
  ('Voices of Spring', 'Maironis', 'classic_daily_curation_round130_2026_11_06'),
  ('The Baburnama', 'Babur', 'classic_daily_curation_round130_2026_11_06'),
  ('Book of Words', 'Abai Kunanbaev', 'classic_daily_curation_round130_2026_11_06'),
  ('Jamila', 'Chingiz Aitmatov', 'classic_daily_curation_round130_2026_11_06'),
  ('Compendium of the Turkic Dialects', 'Mahmud al-Kashgari', 'classic_daily_curation_round130_2026_11_06'),
  ('Wisdom of Royal Glory', 'Yusuf Balasaghuni', 'classic_daily_curation_round130_2026_11_06'),
  ('Samguk Yusa', 'Iryeon', 'classic_daily_curation_round130_2026_11_06'),
  ('Samguk Sagi', 'Kim Busik', 'classic_daily_curation_round130_2026_11_06'),
  ('The Story of Hong Gildong', 'Heo Gyun', 'classic_daily_curation_round130_2026_11_06'),
  ('The Jehol Diary', 'Park Jiwon', 'classic_daily_curation_round130_2026_11_06'),
  ('The Tale of Chunhyang', 'Anonymous', 'classic_daily_curation_round130_2026_11_06'),
  ('Instructions for Practical Living', 'Wang Yangming', 'classic_daily_curation_round130_2026_11_06'),
  ('The Literary Mind and the Carving of Dragons', 'Liu Xie', 'classic_daily_curation_round130_2026_11_06'),
  ('Reflections on Things at Hand', 'Zhu Xi', 'classic_daily_curation_round130_2026_11_06'),
  ('Waiting for the Dawn', 'Huang Zongxi', 'classic_daily_curation_round130_2026_11_06'),
  ('The Travel Diaries of Xu Xiake', 'Xu Xiake', 'classic_daily_curation_round130_2026_11_06')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('Truth and Justice by A. H. Tammsaare'),
  ('The Milkman of Mäeküla by Eduard Vilde'),
  ('Fire and Night by Rainis'),
  ('In the Shadow of Death by Rūdolfs Blaumanis'),
  ('Voices of Spring by Maironis'),
  ('The Baburnama by Babur'),
  ('Book of Words by Abai Kunanbaev'),
  ('Jamila by Chingiz Aitmatov'),
  ('Compendium of the Turkic Dialects by Mahmud al-Kashgari'),
  ('Wisdom of Royal Glory by Yusuf Balasaghuni'),
  ('Samguk Yusa by Iryeon'),
  ('Samguk Sagi by Kim Busik'),
  ('The Story of Hong Gildong by Heo Gyun'),
  ('The Jehol Diary by Park Jiwon'),
  ('The Tale of Chunhyang by Anonymous'),
  ('Instructions for Practical Living by Wang Yangming'),
  ('The Literary Mind and the Carving of Dragons by Liu Xie'),
  ('Reflections on Things at Hand by Zhu Xi'),
  ('Waiting for the Dawn by Huang Zongxi'),
  ('The Travel Diaries of Xu Xiake by Xu Xiake')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
