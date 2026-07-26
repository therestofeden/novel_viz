-- Round 21 (2026-07-26): reconcile canon_books against classic.ts's 2026-07-26
-- daily curation pass (235->239): Diary of a Madman and Other Stories/Lu Xun,
-- The Narrow Road to the Deep North/Matsuo Bashō, On the Principles of
-- Political Economy and Taxation/David Ricardo, Persepolis/Marjane Satrapi.
-- Primaries + genuinely-distinct akas only (skip article/subtitle-stripped
-- variants of the primary, per established round 13-19 discipline).

insert into public.canon_books (title, author, source)
select v.title, v.author, 'daily_agent_canon_backfill_2026_07_26'
from (values
  -- Lu Xun
  ('Diary of a Madman and Other Stories', 'Lu Xun'),
  ('A Madman''s Diary', 'Lu Xun'),
  ('Diary of a Madman', 'Lu Xun'),
  -- Bashō
  ('The Narrow Road to the Deep North', 'Matsuo Bashō'),
  ('Oku no Hosomichi', 'Matsuo Bashō'),
  ('Narrow Road to the Interior', 'Matsuo Bashō'),
  ('The Narrow Road to Oku', 'Matsuo Bashō'),
  -- Ricardo
  ('On the Principles of Political Economy and Taxation', 'David Ricardo'),
  -- Satrapi
  ('Persepolis', 'Marjane Satrapi'),
  ('Persepolis: The Story of a Childhood', 'Marjane Satrapi')
) as v(title, author)
where not exists (
  select 1 from public.canon_books c
  where lower(c.title) = lower(v.title) and lower(c.author) = lower(v.author)
);
