-- Canon curation round 51 (2026-08-16): The Epic of Manas, The Knight in
-- the Panther's Skin (Rustaveli), Kebra Nagast, The Egyptian Book of the
-- Dead, Personal Narrative (Humboldt) -- 5 gap-closing titles.
-- Mirrors the exact INSERT applied live via apply_migration.

INSERT INTO canon_books (title, author, source) VALUES
  ('The Epic of Manas', 'Anonymous', 'manual'),
  ('The Knight in the Panther''s Skin', 'Shota Rustaveli', 'manual'),
  ('Kebra Nagast', 'Anonymous', 'manual'),
  ('The Egyptian Book of the Dead', 'Anonymous', 'manual'),
  ('Personal Narrative of Travels to the Equinoctial Regions of the New Continent', 'Alexander von Humboldt', 'manual')
ON CONFLICT DO NOTHING;
