-- Backfill canon_books with 8 titles (+ 9 genuinely-distinct akas) that
-- classic.ts/must-read.ts gained on 2026-07-19/07-20 (Nobel-laureate national
-- literary traditions: Vietnam, Korea, Yugoslavia, Hungary, Israel/Hebrew,
-- Nigeria, Jungian psychology, plus the picaresque founding text Lazarillo
-- de Tormes) but canon_books had not yet caught up to. Reconciles against
-- the same "search bar needs to be impeccable for the Classics" mandate as
-- the 2026-07-18 backfill.
--
-- NOTE: this migration was originally applied directly via the Supabase
-- MCP tool on 2026-07-20 (see memory: novelviz-book-coverage-strategy,
-- "Round 15") but the corresponding local .sql file was never written to
-- the repo, so local/remote migration history silently diverged for a day.
-- Reconstructed 2026-07-21 from the live `canon_books` rows tagged
-- source='daily_agent_canon_backfill_2026_07_20' (17 rows, byte-identical
-- title/author values) so `supabase db reset` reproduces the real schema.
-- Guarded with WHERE NOT EXISTS since the underlying rows already exist
-- live; this file is a no-op if it or something equivalent is ever re-run.
INSERT INTO public.canon_books (title, author, source)
SELECT v.title, v.author, 'daily_agent_canon_backfill_2026_07_20'
FROM (VALUES
  ('The Tale of Kiều', 'Nguyễn Du'),
  ('Truyện Kiều', 'Nguyễn Du'),
  ('The Nine Cloud Dream', 'Kim Man-jung'),
  ('The Cloud Dream of the Nine', 'Kim Man-jung'),
  ('Kuunmong', 'Kim Man-jung'),
  ('Lazarillo de Tormes', 'Anonymous'),
  ('La Vida de Lazarillo de Tormes', 'Anonymous'),
  ('The Life of Lazarillo de Tormes', 'Anonymous'),
  ('The Bridge on the Drina', 'Ivo Andrić'),
  ('Na Drini Ćuprija', 'Ivo Andrić'),
  ('Fatelessness', 'Imre Kertész'),
  ('Fateless', 'Imre Kertész'),
  ('Sorstalanság', 'Imre Kertész'),
  ('Death and the King''s Horseman', 'Wole Soyinka'),
  ('Only Yesterday', 'S.Y. Agnon'),
  ('Tmol Shilshom', 'S.Y. Agnon'),
  ('Memories, Dreams, Reflections', 'Carl Jung')
) AS v(title, author)
WHERE NOT EXISTS (
  SELECT 1 FROM public.canon_books cb
  WHERE cb.title = v.title AND cb.author = v.author
);
