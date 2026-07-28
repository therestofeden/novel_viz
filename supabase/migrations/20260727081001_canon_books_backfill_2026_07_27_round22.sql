-- Round 22 (2026-07-27, daily_novel_viz_feat): backfill canon_books against
-- novelviz-daily-canon-curation's 13th run (classic.ts 226->231), closing the
-- 20th-century-drama + rationalist/existentialist-philosophy gap.
INSERT INTO canon_books (title, author, source)
SELECT v.title, v.author, 'daily_agent_canon_backfill_2026_07_27'
FROM (VALUES
  ('Waiting for Godot', 'Samuel Beckett'),
  ('Death of a Salesman', 'Arthur Miller'),
  ('A Streetcar Named Desire', 'Tennessee Williams'),
  ('Ethics', 'Baruch Spinoza'),
  ('Fear and Trembling', 'Søren Kierkegaard')
) AS v(title, author)
WHERE NOT EXISTS (
  SELECT 1 FROM canon_books cb
  WHERE lower(cb.title) = lower(v.title) AND lower(cb.author) = lower(v.author)
);
