-- Canon curation round 68 (2026-08-29)
-- Continues the founder-vs-successor asymmetry sweep (rounds 65-66): Carl
-- Menger founded the Austrian School / marginal revolution that Hayek's
-- Road to Serfdom (already on the list) descends from, and Gottlob Frege
-- is the missing third of the Frege/Russell/Wittgenstein analytic-
-- philosophy founding trio (Russell and Wittgenstein already present). See
-- classic.ts round-68 header comment for full rationale and sourcing.

insert into canon_books (title, author, source) values
  ('Principles of Economics', 'Carl Menger', 'daily_agent_canon_backfill_2026_08_29'),
  ('The Foundations of Arithmetic', 'Gottlob Frege', 'daily_agent_canon_backfill_2026_08_29'),
  ('Die Grundlagen der Arithmetik', 'Gottlob Frege', 'daily_agent_canon_backfill_2026_08_29')
on conflict do nothing;

insert into seed_book_list (entry) values
  ('Principles of Economics by Carl Menger'),
  ('The Foundations of Arithmetic by Gottlob Frege')
on conflict do nothing;
