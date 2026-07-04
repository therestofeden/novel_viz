-- ======================================================================
-- Migration: rls_initplan_security_perf_fixes
-- Date: 2026-07-02
-- Applied: via Supabase MCP (agent daily_backend run)
--
-- Fixes three advisor warnings:
--
-- 1. auth_rls_initplan (WARN, PERFORMANCE) — 41 policies across 11 tables
--    were calling auth.uid() as a volatile function, re-evaluated once per
--    row. Wrapping in (SELECT auth.uid()) makes Postgres evaluate it once
--    per query (InitPlan), which is the correct behavior and a significant
--    win on any table with more than ~10 rows per user.
--
-- 2. function_search_path_mutable (WARN, SECURITY) — set_updated_at()
--    had no pinned search_path, theoretically allowing a schema-injection
--    attack via a rogue object placed earlier in the search path.
--    Fix: ALTER FUNCTION ... SET search_path = public, pg_temp.
--
-- 3. unindexed_foreign_keys (INFO, PERFORMANCE) — shelf_cluster_members
--    had an FK on shelf_book_id with no covering index. Joins or deletes
--    cascading through this FK triggered sequential scans.
--
-- 4. rls_enabled_no_policy (INFO, SECURITY) — rate_limit_events had RLS
--    enabled but no explicit policy. Since edge functions access it via
--    the service role key (which bypasses RLS), the de facto behavior was
--    already deny-all for clients. Adding an explicit RESTRICTIVE policy
--    makes the intent visible and silences the advisory lint.
--
-- Remaining advisory (not fixable via SQL migration):
--   auth_leaked_password_protection (WARN) — enable in Supabase Dashboard:
--   Authentication > Providers > Email > "Leaked Password Protection"
-- ======================================================================

-- ── 1. Fix set_updated_at search_path ──────────────────────────────────
ALTER FUNCTION public.set_updated_at() SET search_path = public, pg_temp;

-- ── 2. Add missing FK index on shelf_cluster_members ───────────────────
CREATE INDEX IF NOT EXISTS idx_shelf_cluster_members_shelf_book_id
  ON public.shelf_cluster_members (shelf_book_id);

-- ── 3. rate_limit_events: explicit deny-all policy ─────────────────────
-- Service-role-only table; no client should ever read/write it directly.
CREATE POLICY "deny all client access"
  ON public.rate_limit_events
  AS RESTRICTIVE FOR ALL TO public USING (false);

-- ── 4. RLS initplan fixes (auth.uid() → (SELECT auth.uid())) ───────────

-- profiles
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- shelves
DROP POLICY IF EXISTS "Users view their own shelves" ON public.shelves;
CREATE POLICY "Users view their own shelves" ON public.shelves
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users insert their own shelves" ON public.shelves;
CREATE POLICY "Users insert their own shelves" ON public.shelves
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users update their own shelves" ON public.shelves;
CREATE POLICY "Users update their own shelves" ON public.shelves
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users delete their own shelves" ON public.shelves;
CREATE POLICY "Users delete their own shelves" ON public.shelves
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- shelf_books
DROP POLICY IF EXISTS "Users view their own shelf books" ON public.shelf_books;
CREATE POLICY "Users view their own shelf books" ON public.shelf_books
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users insert their own shelf books" ON public.shelf_books;
CREATE POLICY "Users insert their own shelf books" ON public.shelf_books
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users update their own shelf books" ON public.shelf_books;
CREATE POLICY "Users update their own shelf books" ON public.shelf_books
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users delete their own shelf books" ON public.shelf_books;
CREATE POLICY "Users delete their own shelf books" ON public.shelf_books
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- shelf_recommendations
DROP POLICY IF EXISTS "Users view their own recommendations" ON public.shelf_recommendations;
CREATE POLICY "Users view their own recommendations" ON public.shelf_recommendations
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users insert their own recommendations" ON public.shelf_recommendations;
CREATE POLICY "Users insert their own recommendations" ON public.shelf_recommendations
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users update their own recommendations" ON public.shelf_recommendations;
CREATE POLICY "Users update their own recommendations" ON public.shelf_recommendations
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users delete their own recommendations" ON public.shelf_recommendations;
CREATE POLICY "Users delete their own recommendations" ON public.shelf_recommendations
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- book_overrides
DROP POLICY IF EXISTS "Users view own overrides" ON public.book_overrides;
CREATE POLICY "Users view own overrides" ON public.book_overrides
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users insert own overrides" ON public.book_overrides;
CREATE POLICY "Users insert own overrides" ON public.book_overrides
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users update own overrides" ON public.book_overrides;
CREATE POLICY "Users update own overrides" ON public.book_overrides
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users delete own overrides" ON public.book_overrides;
CREATE POLICY "Users delete own overrides" ON public.book_overrides
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- shelf_clusters
DROP POLICY IF EXISTS "Users view own clusters" ON public.shelf_clusters;
CREATE POLICY "Users view own clusters" ON public.shelf_clusters
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users insert own clusters" ON public.shelf_clusters;
CREATE POLICY "Users insert own clusters" ON public.shelf_clusters
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users update own clusters" ON public.shelf_clusters;
CREATE POLICY "Users update own clusters" ON public.shelf_clusters
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users delete own clusters" ON public.shelf_clusters;
CREATE POLICY "Users delete own clusters" ON public.shelf_clusters
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- shelf_cluster_members
DROP POLICY IF EXISTS "Users view own cluster members" ON public.shelf_cluster_members;
CREATE POLICY "Users view own cluster members" ON public.shelf_cluster_members
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users insert own cluster members" ON public.shelf_cluster_members;
CREATE POLICY "Users insert own cluster members" ON public.shelf_cluster_members
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users delete own cluster members" ON public.shelf_cluster_members;
CREATE POLICY "Users delete own cluster members" ON public.shelf_cluster_members
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- recommendation_feedback
DROP POLICY IF EXISTS "Users view own feedback" ON public.recommendation_feedback;
CREATE POLICY "Users view own feedback" ON public.recommendation_feedback
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users insert own feedback" ON public.recommendation_feedback;
CREATE POLICY "Users insert own feedback" ON public.recommendation_feedback
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users update own feedback" ON public.recommendation_feedback;
CREATE POLICY "Users update own feedback" ON public.recommendation_feedback
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users delete own feedback" ON public.recommendation_feedback;
CREATE POLICY "Users delete own feedback" ON public.recommendation_feedback
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- recommendation_blocks
DROP POLICY IF EXISTS "Users view own blocks" ON public.recommendation_blocks;
CREATE POLICY "Users view own blocks" ON public.recommendation_blocks
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users insert own blocks" ON public.recommendation_blocks;
CREATE POLICY "Users insert own blocks" ON public.recommendation_blocks
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users delete own blocks" ON public.recommendation_blocks;
CREATE POLICY "Users delete own blocks" ON public.recommendation_blocks
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- pinned_characters
DROP POLICY IF EXISTS "Users view own pins" ON public.pinned_characters;
CREATE POLICY "Users view own pins" ON public.pinned_characters
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users insert own pins" ON public.pinned_characters;
CREATE POLICY "Users insert own pins" ON public.pinned_characters
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users update own pins" ON public.pinned_characters;
CREATE POLICY "Users update own pins" ON public.pinned_characters
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users delete own pins" ON public.pinned_characters;
CREATE POLICY "Users delete own pins" ON public.pinned_characters
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- book_takeaways
DROP POLICY IF EXISTS "Users manage own takeaways" ON public.book_takeaways;
CREATE POLICY "Users manage own takeaways" ON public.book_takeaways
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
