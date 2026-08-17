-- Canon curation round 52 (2026-08-17): I Ching, Micrologus (Guido of
-- Arezzo), Liber Abaci (Fibonacci), Comentarios Reales de los Incas
-- (Garcilaso de la Vega), I Quattro Libri dell'Architettura (Palladio) --
-- 5 gap-closing titles.
-- Mirrors the exact INSERT applied live via apply_migration.

INSERT INTO canon_books (title, author, source) VALUES
  ('I Ching', 'Anonymous', 'manual'),
  ('Micrologus', 'Guido of Arezzo', 'manual'),
  ('Liber Abaci', 'Fibonacci', 'manual'),
  ('Comentarios Reales de los Incas', 'Inca Garcilaso de la Vega', 'manual'),
  ('I Quattro Libri dell''Architettura', 'Andrea Palladio', 'manual')
ON CONFLICT DO NOTHING;
