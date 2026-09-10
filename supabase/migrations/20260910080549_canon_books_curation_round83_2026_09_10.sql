-- Round 83 canon curation (2026-09-10): continues the founder/founding-text gap scan
-- (rounds 66, 78, 79, 80, 81, 82). This round targeted the physical-sciences and
-- computing clusters specifically: Newton/Einstein/Maxwell/Gödel/Turing/Wiener/Shannon/
-- von Neumann were all present, but thermodynamics, geology, and the first published
-- computer program had no founder here at all. Sadi Carnot's Reflections on the Motive
-- Power of Fire (1824) founded thermodynamics outright -- Carnot efficiency, the
-- reversible cycle, the seed of the second law -- a full physics tradition missing
-- alongside Newton/Maxwell/Einstein. Charles Lyell's Principles of Geology (1830-33)
-- closes a founder-behind-successor gap the same shape as Gauss/Wiener/Poincare last
-- two rounds: Darwin's On the Origin of Species is already here, and Darwin carried
-- Lyell's first volume on the Beagle and called himself Lyell's disciple -- uniformitarian
-- geology is the ground Darwin's own argument stands on. Ada Lovelace's 1843 Notes on
-- the Analytical Engine (appended to her translation of Menabrea's memoir on Babbage's
-- machine) contains the first published algorithm intended for a computer, a century
-- before Turing (already here) formalized computability -- also the first woman added
-- to this list's recent STEM-founder run (Skinner/Gauss/Walras/Simmel/Frost/Wiener/
-- Poincare/Sacks were all men). R.A. Fisher's The Design of Experiments (1935) founded
-- modern experimental statistics -- randomization, the null hypothesis, the "lady
-- tasting tea" -- a discipline with zero representation despite underpinning every
-- empirical field this list already touches. All four WebSearch-verified this session;
-- none were close calls or flagged for Must Read.
insert into canon_books (title, author, source) values
  ('Reflections on the Motive Power of Fire', 'Sadi Carnot', 'classic_daily_curation_round83_2026_09_10'),
  ('Principles of Geology', 'Charles Lyell', 'classic_daily_curation_round83_2026_09_10'),
  ('Notes on the Analytical Engine', 'Ada Lovelace', 'classic_daily_curation_round83_2026_09_10'),
  ('The Design of Experiments', 'R.A. Fisher', 'classic_daily_curation_round83_2026_09_10');

insert into seed_book_list (entry) values
  ('Reflections on the Motive Power of Fire by Sadi Carnot'),
  ('Principles of Geology by Charles Lyell'),
  ('Notes on the Analytical Engine by Ada Lovelace'),
  ('The Design of Experiments by R.A. Fisher');
