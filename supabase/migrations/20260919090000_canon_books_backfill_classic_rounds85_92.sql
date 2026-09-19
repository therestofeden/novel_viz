-- 2026-09-19 daily_novel_viz_feat: backfills a real search-coverage gap found
-- this session, not a new curation round. Every classic.ts curation round
-- through round 84 (2026-09-10) had a matching canon_books_curation_roundNN
-- migration landing the same day or the next, so newly curated classics
-- became searchable (via search-books' canon injection/CANON_BONUS) almost
-- immediately. That pairing silently stopped after round 84: rounds 85-92
-- (src/lib/classic.ts, 2026-09-11 through 2026-09-18, 20 titles) were added
-- to the client-side classic.ts file — which only drives ClassicBadge.tsx's
-- cosmetic "◆ Classic" stamp — but never backfilled into canon_books, the
-- actual DB table search-books' search_canon RPC reads from. Confirmed by
-- grepping every canon_books_curation_*.sql migration for all 20 titles and
-- all 20 authors: zero hits, for any of them, before this migration.
--
-- Net effect for eight straight curation rounds: these 20 books could earn a
-- "Classic" badge if a user's query happened to surface them through Open
-- Library/Google Books on its own, but never benefited from canon injection
-- (typo tolerance, the "Author - Title" splitter, the CANON_BONUS/
-- CANON_FUZZY_ONLY_BONUS ranking boost) the way every other canon-listed
-- classic does — directly working against this task's own brief ("as many
-- books as possible... Classics first") for the specific feature (the search
-- bar) it's scoped to. Several of these are exactly the kind of query this
-- gap would bite hardest on: single specialist-register titles a user is
-- likely to type slightly wrong or as "author - title" ("mckinder
-- geopolitics", "hart the consept of law", "wegener continental drift").
--
-- Also lands the matching seed_book_list rows (same "Title by Author"
-- free-text convention as every prior seed_book_list backfill, e.g. round 84)
-- so these 20 titles get pulled into the popular-books local instant index,
-- not just canon-injected search.
--
-- All 20 rows sourced directly from classic.ts's own round 85-92 entries
-- (Braudel/Ostrom/Schelling, McLuhan/Jacobs/Snow, Gombrich/Alexander/Berger,
-- Bazin/Taylor/Mackinder, Panofsky/Ruskin, Rameau/Laplace, Hart/Jenner,
-- Wegener/Petrie) — no new research performed, this is a sync, not a
-- curation round. Uses the same ON CONFLICT DO NOTHING pattern as every
-- other canon_books insert (unique index on (lower(title), lower(author))),
-- so this is safe to re-run and can't collide with round 92's own pending
-- classic.ts commit landing in the same session.

insert into canon_books (title, author, source) values
  ('The Mediterranean and the Mediterranean World in the Age of Philip II', 'Fernand Braudel', 'classic_backfill_2026_09_19_rounds85_92'),
  ('Governing the Commons', 'Elinor Ostrom', 'classic_backfill_2026_09_19_rounds85_92'),
  ('The Strategy of Conflict', 'Thomas C. Schelling', 'classic_backfill_2026_09_19_rounds85_92'),
  ('Understanding Media: The Extensions of Man', 'Marshall McLuhan', 'classic_backfill_2026_09_19_rounds85_92'),
  ('The Death and Life of Great American Cities', 'Jane Jacobs', 'classic_backfill_2026_09_19_rounds85_92'),
  ('On the Mode of Communication of Cholera', 'John Snow', 'classic_backfill_2026_09_19_rounds85_92'),
  ('The Story of Art', 'E.H. Gombrich', 'classic_backfill_2026_09_19_rounds85_92'),
  ('A Pattern Language: Towns, Buildings, Construction', 'Christopher Alexander', 'classic_backfill_2026_09_19_rounds85_92'),
  ('Ways of Seeing', 'John Berger', 'classic_backfill_2026_09_19_rounds85_92'),
  ('What Is Cinema?', 'André Bazin', 'classic_backfill_2026_09_19_rounds85_92'),
  ('The Principles of Scientific Management', 'Frederick Winslow Taylor', 'classic_backfill_2026_09_19_rounds85_92'),
  ('Democratic Ideals and Reality', 'Halford J. Mackinder', 'classic_backfill_2026_09_19_rounds85_92'),
  ('Studies in Iconology', 'Erwin Panofsky', 'classic_backfill_2026_09_19_rounds85_92'),
  ('Unto This Last', 'John Ruskin', 'classic_backfill_2026_09_19_rounds85_92'),
  ('Treatise on Harmony', 'Jean-Philippe Rameau', 'classic_backfill_2026_09_19_rounds85_92'),
  ('A Philosophical Essay on Probabilities', 'Pierre-Simon Laplace', 'classic_backfill_2026_09_19_rounds85_92'),
  ('The Concept of Law', 'H.L.A. Hart', 'classic_backfill_2026_09_19_rounds85_92'),
  ('An Inquiry into the Causes and Effects of the Variolae Vaccinae', 'Edward Jenner', 'classic_backfill_2026_09_19_rounds85_92'),
  ('The Origin of Continents and Oceans', 'Alfred Wegener', 'classic_backfill_2026_09_19_rounds85_92'),
  ('Methods and Aims in Archaeology', 'W.M. Flinders Petrie', 'classic_backfill_2026_09_19_rounds85_92')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('The Mediterranean and the Mediterranean World in the Age of Philip II by Fernand Braudel'),
  ('Governing the Commons by Elinor Ostrom'),
  ('The Strategy of Conflict by Thomas C. Schelling'),
  ('Understanding Media: The Extensions of Man by Marshall McLuhan'),
  ('The Death and Life of Great American Cities by Jane Jacobs'),
  ('On the Mode of Communication of Cholera by John Snow'),
  ('The Story of Art by E.H. Gombrich'),
  ('A Pattern Language: Towns, Buildings, Construction by Christopher Alexander'),
  ('Ways of Seeing by John Berger'),
  ('What Is Cinema? by André Bazin'),
  ('The Principles of Scientific Management by Frederick Winslow Taylor'),
  ('Democratic Ideals and Reality by Halford J. Mackinder'),
  ('Studies in Iconology by Erwin Panofsky'),
  ('Unto This Last by John Ruskin'),
  ('Treatise on Harmony by Jean-Philippe Rameau'),
  ('A Philosophical Essay on Probabilities by Pierre-Simon Laplace'),
  ('The Concept of Law by H.L.A. Hart'),
  ('An Inquiry into the Causes and Effects of the Variolae Vaccinae by Edward Jenner'),
  ('The Origin of Continents and Oceans by Alfred Wegener'),
  ('Methods and Aims in Archaeology by W.M. Flinders Petrie')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
