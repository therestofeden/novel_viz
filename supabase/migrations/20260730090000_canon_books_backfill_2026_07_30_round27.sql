-- Round 27/28 (2026-07-30, daily_novel_viz_feat): backfill canon_books for the
-- 2 round-27 classic.ts additions still missing from canon_books (search-books'
-- canon-boost source of truth). The Lord of the Rings was already present
-- (checked); Omeros and The Mythical Man-Month were not.
INSERT INTO canon_books (title, author, source)
SELECT v.title, v.author, 'daily_agent_canon_backfill_2026_07_30'
FROM (VALUES
  ('Omeros', 'Derek Walcott'),
  ('The Mythical Man-Month', 'Fred Brooks')
) AS v(title, author)
WHERE NOT EXISTS (
  SELECT 1 FROM canon_books cb
  WHERE lower(cb.title) = lower(v.title) AND lower(cb.author) = lower(v.author)
);
