-- Round 119 (2026-10-21, daily novel_viz book-coverage task).
-- Pairs with classic.ts round 119 per canon-coverage.test.ts. Idempotent.

insert into canon_books (title, author, source) values
  ('Maurice', 'E. M. Forster', 'classic_daily_curation_round119_2026_10_21'),
  ('New Grub Street', 'George Gissing', 'classic_daily_curation_round119_2026_10_21'),
  ('The Expedition of Humphry Clinker', 'Tobias Smollett', 'classic_daily_curation_round119_2026_10_21'),
  ('Vathek', 'William Beckford', 'classic_daily_curation_round119_2026_10_21'),
  ('Melmoth the Wanderer', 'Charles Maturin', 'classic_daily_curation_round119_2026_10_21'),
  ('Caleb Williams', 'William Godwin', 'classic_daily_curation_round119_2026_10_21'),
  ('The Deerslayer', 'James Fenimore Cooper', 'classic_daily_curation_round119_2026_10_21'),
  ('The Marble Faun', 'Nathaniel Hawthorne', 'classic_daily_curation_round119_2026_10_21'),
  ('White Fang', 'Jack London', 'classic_daily_curation_round119_2026_10_21'),
  ('King Solomon''s Mines', 'H. Rider Haggard', 'classic_daily_curation_round119_2026_10_21'),
  ('The Man Who Was Thursday', 'G. K. Chesterton', 'classic_daily_curation_round119_2026_10_21'),
  ('The Moon and Sixpence', 'W. Somerset Maugham', 'classic_daily_curation_round119_2026_10_21'),
  ('Zadig', 'Voltaire', 'classic_daily_curation_round119_2026_10_21'),
  ('The Egoist', 'George Meredith', 'classic_daily_curation_round119_2026_10_21'),
  ('Kenilworth', 'Walter Scott', 'classic_daily_curation_round119_2026_10_21'),
  ('The Secret Garden', 'Frances Hodgson Burnett', 'classic_daily_curation_round119_2026_10_21'),
  ('Human, All Too Human', 'Friedrich Nietzsche', 'classic_daily_curation_round119_2026_10_21'),
  ('Daybreak', 'Friedrich Nietzsche', 'classic_daily_curation_round119_2026_10_21'),
  ('Philosophical Fragments', 'Soren Kierkegaard', 'classic_daily_curation_round119_2026_10_21'),
  ('Experience and Nature', 'John Dewey', 'classic_daily_curation_round119_2026_10_21')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('Maurice by E. M. Forster'),
  ('New Grub Street by George Gissing'),
  ('The Expedition of Humphry Clinker by Tobias Smollett'),
  ('Vathek by William Beckford'),
  ('Melmoth the Wanderer by Charles Maturin'),
  ('Caleb Williams by William Godwin'),
  ('The Deerslayer by James Fenimore Cooper'),
  ('The Marble Faun by Nathaniel Hawthorne'),
  ('White Fang by Jack London'),
  ('King Solomon''s Mines by H. Rider Haggard'),
  ('The Man Who Was Thursday by G. K. Chesterton'),
  ('The Moon and Sixpence by W. Somerset Maugham'),
  ('Zadig by Voltaire'),
  ('The Egoist by George Meredith'),
  ('Kenilworth by Walter Scott'),
  ('The Secret Garden by Frances Hodgson Burnett'),
  ('Human, All Too Human by Friedrich Nietzsche'),
  ('Daybreak by Friedrich Nietzsche'),
  ('Philosophical Fragments by Soren Kierkegaard'),
  ('Experience and Nature by John Dewey')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
