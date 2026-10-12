-- B1 (MVP launch checklist): first-party event log. No cookies, no third parties.
-- Written ONLY by the `track-event` edge function (service role, after allowlist,
-- size cap and per-IP rate limit). RLS is enabled with NO policies, so anon and
-- authenticated clients can neither read nor write it directly.
CREATE TABLE IF NOT EXISTS public.app_events (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID NULL,
  session_id  TEXT NOT NULL CHECK (char_length(session_id) BETWEEN 8 AND 64),
  event       TEXT NOT NULL CHECK (char_length(event) BETWEEN 1 AND 48),
  props       JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(props) <= 2048),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_events FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS app_events_event_created_idx ON public.app_events (event, created_at DESC);
CREATE INDEX IF NOT EXISTS app_events_user_created_idx ON public.app_events (user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS app_events_session_created_idx ON public.app_events (session_id, created_at);

-- Retention: keep 180 days (called by db-maintenance or manually).
CREATE OR REPLACE FUNCTION public.purge_old_app_events()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_deleted INTEGER;
BEGIN
  DELETE FROM public.app_events WHERE created_at < now() - interval '180 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END; $$;
REVOKE EXECUTE ON FUNCTION public.purge_old_app_events() FROM PUBLIC, anon, authenticated;
