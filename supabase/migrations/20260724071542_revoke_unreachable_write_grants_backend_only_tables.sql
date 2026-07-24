-- 2026-07-24 daily backend audit: least-privilege hardening.
-- Found live: every public table grants full DELETE/INSERT/UPDATE/TRUNCATE
-- (plus TRIGGER/REFERENCES) to anon AND authenticated by default (Supabase's
-- stock schema privileges), even on tables whose RLS policies only ever
-- expose SELECT (7 tables: book_dna_consensus, book_rating_stats,
-- dna_recommendation_cache, novel_analyses, pca_basis, search_cache,
-- takeaway_questions_cache -- all "publicly readable" SELECT-only policies,
-- written exclusively by edge functions via the service-role key) or deny
-- every operation outright via a RESTRICTIVE qual=false policy (4 tables:
-- canon_books, gemini_daily_spend, gemini_model_circuit, rate_limit_events).
-- RLS already blocks every write from anon/authenticated on these 11 tables
-- today (verified via pg_policies: no permissive INSERT/UPDATE/DELETE
-- policy exists for either role on any of them), so this is a
-- zero-behavior-change hardening pass -- it removes privileges that were
-- never actually reachable through PostgREST. One exception worth calling
-- out: TRUNCATE is NOT gated by RLS at all in Postgres (RLS only applies to
-- SELECT/INSERT/UPDATE/DELETE), so it was the one genuinely RLS-unprotected
-- grant in the bunch, even though PostgREST itself has no verb that issues
-- TRUNCATE. service_role (used by edge functions) is a separate Postgres
-- role and is completely unaffected by these revokes. Tables with real
-- per-user write policies (auth.uid() = user_id -- shelf_books, profiles,
-- book_takeaways, book_overrides, shelves, shelf_clusters,
-- shelf_cluster_members, shelf_recommendations, pinned_characters,
-- recommendation_blocks, recommendation_feedback) are intentionally left
-- untouched.
--
-- Verified live post-apply: anon-key SELECT on novel_analyses/
-- book_rating_stats still 200, anon-key INSERT on novel_analyses now 401,
-- search-books edge function (service_role) still 200 -- zero regression.
revoke insert, update, delete, truncate, trigger, references on table public.book_dna_consensus from anon, authenticated;
revoke insert, update, delete, truncate, trigger, references on table public.book_rating_stats from anon, authenticated;
revoke insert, update, delete, truncate, trigger, references on table public.dna_recommendation_cache from anon, authenticated;
revoke insert, update, delete, truncate, trigger, references on table public.novel_analyses from anon, authenticated;
revoke insert, update, delete, truncate, trigger, references on table public.pca_basis from anon, authenticated;
revoke insert, update, delete, truncate, trigger, references on table public.search_cache from anon, authenticated;
revoke insert, update, delete, truncate, trigger, references on table public.takeaway_questions_cache from anon, authenticated;
revoke insert, update, delete, truncate, trigger, references on table public.canon_books from anon, authenticated;
revoke insert, update, delete, truncate, trigger, references on table public.gemini_daily_spend from anon, authenticated;
revoke insert, update, delete, truncate, trigger, references on table public.gemini_model_circuit from anon, authenticated;
revoke insert, update, delete, truncate, trigger, references on table public.rate_limit_events from anon, authenticated;
