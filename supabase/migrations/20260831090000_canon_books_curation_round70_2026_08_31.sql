-- Canon curation round 70 (2026-08-31)
-- Closes the other half of the Bohr/Heisenberg asymmetry flagged as an open
-- question at the end of round 69: Heisenberg's side of quantum mechanics'
-- founding generation was added then, but Bohr -- the theory's other
-- central founding voice, and Heisenberg's own Copenhagen collaborator --
-- had zero representation in either list. See classic.ts round-70 header
-- comment for full rationale and sourcing.

insert into canon_books (title, author, source) values
  ('Atomic Physics and Human Knowledge', 'Niels Bohr', 'daily_agent_canon_backfill_2026_08_31'),
  ('Essays 1958-1962 on Atomic Physics and Human Knowledge', 'Niels Bohr', 'daily_agent_canon_backfill_2026_08_31')
on conflict do nothing;

insert into seed_book_list (entry) values
  ('Atomic Physics and Human Knowledge by Niels Bohr')
on conflict do nothing;
