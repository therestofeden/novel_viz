-- Canon curation round 69 (2026-08-30)
-- Continues the founder-vs-successor asymmetry sweep (rounds 65-66-68), this
-- time in physics: Richard Feynman's QED (already on the list) explains
-- quantum electrodynamics to lay readers, but the actual founding
-- generation of quantum mechanics (Heisenberg's 1925 matrix mechanics,
-- 1927 uncertainty principle) had zero representation. See classic.ts
-- round-69 header comment for full rationale and sourcing.

insert into canon_books (title, author, source) values
  ('Physics and Philosophy', 'Werner Heisenberg', 'daily_agent_canon_backfill_2026_08_30'),
  ('Physics and Philosophy: The Revolution in Modern Science', 'Werner Heisenberg', 'daily_agent_canon_backfill_2026_08_30')
on conflict do nothing;

insert into seed_book_list (entry) values
  ('Physics and Philosophy by Werner Heisenberg')
on conflict do nothing;
