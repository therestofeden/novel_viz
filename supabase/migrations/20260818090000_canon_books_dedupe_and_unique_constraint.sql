-- Remove 13 accidental duplicate rows (same work, different article-prefix
-- title string, e.g. "Zhuangzi" vs "The Zhuangzi") that accumulated across
-- ~50 daily canon-curation rounds. classic.ts/must-read.ts already treat
-- each of these as ONE editorial entry via their `aka` arrays; canon_books
-- had no uniqueness constraint at all, so naive exact-string dedup checks
-- during insert missed the variant. Keeping the row whose title matches
-- the canonical `title` field used in classic.ts/must-read.ts, deleting
-- the aka-only duplicate.
delete from canon_books where id in (
  879, -- "Dhammapada" dup of 877 "The Dhammapada"
  699, -- "Essay on the Principle of Population" dup of 704 "An Essay on the Principle of Population"
  861, -- "The Freedom of a Christian" dup of 863 "On the Freedom of a Christian"
  825, -- "Kalevala" dup of 824 "The Kalevala"
  870, -- "Mabinogion" dup of 876 "The Mabinogion"
  707, -- "Masnavi" dup of 703 "The Masnavi"
  896, -- "Natyashastra" dup of 895 "The Natya Shastra"
  762, -- "The Origin of Species" dup of 170 "On the Origin of Species"
  810, -- "Rubaiyat of Omar Khayyam" dup of 809 "The Rubaiyat of Omar Khayyam"
  375, -- "The Symposium" dup of 605 "Symposium"
  889, -- "Tanakh" dup of 888 "The Hebrew Bible"
  890, -- "The Tanakh" dup of 888 "The Hebrew Bible"
  694  -- "Zhuangzi" dup of 695 "The Zhuangzi"
);

-- Prevent recurrence: enforce uniqueness on a normalized (title, author)
-- key that strips common leading articles ("The"/"On the"/"A"/"An") and
-- non-alphanumeric characters/case before comparing, so future inserts of
-- an article-prefix variant of an already-present work fail loudly instead
-- of silently duplicating. canon_books previously had zero uniqueness
-- constraint beyond the surrogate id primary key.
create unique index canon_books_normalized_title_author_key
  on canon_books (
    lower(regexp_replace(regexp_replace(title, '^(On the|The|A|An)\s+', '', 'i'), '[^a-z0-9]+', '', 'gi')),
    lower(regexp_replace(author, '[^a-z0-9]+', '', 'gi'))
  );
