-- Immediate follow-up to canon_books_curation_round84_2026_09_10: the
-- round84 seed_book_list insert above used a "Title|Author" delimiter,
-- copied from canon_books's own column layout rather than the actual
-- seed_book_list.entry convention, which is a single free-text
-- "Title by Author" string (confirmed by reading the 10 most recent
-- existing rows before writing this fix). Corrects the 4 rows in place.

update seed_book_list set entry = 'Commentaries on the Laws of England by William Blackstone' where entry = 'Commentaries on the Laws of England|William Blackstone';
update seed_book_list set entry = 'The Firm, the Market, and the Law by Ronald H. Coase' where entry = 'The Firm, the Market, and the Law|Ronald H. Coase';
update seed_book_list set entry = 'The Great Transformation by Karl Polanyi' where entry = 'The Great Transformation|Karl Polanyi';
update seed_book_list set entry = 'Social Choice and Individual Values by Kenneth J. Arrow' where entry = 'Social Choice and Individual Values|Kenneth J. Arrow';
