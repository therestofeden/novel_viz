-- Round 112 (2026-10-14, daily novel_viz book-coverage task).
-- Pairs with classic.ts round 112 per canon-coverage.test.ts. Idempotent.

insert into canon_books (title, author, source) values
  ('Women in Love', 'D. H. Lawrence', 'classic_daily_curation_round112_2026_10_14'),
  ('The Rainbow', 'D. H. Lawrence', 'classic_daily_curation_round112_2026_10_14'),
  ('Waverley', 'Walter Scott', 'classic_daily_curation_round112_2026_10_14'),
  ('Clarissa', 'Samuel Richardson', 'classic_daily_curation_round112_2026_10_14'),
  ('Evelina', 'Frances Burney', 'classic_daily_curation_round112_2026_10_14'),
  ('Rasselas', 'Samuel Johnson', 'classic_daily_curation_round112_2026_10_14'),
  ('The Warden', 'Anthony Trollope', 'classic_daily_curation_round112_2026_10_14'),
  ('The Way We Live Now', 'Anthony Trollope', 'classic_daily_curation_round112_2026_10_14'),
  ('Under Western Eyes', 'Joseph Conrad', 'classic_daily_curation_round112_2026_10_14'),
  ('The House of the Seven Gables', 'Nathaniel Hawthorne', 'classic_daily_curation_round112_2026_10_14'),
  ('McTeague', 'Frank Norris', 'classic_daily_curation_round112_2026_10_14'),
  ('The Wings of the Dove', 'Henry James', 'classic_daily_curation_round112_2026_10_14'),
  ('The Ambassadors', 'Henry James', 'classic_daily_curation_round112_2026_10_14'),
  ('O Pioneers!', 'Willa Cather', 'classic_daily_curation_round112_2026_10_14'),
  ('Brighton Rock', 'Graham Greene', 'classic_daily_curation_round112_2026_10_14'),
  ('The Bacchae', 'Euripides', 'classic_daily_curation_round112_2026_10_14'),
  ('A Treatise of Human Nature', 'David Hume', 'classic_daily_curation_round112_2026_10_14'),
  ('Twilight of the Idols', 'Friedrich Nietzsche', 'classic_daily_curation_round112_2026_10_14')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('Women in Love by D. H. Lawrence'),
  ('The Rainbow by D. H. Lawrence'),
  ('Waverley by Walter Scott'),
  ('Clarissa by Samuel Richardson'),
  ('Evelina by Frances Burney'),
  ('Rasselas by Samuel Johnson'),
  ('The Warden by Anthony Trollope'),
  ('The Way We Live Now by Anthony Trollope'),
  ('Under Western Eyes by Joseph Conrad'),
  ('The House of the Seven Gables by Nathaniel Hawthorne'),
  ('McTeague by Frank Norris'),
  ('The Wings of the Dove by Henry James'),
  ('The Ambassadors by Henry James'),
  ('O Pioneers! by Willa Cather'),
  ('Brighton Rock by Graham Greene'),
  ('The Bacchae by Euripides'),
  ('A Treatise of Human Nature by David Hume'),
  ('Twilight of the Idols by Friedrich Nietzsche')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
