-- NovelViz Membership (2026-11-18): EUR 2.20/month via Stripe Checkout.
--
-- Members get "My Notes" and "Refine the visualization". Admins
-- (public.app_admins) always count as members, so the owner's account is
-- never locked out. Stripe is the source of truth: the stripe-webhook edge
-- function is the only writer of public.memberships (service role). Clients
-- can read their own row and call public.my_membership(); nothing else.

-- --------------------------------------------------------------- admins
CREATE TABLE IF NOT EXISTS public.app_admins (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_admins FROM anon, authenticated;
-- Rows are added by hand (SQL editor / MCP), never from a client and never in
-- a migration, so no account id ends up in this public repository.

-- ---------------------------------------------------------- memberships
CREATE TABLE IF NOT EXISTS public.memberships (
  user_id                uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id     text UNIQUE,
  stripe_subscription_id text UNIQUE,
  -- Stripe subscription status: incomplete, incomplete_expired, trialing,
  -- active, past_due, canceled, unpaid, paused. 'none' = customer only.
  status                 text NOT NULL DEFAULT 'none',
  price_id               text,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.memberships FROM anon, authenticated;
GRANT SELECT ON public.memberships TO authenticated;
DROP POLICY IF EXISTS "Members read their own membership" ON public.memberships;
CREATE POLICY "Members read their own membership" ON public.memberships
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

-- Webhook idempotency: Stripe retries deliveries; each event id is applied once.
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id          text PRIMARY KEY,
  type        text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_events FROM anon, authenticated;

-- ------------------------------------------------------------ entitlement
-- past_due keeps access while Stripe retries the card (up to 7 days after
-- the period end); canceled-at-period-end keeps access until the period ends.
CREATE OR REPLACE FUNCTION public.has_membership(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_user IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.app_admins a WHERE a.user_id = p_user)
    OR EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = p_user
        AND (
          (m.status IN ('active', 'trialing') AND (m.current_period_end IS NULL OR m.current_period_end > now() - interval '1 day'))
          OR (m.status = 'past_due' AND m.current_period_end > now() - interval '7 days')
        )
    )
  );
$$;
REVOKE ALL ON FUNCTION public.has_membership(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_membership(uuid) TO service_role;

-- What the signed-in reader sees about their own membership.
CREATE OR REPLACE FUNCTION public.my_membership()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
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
REVOKE ALL ON FUNCTION public.my_membership() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_membership() TO authenticated, service_role;

-- ----------------------------------------------------- My Notes paywall
-- Writing or changing a note needs a membership. Clearing a note never does
-- (readers can always delete their own words), and nothing is ever hidden:
-- a lapsed member still reads every note they wrote. Service-role writes
-- (auth.uid() IS NULL) pass through.
CREATE OR REPLACE FUNCTION public.enforce_notes_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL
     AND coalesce(btrim(NEW.note), '') <> ''
     AND (TG_OP = 'INSERT' OR NEW.note IS DISTINCT FROM OLD.note)
     AND NOT public.has_membership((SELECT auth.uid())) THEN
    RAISE EXCEPTION 'membership_required'
      USING ERRCODE = 'P0001', HINT = 'My Notes is part of NovelViz Membership.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shelf_books_notes_membership ON public.shelf_books;
CREATE TRIGGER trg_shelf_books_notes_membership
  BEFORE INSERT OR UPDATE OF note ON public.shelf_books
  FOR EACH ROW EXECUTE FUNCTION public.enforce_notes_membership();
