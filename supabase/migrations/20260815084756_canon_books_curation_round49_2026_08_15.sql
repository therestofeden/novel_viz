
INSERT INTO canon_books (title, author, source)
SELECT * FROM (VALUES
  ('The Hebrew Bible', 'Anonymous', 'canon_books_curation_round49_2026_08_15'),
  ('Tanakh', 'Anonymous', 'canon_books_curation_round49_2026_08_15'),
  ('The Tanakh', 'Anonymous', 'canon_books_curation_round49_2026_08_15'),
  ('De Architectura', 'Vitruvius', 'canon_books_curation_round49_2026_08_15'),
  ('On Architecture', 'Vitruvius', 'canon_books_curation_round49_2026_08_15'),
  ('The Compendious Book on Calculation by Completion and Balancing', 'Muhammad ibn Musa al-Khwarizmi', 'canon_books_curation_round49_2026_08_15'),
  ('Al-Jabr', 'Muhammad ibn Musa al-Khwarizmi', 'canon_books_curation_round49_2026_08_15'),
  ('The Natya Shastra', 'Bharata Muni', 'canon_books_curation_round49_2026_08_15'),
  ('Natyashastra', 'Bharata Muni', 'canon_books_curation_round49_2026_08_15'),
  ('The Book of Dede Korkut', 'Anonymous', 'canon_books_curation_round49_2026_08_15'),
  ('Dede Korkut', 'Anonymous', 'canon_books_curation_round49_2026_08_15')
) AS v(title, author, source)
WHERE NOT EXISTS (
  SELECT 1 FROM canon_books cb WHERE lower(cb.title) = lower(v.title)
);
