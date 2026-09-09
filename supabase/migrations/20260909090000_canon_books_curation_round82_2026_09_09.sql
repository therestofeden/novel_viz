-- Round 81 canon curation (2026-09-09): closes 4 founder/founding-text gaps found via
-- an author-level scan of classic.ts for founder/successor pairs represented only by
-- their successor — same pattern as rounds 66, 78, 79, 80.
--
-- File name says "round82" (a rename target that couldn't be applied — this sandbox's
-- mount doesn't allow deleting/renaming files once written, see the standing FUSE
-- no-delete note in project memory) but the content and round number are correct as
-- "Round 81": this block lands in classic.ts BEFORE the "Round 82" block (Frost/Wiener/
-- Poincaré/Sacks) added by a concurrent `daily_novel_viz_feat` session, which itself
-- correctly refers back to this round as "last round." That other session's own
-- canon_books migration file is separately named with "round81" in its filename too
-- (see 20260909082450_canon_books_curation_round81_2026_09_09.sql), purely because it
-- was written before that session saw this block land — a filename coincidence, not a
-- data conflict. To keep the two disjoint concurrent batches distinguishable in
-- canon_books history despite both filenames mentioning "round81", this migration's
-- source uses the "_v2" suffix.
insert into canon_books (title, author, source) values
  ('Science and Human Behavior', 'B.F. Skinner', 'classic_daily_curation_round81_2026_09_09_v2'),
  ('Disquisitiones Arithmeticae', 'Carl Friedrich Gauss', 'classic_daily_curation_round81_2026_09_09_v2'),
  ('Elements of Pure Economics', 'Léon Walras', 'classic_daily_curation_round81_2026_09_09_v2'),
  ('The Philosophy of Money', 'Georg Simmel', 'classic_daily_curation_round81_2026_09_09_v2');

insert into seed_book_list (entry) values
  ('Science and Human Behavior by B.F. Skinner'),
  ('Disquisitiones Arithmeticae by Carl Friedrich Gauss'),
  ('Elements of Pure Economics by Léon Walras'),
  ('The Philosophy of Money by Georg Simmel');
