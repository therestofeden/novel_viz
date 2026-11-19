-- Classics gap fill (2026-11-19, daily novel_viz feat). Checked 211 canonical
-- novels/non-fiction/poetry/drama titles against canon_books; these were the
-- ones missing under any title. Common English aliases are added for works
-- that canon only held under another name (Jin Ping Mei, The Government
-- Inspector, Il fu Mattia Pascal) so exact-title searches hit the fast
-- canon-grace path. Title-level dedupe. Idempotent.

insert into canon_books (title, author, source)
select v.title, v.author, 'gap_fill_2026_11_19'
from (values
  ('In Search of Lost Time', 'Marcel Proust'),
  ('An American Tragedy', 'Theodore Dreiser'),
  ('De Profundis', 'Oscar Wilde'),
  ('Four Quartets', 'T.S. Eliot'),
  ('Go Tell It on the Mountain', 'James Baldwin'),
  ('Howl', 'Allen Ginsberg'),
  ('Joseph Andrews', 'Henry Fielding'),
  ('Julie, or the New Heloise', 'Jean-Jacques Rousseau'),
  ('Letters to a Young Poet', 'Rainer Maria Rilke'),
  ('Native Son', 'Richard Wright'),
  ('Second Treatise of Government', 'John Locke'),
  ('The Life of Samuel Johnson', 'James Boswell'),
  ('The Prelude', 'William Wordsworth'),
  ('The Scholars', 'Wu Jingzi'),
  ('The Golden Lotus', 'Lanling Xiaoxiao Sheng'),
  ('The Inspector General', 'Nikolai Gogol'),
  ('The Late Mattia Pascal', 'Luigi Pirandello')
) as v(title, author)
where not exists (select 1 from canon_books c where lower(c.title) = lower(v.title))
on conflict do nothing;

insert into seed_book_list (entry)
select c.title || ' by ' || c.author
from canon_books c
where c.source = 'gap_fill_2026_11_19'
  and c.title not in ('The Golden Lotus', 'The Inspector General', 'The Late Mattia Pascal')
  and not exists (select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(c.title || ' by ' || c.author)));
