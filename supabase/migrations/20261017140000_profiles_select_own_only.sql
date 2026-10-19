-- K5 (P1, privacy): public.profiles was readable by anyone holding the public
-- anon key ("Profiles are viewable by everyone", USING (true)). display_name
-- defaults to the e-mail local part, so anon could enumerate every reader's
-- user_id + e-mail prefix. The only client read is Shelf.tsx, which reads the
-- signed-in user's own row, so owner-only SELECT loses nothing.
-- Idempotent: safe to re-run, and equivalent to the launch task's 818a22e.

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- anon has no policy left, so drop its dead grants too (defense in depth).
REVOKE ALL ON public.profiles FROM anon;
