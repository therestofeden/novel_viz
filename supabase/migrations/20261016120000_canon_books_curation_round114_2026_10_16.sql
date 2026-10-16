-- Round 114 (2026-10-16, daily novel_viz book-coverage task).
-- Pairs with classic.ts round 114 per canon-coverage.test.ts. Idempotent.

insert into canon_books (title, author, source) values
  ('Titus Groan', 'Mervyn Peake', 'classic_daily_curation_round114_2026_10_16'),
  ('Pendennis', 'William Makepeace Thackeray', 'classic_daily_curation_round114_2026_10_16'),
  ('Argonautica', 'Apollonius of Rhodes', 'classic_daily_curation_round114_2026_10_16'),
  ('The Frogs', 'Aristophanes', 'classic_daily_curation_round114_2026_10_16'),
  ('Georgics', 'Virgil', 'classic_daily_curation_round114_2026_10_16'),
  ('The Posthumous Memoirs of Brás Cubas', 'Machado de Assis', 'classic_daily_curation_round114_2026_10_16'),
  ('I Am a Cat', 'Natsume Sōseki', 'classic_daily_curation_round114_2026_10_16'),
  ('Botchan', 'Natsume Sōseki', 'classic_daily_curation_round114_2026_10_16'),
  ('No Longer Human', 'Osamu Dazai', 'classic_daily_curation_round114_2026_10_16'),
  ('The Sound of the Mountain', 'Yasunari Kawabata', 'classic_daily_curation_round114_2026_10_16'),
  ('Quicksand', 'Nella Larsen', 'classic_daily_curation_round114_2026_10_16'),
  ('Passing', 'Nella Larsen', 'classic_daily_curation_round114_2026_10_16'),
  ('Process and Reality', 'Alfred North Whitehead', 'classic_daily_curation_round114_2026_10_16'),
  ('The Principles of Psychology', 'William James', 'classic_daily_curation_round114_2026_10_16'),
  ('The Gallic War', 'Julius Caesar', 'classic_daily_curation_round114_2026_10_16'),
  ('Rhetoric', 'Aristotle', 'classic_daily_curation_round114_2026_10_16'),
  ('Enneads', 'Plotinus', 'classic_daily_curation_round114_2026_10_16'),
  ('The Education of Henry Adams', 'Henry Adams', 'classic_daily_curation_round114_2026_10_16'),
  ('The Golden Bough', 'James George Frazer', 'classic_daily_curation_round114_2026_10_16'),
  ('Critique of Practical Reason', 'Immanuel Kant', 'classic_daily_curation_round114_2026_10_16'),
  ('Elements of the Philosophy of Right', 'G. W. F. Hegel', 'classic_daily_curation_round114_2026_10_16'),
  ('Ecclesiastical History of the English People', 'Bede', 'classic_daily_curation_round114_2026_10_16')
on conflict ((lower(title)), (lower(author))) do nothing;

insert into seed_book_list (entry)
select v.entry
from (values
  ('Titus Groan by Mervyn Peake'),
  ('Pendennis by William Makepeace Thackeray'),
  ('Argonautica by Apollonius of Rhodes'),
  ('The Frogs by Aristophanes'),
  ('Georgics by Virgil'),
  ('The Posthumous Memoirs of Brás Cubas by Machado de Assis'),
  ('I Am a Cat by Natsume Sōseki'),
  ('Botchan by Natsume Sōseki'),
  ('No Longer Human by Osamu Dazai'),
  ('The Sound of the Mountain by Yasunari Kawabata'),
  ('Quicksand by Nella Larsen'),
  ('Passing by Nella Larsen'),
  ('Process and Reality by Alfred North Whitehead'),
  ('The Principles of Psychology by William James'),
  ('The Gallic War by Julius Caesar'),
  ('Rhetoric by Aristotle'),
  ('Enneads by Plotinus'),
  ('The Education of Henry Adams by Henry Adams'),
  ('The Golden Bough by James George Frazer'),
  ('Critique of Practical Reason by Immanuel Kant'),
  ('Elements of the Philosophy of Right by G. W. F. Hegel'),
  ('Ecclesiastical History of the English People by Bede')
) as v(entry)
where not exists (
  select 1 from seed_book_list s where lower(trim(s.entry)) = lower(trim(v.entry))
);
