-- Daily backend audit (2026-08-03): recurring defense-in-depth sweep.
-- Same class of issue fixed 2026-07-24 for 11 tables (Supabase's default
-- GRANT ALL to anon/authenticated on every new table), but new tables/columns
-- created since then (recommendation_blocks, shelf_cluster_members,
-- book_takeaways, pinned_characters, recommendation_feedback, etc.) picked up
-- the same default grants again. None of these are currently exploitable --
-- RLS is enabled with no matching policy for the command, so the grant alone
-- can't write -- but an unused grant is an unnecessary attack surface: if RLS
-- is ever accidentally disabled on a table, or a future permissive policy is
-- added for a *different* command and misapplied, the stale grant is what
-- turns that mistake into an actual write. Revoking now costs nothing (zero
-- functional writes ever succeeded through these grants) and closes the gap.
--
-- profiles: no DELETE policy exists at all (users must never delete their
-- own profile row directly -- would orphan shelves/shelf_books FKs), so both
-- anon and authenticated DELETE grants are dead weight.
-- recommendation_blocks / shelf_cluster_members: no UPDATE policy exists for
-- either table (only SELECT/INSERT/DELETE) -- rows are append/remove-only by
-- design, so anon+authenticated UPDATE grants are dead weight.

REVOKE INSERT, UPDATE, DELETE ON public.book_overrides FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.book_takeaways FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.pinned_characters FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon;
REVOKE DELETE ON public.profiles FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.recommendation_blocks FROM anon;
REVOKE UPDATE ON public.recommendation_blocks FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.recommendation_feedback FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.shelf_books FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.shelf_cluster_members FROM anon;
REVOKE UPDATE ON public.shelf_cluster_members FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.shelf_clusters FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.shelf_recommendations FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.shelves FROM anon;
