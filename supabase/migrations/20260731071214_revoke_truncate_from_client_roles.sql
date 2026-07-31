-- TRUNCATE is not gated by RLS (unlike SELECT/INSERT/UPDATE/DELETE) -- a role
-- with TRUNCATE grant can wipe an entire table regardless of row policies.
-- These 11 tables legitimately grant anon/authenticated INSERT/UPDATE/DELETE
-- for RLS-scoped user writes, but the app (PostgREST/supabase-js) never
-- issues TRUNCATE and has no legitimate use for it. Revoking closes a
-- least-privilege gap with zero functional risk.
REVOKE TRUNCATE ON TABLE
  public.shelf_books,
  public.shelves,
  public.profiles,
  public.book_overrides,
  public.book_takeaways,
  public.pinned_characters,
  public.recommendation_blocks,
  public.recommendation_feedback,
  public.shelf_clusters,
  public.shelf_cluster_members,
  public.shelf_recommendations
FROM anon, authenticated;
