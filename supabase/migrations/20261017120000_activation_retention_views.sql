-- B7 (MVP launch checklist): activation and day 1-7 retention views over app_events.
-- Read-only, service-role / dashboard use only. No new writes, no new PII.
-- security_invoker + REVOKE so anon/authenticated cannot read the locked-down base table through them.

CREATE OR REPLACE VIEW public.v_event_identity_first_seen
WITH (security_invoker = true) AS
SELECT COALESCE(user_id::text, session_id) AS identity,
       min(created_at)::date              AS first_day,
       min(created_at)                    AS first_seen_at
FROM public.app_events
GROUP BY 1;

CREATE OR REPLACE VIEW public.v_activation_daily
WITH (security_invoker = true) AS
WITH f AS (
  SELECT s.*, EXISTS (
    SELECT 1 FROM public.app_events e
    WHERE COALESCE(e.user_id::text, e.session_id) = s.identity
      AND e.event IN ('analysis_viewed','shelf_add','rating_set','note_saved')
      AND e.created_at <= s.first_seen_at + interval '24 hours'
  ) AS activated
  FROM public.v_event_identity_first_seen s
)
SELECT first_day AS cohort_day,
       count(*) AS new_identities,
       count(*) FILTER (WHERE activated) AS activated,
       round(100.0 * count(*) FILTER (WHERE activated) / NULLIF(count(*), 0), 1) AS activation_pct
FROM f GROUP BY first_day;

CREATE OR REPLACE VIEW public.v_retention_daily
WITH (security_invoker = true) AS
WITH f AS (SELECT * FROM public.v_event_identity_first_seen),
     sizes AS (SELECT first_day, count(*) AS cohort_size FROM f GROUP BY first_day),
     a AS (SELECT DISTINCT COALESCE(user_id::text, session_id) AS identity, created_at::date AS day
           FROM public.app_events)
SELECT f.first_day AS cohort_day,
       (a.day - f.first_day) AS day_n,
       count(DISTINCT f.identity) AS retained,
       sizes.cohort_size
FROM f JOIN a USING (identity) JOIN sizes USING (first_day)
WHERE a.day - f.first_day BETWEEN 1 AND 7
GROUP BY f.first_day, (a.day - f.first_day), sizes.cohort_size;

REVOKE ALL ON public.v_event_identity_first_seen, public.v_activation_daily, public.v_retention_daily
  FROM PUBLIC, anon, authenticated;
