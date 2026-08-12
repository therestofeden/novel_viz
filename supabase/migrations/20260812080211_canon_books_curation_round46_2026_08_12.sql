INSERT INTO canon_books (title, author, source)
SELECT v.title, v.author, 'daily_agent_canon_backfill_2026_08_12'
FROM (VALUES
  ('On the Freedom of a Christian', 'Martin Luther'),
  ('The Freedom of a Christian', 'Martin Luther'),
  ('A Treatise on Christian Liberty', 'Martin Luther'),
  ('Von der Freiheit eines Christenmenschen', 'Martin Luther'),
  ('The Work of Art in the Age of Mechanical Reproduction', 'Walter Benjamin'),
  ('The Work of Art in the Age of Its Technological Reproducibility', 'Walter Benjamin'),
  ('Das Kunstwerk im Zeitalter seiner technischen Reproduzierbarkeit', 'Walter Benjamin'),
  ('Prison Notebooks', 'Antonio Gramsci'),
  ('Selections from the Prison Notebooks', 'Antonio Gramsci'),
  ('Quaderni del carcere', 'Antonio Gramsci'),
  ('Against Interpretation', 'Susan Sontag'),
  ('Zorba the Greek', 'Nikos Kazantzakis'),
  ('Life and Times of Alexis Zorbas', 'Nikos Kazantzakis'),
  ('Vios kai Politeia tou Alexi Zorba', 'Nikos Kazantzakis')
) AS v(title, author)
WHERE NOT EXISTS (
  SELECT 1 FROM canon_books cb WHERE cb.title = v.title AND cb.author = v.author
);
