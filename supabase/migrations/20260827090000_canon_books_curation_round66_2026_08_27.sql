-- Canon curation round 66 (2026-08-27)
-- Closes two "founder vs. successor" gaps found via a fresh targeted sweep
-- after round 65's own stale-candidate-flag pool turned out fully resolved:
-- (1) Xunzi -- the third of classical Confucianism's three founding figures
--     (with Confucius and Mencius, both already present), arguing human
--     nature is bad against Mencius's "human nature is good."
-- (2) Jeremy Bentham's An Introduction to the Principles of Morals and
--     Legislation (1780 printed / 1789 published) -- utilitarianism's
--     founding text; John Stuart Mill (successor) was already present.
-- See classic.ts round-66 header comment for full rationale and sourcing.

insert into canon_books (title, author, source) values
  ('Xunzi', 'Xunzi', 'daily_agent_canon_backfill_2026_08_27'),
  ('Xun Zi', 'Xunzi', 'daily_agent_canon_backfill_2026_08_27'),
  ('An Introduction to the Principles of Morals and Legislation', 'Jeremy Bentham', 'daily_agent_canon_backfill_2026_08_27'),
  ('Principles of Morals and Legislation', 'Jeremy Bentham', 'daily_agent_canon_backfill_2026_08_27')
on conflict do nothing;

insert into seed_book_list (entry) values
  ('Xunzi by Xunzi'),
  ('An Introduction to the Principles of Morals and Legislation by Jeremy Bentham')
on conflict do nothing;
