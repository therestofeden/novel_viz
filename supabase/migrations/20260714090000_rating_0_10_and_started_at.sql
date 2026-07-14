-- Rating scale 1-5 → 0-10 (no existing ratings; verified 0 rated rows before this migration)
ALTER TABLE public.shelf_books DROP CONSTRAINT IF EXISTS shelf_books_rating_check;
ALTER TABLE public.shelf_books
  ADD CONSTRAINT shelf_books_rating_check CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10));

-- Track when a reader started a book (set on first transition to 'reading')
ALTER TABLE public.shelf_books ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
