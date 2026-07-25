-- Reconcile canon_books against today's classic.ts curation pass (40f87d8, 231->235).
-- House Made of Dawn already present (pre-existing canon coverage). Backfilling the
-- other 3: Noli Me Tangere (+ variant), Gimpel the Fool (+ variant), Summa Theologica
-- (+ variant), each with the aka spellings from classic.ts so search_canon's fuzzy
-- match surfaces them under either form.
insert into canon_books (title, author, source) values
  ('Noli Me Tángere', 'José Rizal', 'daily_agent_canon_backfill_2026_07_25'),
  ('Noli Me Tangere', 'José Rizal', 'daily_agent_canon_backfill_2026_07_25'),
  ('Gimpel the Fool and Other Stories', 'Isaac Bashevis Singer', 'daily_agent_canon_backfill_2026_07_25'),
  ('Gimpel the Fool', 'Isaac Bashevis Singer', 'daily_agent_canon_backfill_2026_07_25'),
  ('Summa Theologica', 'Thomas Aquinas', 'daily_agent_canon_backfill_2026_07_25'),
  ('Summa Theologiae', 'Thomas Aquinas', 'daily_agent_canon_backfill_2026_07_25')
on conflict do nothing;
