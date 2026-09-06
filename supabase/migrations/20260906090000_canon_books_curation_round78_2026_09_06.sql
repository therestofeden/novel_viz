-- Round 78 (2026-09-06, scheduled daily_novel_viz_feat task): backfill
-- canon_books for the 5 titles now in classic.ts but confirmed absent from
-- canon_books (4 added this round: Averroes/Amos Oz/Hrabal/Tranströmer,
-- plus The Secret History of the Mongols added independently the same day
-- by the concurrent daily-must-read-and-classic task, also still missing
-- from canon_books). Primaries + genuinely-distinct akas only, skipping
-- near-duplicate subtitle variants, per the established convention.
INSERT INTO canon_books (title, author, source)
SELECT v.title, v.author, 'daily_agent_canon_backfill_2026_09_06'
FROM (VALUES
  ('The Incoherence of the Incoherence', 'Averroes'),
  ('Tahafut al-Tahafut', 'Averroes'),
  ('A Tale of Love and Darkness', 'Amos Oz'),
  ('Too Loud a Solitude', 'Bohumil Hrabal'),
  ('The Great Enigma: New Collected Poems', 'Tomas Tranströmer'),
  ('The Secret History of the Mongols', 'Anonymous')
) AS v(title, author)
WHERE NOT EXISTS (
  SELECT 1 FROM canon_books cb
  WHERE cb.title = v.title AND cb.author = v.author
);
