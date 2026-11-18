-- Follow-up to 20261118181806_membership: a switch for the paywall.
--
-- The membership code ships before the Stripe account exists. With the
-- paywall on and no way to pay, My Notes and Refine would simply be locked
-- for everyone. So enforcement reads public.app_settings.paywall_enabled
-- (default false). Turn it on once Stripe is live:
--   UPDATE public.app_settings SET value = 'true', updated_at = now() WHERE key = 'paywall_enabled';
-- Members and admins are unaffected either way; has_membership() is unchanged.

CREATE TABLE IF NOT EXISTS public.app_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_settings FROM anon, authenticated;

INSERT INTO public.app_settings (key, value) VALUES ('paywall_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.paywall_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce((SELECT s.value = 'true'::jsonb FROM public.app_settings s WHERE s.key = 'paywall_enabled'), false);
$$;
REVOKE ALL ON FUNCTION public.paywall_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.paywall_enabled() TO anon, authenticated, service_role;

-- One call for analyze-novel's refine gate: allowed when the paywall is off,
-- or the user (NULL = signed out) is a member or an admin.
CREATE OR REPLACE FUNCTION public.membership_allows(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT NOT public.paywall_enabled() OR public.has_membership(p_user);
$$;
REVOKE ALL ON FUNCTION public.membership_allows(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.membership_allows(uuid) TO service_role;

-- Signed-out readers can ask too (is_member false, paywall as set).
CREATE OR REPLACE FUNCTION public.my_membership()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'paywall', public.paywall_enabled(),
    'is_member', public.has_membership((SELECT auth.uid())),
    'is_admin', EXISTS (SELECT 1 FROM public.app_admins a WHERE a.user_id = (SELECT auth.uid())),
    'status', m.status,
    'current_period_end', m.current_period_end,
    'cancel_at_period_end', coalesce(m.cancel_at_period_end, false),
    'has_billing', m.stripe_customer_id IS NOT NULL
  )
  FROM (SELECT 1) one
  LEFT JOIN public.memberships m ON m.user_id = (SELECT auth.uid());
$$;
REVOKE ALL ON FUNCTION public.my_membership() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_membership() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_notes_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL
     AND coalesce(btrim(NEW.note), '') <> ''
     AND NEW.note IS DISTINCT FROM OLD.note
     AND public.paywall_enabled()
     AND NOT public.has_membership((SELECT auth.uid())) THEN
    RAISE EXCEPTION 'membership_required'
      USING ERRCODE = 'P0001', HINT = 'My Notes is part of NovelViz Membership.';
  END IF;
  RETURN NEW;
END;
$$;
