-- B3 (MVP launch checklist): in-app feedback. Written ONLY by the `submit-feedback`
-- edge function (service role, after validation, size caps and per-IP rate limit).
-- RLS enabled with NO policies and all client grants revoked: clients can neither
-- read nor write it directly, so feedback text from other users is never exposed.
CREATE TABLE IF NOT EXISTS public.feedback (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID NULL,
  session_id  TEXT NULL CHECK (session_id IS NULL OR char_length(session_id) BETWEEN 8 AND 64),
  message     TEXT NOT NULL CHECK (char_length(message) BETWEEN 3 AND 2000),
  page        TEXT NOT NULL CHECK (char_length(page) <= 64),
  slug        TEXT NULL CHECK (slug IS NULL OR char_length(slug) <= 200),
  kind        TEXT NOT NULL DEFAULT 'general' CHECK (kind IN ('general','bug','idea','praise')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.feedback FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS feedback_created_idx ON public.feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_user_idx ON public.feedback (user_id, created_at DESC) WHERE user_id IS NOT NULL;
