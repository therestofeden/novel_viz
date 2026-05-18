-- Request log for ad-hoc rate limiting on the analyze-novel edge function.
-- IPs are hashed with a server-side salt before storage (privacy-friendly, GDPR-compliant).
CREATE TABLE public.rate_limit_events (
  id BIGSERIAL PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  route TEXT NOT NULL,
  is_prefetch BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Fast lookup for "how many events from this IP+route in the last N seconds"
CREATE INDEX idx_rlevents_lookup
  ON public.rate_limit_events (ip_hash, route, created_at DESC);

-- Lock down: only service role (the edge function) may read or write.
-- No public/anon access at all — this data must never leak to clients.
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;

-- Intentionally NO policies for anon/authenticated roles → fully blocked.
-- Service role bypasses RLS automatically.

-- Helper: count events from one IP on one route in the last N seconds.
-- SECURITY DEFINER + locked search_path so we can call it from the edge function
-- without granting broader table access to anon callers (we don't grant EXECUTE to anon anyway).
CREATE OR REPLACE FUNCTION public.count_recent_events(
  p_ip_hash TEXT,
  p_route TEXT,
  p_window_seconds INTEGER,
  p_prefetch_only BOOLEAN DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.rate_limit_events
  WHERE ip_hash = p_ip_hash
    AND route = p_route
    AND created_at > now() - (p_window_seconds || ' seconds')::interval
    AND (p_prefetch_only IS NULL OR is_prefetch = p_prefetch_only);
$$;

-- Opportunistic cleanup — called from the edge function ~1% of the time.
-- Deletes any row older than 7 days. Cheap because of the index.
CREATE OR REPLACE FUNCTION public.purge_old_rate_limit_events()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.rate_limit_events
  WHERE created_at < now() - interval '7 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Revoke EXECUTE from public/anon — only service_role calls these.
REVOKE EXECUTE ON FUNCTION public.count_recent_events(TEXT, TEXT, INTEGER, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_old_rate_limit_events() FROM PUBLIC, anon, authenticated;