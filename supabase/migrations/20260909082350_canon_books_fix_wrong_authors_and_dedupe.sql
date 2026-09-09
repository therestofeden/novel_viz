-- Fix wrong-author canon_books rows and dedupe redundant variants (round 81 data-quality pass).
-- These rows were polluting search_canon results (CANON_BONUS ranking) with incorrect
-- authorship (e.g. film/stage adapters credited instead of the original author) or
-- redundant near-duplicates of a title already correctly present.

-- 1) Delete rows where the SAME title already has a correct entry and this row's
--    author is wrong (adapter/director) or a messy duplicate variant.
delete from canon_books where id = 259;  -- "1984" / "Michael Dean" (wrong; correct row: George Orwell)
delete from canon_books where id = 16;   -- "Anna Karenina" / "Leo Tolstoy (Translator: Louise Maude)" (messy dupe of clean Leo Tolstoy row)
delete from canon_books where id = 83;   -- "Love in the Time of Cholera" / "Mike Newell" (film director, not author; correct row: Gabriel García Márquez)
delete from canon_books where id = 815;  -- "The Canon of Medicine" / "Ibn Sina" (same person as "Avicenna" row 814; true duplicate)
delete from canon_books where id = 90;   -- "The Master and Margarita" / "Edward Kemp" (stage adapter, not author; correct row: Mikhail Bulgakov)
delete from canon_books where id = 237;  -- "The Stranger" / "Mark Twain" (wrong; Twain's actual work is "The Mysterious Stranger", already present as row 219; correct "The Stranger" row: Albert Camus)
delete from canon_books where id = 200;  -- "The Structure of Scientific Revolutions" / "Thomas S. Kuhn" (name-variant dupe of "Thomas Kuhn" row 760)
delete from canon_books where id = 11;   -- "Alchemist 2" / author field literally "The Alchemist" (corrupted scrape, not a real book)

-- 2) Correct wrong author attribution where NO duplicate exists (single row, bad data;
--    fix in place so the title keeps its canon boost with the right author).
update canon_books set author = 'Umberto Eco' where id = 79;          -- "Foucault's Pendulum"
update canon_books set author = 'Naguib Mahfouz' where id = 168;       -- "Palace of Desire" (Cairo Trilogy, book 2)
update canon_books set author = 'Isabel Allende' where id = 85;        -- "The House of the Spirits"
update canon_books set author = 'Graham Greene' where id = 256;        -- "The End of the Affair"
update canon_books set author = 'Primo Levi' where id = 39;            -- "The Truce"
