-- Follow-up to 20261118181806_membership: the shelf's "Undo" after removing a
-- book re-inserts the row with its note, so it can't lose a reader's words.
-- Gating INSERTs would make that undo fail for anyone who isn't a member and
-- destroy the note. Writing a note in the app is always an UPDATE (the row is
-- created first, the note saved after), so the gate now sits on UPDATE only.
CREATE OR REPLACE FUNCTION public.enforce_notes_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL
     AND coalesce(btrim(NEW.note), '') <> ''
     AND NEW.note IS DISTINCT FROM OLD.note
     AND NOT public.has_membership((SELECT auth.uid())) THEN
    RAISE EXCEPTION 'membership_required'
      USING ERRCODE = 'P0001', HINT = 'My Notes is part of NovelViz Membership.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shelf_books_notes_membership ON public.shelf_books;
CREATE TRIGGER trg_shelf_books_notes_membership
  BEFORE UPDATE OF note ON public.shelf_books
  FOR EACH ROW EXECUTE FUNCTION public.enforce_notes_membership();
