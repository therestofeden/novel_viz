-- Round 38 (2026-08-05) canon curation backfill, second session's remainder.
-- Long Day's Journey Into Night / The Hour of the Star / In Praise of Folly
-- were already inserted earlier today (source 'classic_editorial',
-- 2026-08-05 09:14:41 UTC) by a concurrent scheduled-task run. Common
-- Sense / Beyond Good and Evil / The Idiot pre-existed in canon_books
-- from before today (2026-07-17/2026-07-28). This migration adds the
-- two remaining titles from this session's own Classic additions that
-- had not yet been backfilled: The Upanishads and Parallel Lives.

insert into canon_books (title, author, source)
select v.title, v.author, 'daily_agent_canon_backfill_2026_08_05_round38'
from (values
  ('The Upanishads', 'Anonymous'),
  ('Parallel Lives', 'Plutarch')
) as v(title, author)
where not exists (
  select 1 from canon_books cb
  where lower(cb.title) = lower(v.title) and lower(cb.author) = lower(v.author)
);
