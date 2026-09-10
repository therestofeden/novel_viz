-- Round 84 (2026-09-10, scheduled `daily-must-read-and-classic` task):
-- closes four founder gaps in law, economics, and economic sociology —
-- Blackstone's Commentaries on the Laws of England, Coase's The Firm, the
-- Market, and the Law, Polanyi's The Great Transformation, and Arrow's
-- Social Choice and Individual Values. See src/lib/classic.ts's "Round 84"
-- comment block for the full reasoning behind each addition.

insert into canon_books (title, author, source) values
  ('Commentaries on the Laws of England', 'William Blackstone', 'classic_daily_curation_round84_2026_09_10'),
  ('The Firm, the Market, and the Law', 'Ronald H. Coase', 'classic_daily_curation_round84_2026_09_10'),
  ('The Great Transformation', 'Karl Polanyi', 'classic_daily_curation_round84_2026_09_10'),
  ('Social Choice and Individual Values', 'Kenneth J. Arrow', 'classic_daily_curation_round84_2026_09_10');

insert into seed_book_list (entry) values
  ('Commentaries on the Laws of England by William Blackstone'),
  ('The Firm, the Market, and the Law by Ronald H. Coase'),
  ('The Great Transformation by Karl Polanyi'),
  ('Social Choice and Individual Values by Kenneth J. Arrow');
