-- Backfill canon_books with the 6 titles (+ 6 genuinely-distinct aka rows)
-- classic.ts gained on 2026-07-22 (lyric poetry, Chinese/Sufi philosophy,
-- classical economics, and the graphic-novel gap) but canon_books had not
-- yet caught up to. Confirmed via direct query before writing this
-- migration: none of these titles/authors existed under any source
-- (organic novel_analyses or prior backfill rounds). Round 17 of the
-- reconciliation practice established 2026-07-19/07-20/07-21 (see memory:
-- novelviz-book-coverage-strategy).
INSERT INTO public.canon_books (title, author, source)
SELECT v.title, v.author, 'daily_agent_canon_backfill_2026_07_22'
FROM (VALUES
  ('Sappho: Poems and Fragments', 'Sappho'),
  ('The Poems of Sappho', 'Sappho'),
  ('Leaves of Grass', 'Walt Whitman'),
  ('The Zhuangzi', 'Zhuangzi'),
  ('Zhuangzi', 'Zhuangzi'),
  ('Chuang Tzu', 'Zhuangzi'),
  ('The Book of Chuang Tzu', 'Zhuangzi'),
  ('The Masnavi', 'Rumi'),
  ('Masnavi-ye Ma''navi', 'Rumi'),
  ('Mathnawi', 'Rumi'),
  ('Masnavi', 'Rumi'),
  ('An Essay on the Principle of Population', 'Thomas Malthus'),
  ('Essay on the Principle of Population', 'Thomas Malthus'),
  ('Maus', 'Art Spiegelman'),
  ('Maus: A Survivor''s Tale', 'Art Spiegelman'),
  ('The Complete Maus', 'Art Spiegelman')
) AS v(title, author)
WHERE NOT EXISTS (
  SELECT 1 FROM public.canon_books cb
  WHERE cb.title = v.title AND cb.author = v.author
);
