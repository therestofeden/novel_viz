-- Backfill canon_books with the 5 titles (+ 8 genuinely-distinct aka rows)
-- classic.ts gained on 2026-07-24 (world historiography beyond Greco-Roman,
-- global travel literature, and testimonial autobiography/diary) but
-- canon_books had not yet caught up to. Confirmed via direct query before
-- writing this migration: none of these titles/authors existed under any
-- source (organic novel_analyses or prior backfill rounds). Round 19 of the
-- reconciliation practice established 2026-07-19 through 07-23 (see
-- memory: novelviz-book-coverage-strategy).
INSERT INTO public.canon_books (title, author, source)
SELECT v.title, v.author, 'daily_agent_canon_backfill_2026_07_24'
FROM (VALUES
  ('Records of the Grand Historian', 'Sima Qian'),
  ('Shiji', 'Sima Qian'),
  ('The Grand Scribe''s Records', 'Sima Qian'),
  ('The Travels of Marco Polo', 'Marco Polo'),
  ('The Book of the Marvels of the World', 'Marco Polo'),
  ('Il Milione', 'Marco Polo'),
  ('The Rihla', 'Ibn Battuta'),
  ('The Travels of Ibn Battuta', 'Ibn Battuta'),
  ('A Gift to Those Who Contemplate the Wonders of Cities and the Marvels of Traveling', 'Ibn Battuta'),
  ('The Autobiography of Malcolm X', 'Malcolm X'),
  ('The Diary of a Young Girl', 'Anne Frank'),
  ('The Diary of Anne Frank', 'Anne Frank'),
  ('Het Achterhuis', 'Anne Frank')
) AS v(title, author)
WHERE NOT EXISTS (
  SELECT 1 FROM public.canon_books cb
  WHERE cb.title = v.title AND cb.author = v.author
);
