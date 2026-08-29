-- Canon curation round 67 (2026-08-29)
-- Closes a 4-year Nobel Prize in Literature maintenance gap: 2022-2025
-- laureates (Ernaux, Fosse, Han Kang, Krasznahorkai) were entirely absent
-- despite this list carrying a deep bench of older laureates. See
-- classic.ts round-67 header comment for full rationale and sourcing.

insert into canon_books (title, author, source) values
  ('The Years', 'Annie Ernaux', 'daily_agent_canon_backfill_2026_08_29'),
  ('Septology', 'Jon Fosse', 'daily_agent_canon_backfill_2026_08_29'),
  ('The Vegetarian', 'Han Kang', 'daily_agent_canon_backfill_2026_08_29'),
  ('Satantango', 'László Krasznahorkai', 'daily_agent_canon_backfill_2026_08_29'),
  ('Sátántangó', 'László Krasznahorkai', 'daily_agent_canon_backfill_2026_08_29')
on conflict do nothing;

insert into seed_book_list (entry) values
  ('The Years by Annie Ernaux'),
  ('Septology by Jon Fosse'),
  ('The Vegetarian by Han Kang'),
  ('Satantango by László Krasznahorkai')
on conflict do nothing;
