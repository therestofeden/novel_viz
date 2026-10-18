-- Round 116 (2026-10-18, daily novel_viz book-coverage task).
-- Pairs with classic.ts round 116 per canon-coverage.test.ts. Idempotent.

insert into canon_books (title, author, source) values
  ('Mansfield Park', 'Jane Austen', 'classic_daily_curation_round116_2026_10_18'),
  ('Dubliners', 'James Joyce', 'classic_daily_curation_round116_2026_10_18'),
  ('The Waves', 'Virginia Woolf', 'classic_daily_curation_round116_2026_10_18'),
  ('The Vicar of Wakefield', 'Oliver Goldsmith', 'classic_daily_curation_round116_2026_10_18'),
  ('The Monk', 'Matthew Lewis', 'classic_daily_curation_round116_2026_10_18'),
  ('Michael Kohlhaas', 'Heinrich von Kleist', 'classic_daily_curation_round116_2026_10_18'),
  ('Elective Affinities', 'Johann Wolfgang von Goethe', 'classic_daily_curation_round116_2026_10_18'),
  ('The Robbers', 'Friedrich Schiller', 'classic_daily_curation_round116_2026_10_18'),
  ('The Private Memoirs and Confessions of a Justified Sinner', 'James Hogg', 'classic_daily_curation_round116_2026_10_18'),
  ('The Bostonians', 'Henry James', 'classic_daily_curation_round116_2026_10_18'),
  ('Sartor Resartus', 'Thomas Carlyle', 'classic_daily_curation_round116_2026_10_18'),
  ('Culture and Anarchy', 'Matthew Arnold', 'classic_daily_curation_round116_2026_10_18'),
  ('Dialogues Concerning Natural Religion', 'David Hume', 'classic_daily_curation_round116_2026_10_18'),
  ('The Subjection of Women', 'John Stuart Mill', 'classic_daily_curation_round116_2026_10_18'),
  ('Opticks', 'Isaac Newton', 'classic_daily_curation_round116_2026_10_18'),
  ('Meditations on First Philosophy', 'René Descartes', 'classic_daily_curation_round116_2026_10_18'),
  ('Theologico-Political Treatise', 'Baruch Spinoza', 'classic_daily_curation_round116_2026_10_18'),
  ('A Letter Concerning Toleration', 'John Locke', 'classic_daily_curation_round116_2026_10_18'),
  ('Institutes of the Christian Religion', 'John Calvin', 'classic_daily_curation_round116_2026_10_18'),
  ('Totem and Taboo', 'Sigmund Freud', 'classic_daily_curation_round116_2026_10_18')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('Mansfield Park by Jane Austen'),
  ('Dubliners by James Joyce'),
  ('The Waves by Virginia Woolf'),
  ('The Vicar of Wakefield by Oliver Goldsmith'),
  ('The Monk by Matthew Lewis'),
  ('Michael Kohlhaas by Heinrich von Kleist'),
  ('Elective Affinities by Johann Wolfgang von Goethe'),
  ('The Robbers by Friedrich Schiller'),
  ('The Private Memoirs and Confessions of a Justified Sinner by James Hogg'),
  ('The Bostonians by Henry James'),
  ('Sartor Resartus by Thomas Carlyle'),
  ('Culture and Anarchy by Matthew Arnold'),
  ('Dialogues Concerning Natural Religion by David Hume'),
  ('The Subjection of Women by John Stuart Mill'),
  ('Opticks by Isaac Newton'),
  ('Meditations on First Philosophy by René Descartes'),
  ('Theologico-Political Treatise by Baruch Spinoza'),
  ('A Letter Concerning Toleration by John Locke'),
  ('Institutes of the Christian Religion by John Calvin'),
  ('Totem and Taboo by Sigmund Freud')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
