-- Round 79 (2026-09-07, daily-must-read-and-classic scheduled task)
-- Backfills canon_books + seed_book_list for the 4 titles added to
-- src/lib/classic.ts this round: Auguste Comte (sociology/positivism
-- founder), Edmund Husserl (phenomenology founder), James Clerk Maxwell
-- (electromagnetism founder), Wisława Szymborska (Polish Nobel poet).

INSERT INTO canon_books (title, author, source) VALUES
  ('The Positive Philosophy of Auguste Comte', 'Auguste Comte', 'daily_agent_canon_backfill_2026_09_07_round79'),
  ('Course of Positive Philosophy', 'Auguste Comte', 'daily_agent_canon_backfill_2026_09_07_round79'),
  ('Cours de philosophie positive', 'Auguste Comte', 'daily_agent_canon_backfill_2026_09_07_round79'),
  ('Ideas: General Introduction to Pure Phenomenology', 'Edmund Husserl', 'daily_agent_canon_backfill_2026_09_07_round79'),
  ('Ideen', 'Edmund Husserl', 'daily_agent_canon_backfill_2026_09_07_round79'),
  ('A Treatise on Electricity and Magnetism', 'James Clerk Maxwell', 'daily_agent_canon_backfill_2026_09_07_round79'),
  ('View with a Grain of Sand: Selected Poems', 'Wisława Szymborska', 'daily_agent_canon_backfill_2026_09_07_round79')
ON CONFLICT (lower(title), lower(author)) DO NOTHING;

INSERT INTO seed_book_list (entry) VALUES
  ('The Positive Philosophy of Auguste Comte by Auguste Comte'),
  ('Ideas by Edmund Husserl'),
  ('A Treatise on Electricity and Magnetism by James Clerk Maxwell'),
  ('View with a Grain of Sand by Wisława Szymborska')
ON CONFLICT (lower(TRIM(entry))) DO NOTHING;
