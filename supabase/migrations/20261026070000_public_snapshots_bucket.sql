-- perf(popular-books): CDN-served snapshot of the Tier-1 autocomplete index.
--
-- popular-books is cold on almost every real request (isolates are recycled
-- long before the 5-min in-process memo pays off), so every page load paid
-- ~1.6-2.2 s for a payload that only changes when canon/seed/analyses do.
-- The function now also writes its computed payload to
--   storage: public-snapshots/popular-books/v1.json
-- and the client reads that object straight from the Storage CDN first
-- (falling back to the function if it is missing, stale or slow).
--
-- Security model:
--  * public = true  -> anyone can GET objects (the same data popular-books
--    already serves publicly; titles/authors/popularity only, no user data).
--  * NO storage.objects policies are created for this bucket, so anon /
--    authenticated cannot INSERT/UPDATE/DELETE. Only service_role (used by
--    the edge function, bypasses RLS) can write.
--  * 2 MB size cap + JSON-only mime type bounds abuse if a key ever leaked.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('public-snapshots', 'public-snapshots', true, 2097152, ARRAY['application/json'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
