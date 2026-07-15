-- These are trigger/maintenance functions, not intended for direct client
-- calls — SECURITY DEFINER functions are PUBLICLY EXECUTABLE via PostgREST
-- RPC by default unless explicitly revoked (same gotcha hit and fixed for
-- gemini_daily_spend's RPCs on 2026-07-05; get_advisors flagged all three
-- new functions from the rating_consistency_and_book_stats migration).
REVOKE EXECUTE ON FUNCTION public.clear_rating_on_unfinish() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_book_rating_stats(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_shelf_books_rating_stats() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.refresh_book_rating_stats(TEXT) TO service_role;
