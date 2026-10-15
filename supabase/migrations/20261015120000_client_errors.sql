-- B2 (MVP launch checklist): client error capture. Written ONLY by the `report-error`
-- edge function through the SECURITY DEFINER RPC below. RLS on, no policies, grants
-- revoked: clients cannot read or write. Rows are deduped per (fingerprint, day) with a
-- counter so an error loop cannot grow the table unbounded.
CREATE TABLE IF NOT EXISTS public.client_errors (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fingerprint  TEXT NOT NULL CHECK (char_length(fingerprint) BETWEEN 8 AND 64),
  day          DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  source       TEXT NOT NULL CHECK (source IN ('boundary','window','promise')),
  message      TEXT NOT NULL CHECK (char_length(message) <= 500),
  stack        TEXT NULL CHECK (stack IS NULL OR char_length(stack) <= 3000),
  page         TEXT NOT NULL CHECK (char_length(page) <= 64),
  release      TEXT NULL CHECK (release IS NULL OR char_length(release) <= 40),
  user_agent   TEXT NULL CHECK (user_agent IS NULL OR char_length(user_agent) <= 200),
  occurrences  INTEGER NOT NULL DEFAULT 1,
  first_seen   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fingerprint, day)
);

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_errors FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS client_errors_last_seen_idx ON public.client_errors (last_seen DESC);

CREATE OR REPLACE FUNCTION public.record_client_error(
  p_fingerprint TEXT, p_source TEXT, p_message TEXT, p_stack TEXT,
  p_page TEXT, p_release TEXT, p_user_agent TEXT
) RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.client_errors (fingerprint, source, message, stack, page, release, user_agent)
  VALUES (p_fingerprint, p_source, p_message, p_stack, p_page, p_release, p_user_agent)
  ON CONFLICT (fingerprint, day) DO UPDATE
    SET occurrences = public.client_errors.occurrences + 1, last_seen = now();
$$;
REVOKE ALL ON FUNCTION public.record_client_error(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_client_error(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO service_role;

-- Retention: drop rows older than 30 days (call from existing cron/cleanup job).
CREATE OR REPLACE FUNCTION public.purge_client_errors() RETURNS INTEGER
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH d AS (DELETE FROM public.client_errors WHERE last_seen < now() - interval '30 days' RETURNING 1)
  SELECT count(*)::int FROM d;
$$;
REVOKE ALL ON FUNCTION public.purge_client_errors() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_client_errors() TO service_role;
