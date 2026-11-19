// stripe-webhook (2026-11-18)
//
// The only writer of public.memberships. Stripe calls this endpoint; each
// request is checked against STRIPE_WEBHOOK_SECRET before anything is read.
// Configure in the Stripe dashboard (Developers -> Webhooks) with the URL
//   https://<project>.supabase.co/functions/v1/stripe-webhook
// and these events: checkout.session.completed,
// customer.subscription.created, customer.subscription.updated,
// customer.subscription.deleted, invoice.paid, invoice.payment_failed.
//
// Events can arrive late, twice or out of order, so the handler never trusts
// the event body for state: it re-reads the subscription from Stripe and
// stores what Stripe says now. Re-delivery is therefore harmless.
// Non-2xx answers make Stripe retry with backoff for up to three days.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { readTextBodyBounded, PayloadTooLargeError } from "../_shared/body-limit.ts";
import { membershipColumns, shouldApplySubscription, stripeRequest, type StripeSubscription, verifyStripeSignature } from "../_shared/stripe.ts";

const MAX_BODY_BYTES = 256_000;
const DB_TIMEOUT_MS = 4000;
const HEADERS = { "Content-Type": "application/json" };

async function withTimeout<T, F = T>(promise: PromiseLike<T>, fallback: F, timeoutMs = DB_TIMEOUT_MS): Promise<T | F> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<F>((resolve) => { timer = setTimeout(() => resolve(fallback), timeoutMs); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const TIMED_OUT = { data: null, error: { message: "db_timeout" } } as const;

type StripeEvent = { id: string; type: string; data?: { object?: Record<string, unknown> } };

function subscriptionIdOf(event: StripeEvent): string | null {
  const o = event.data?.object ?? {};
  if (event.type.startsWith("customer.subscription.")) return typeof o.id === "string" ? o.id : null;
  if (event.type === "checkout.session.completed") return typeof o.subscription === "string" ? o.subscription : null;
  if (event.type.startsWith("invoice.")) {
    if (typeof o.subscription === "string") return o.subscription;
    // Newer API versions: invoice.parent.subscription_details.subscription
    const parent = o.parent as { subscription_details?: { subscription?: unknown } } | undefined;
    const s = parent?.subscription_details?.subscription;
    return typeof s === "string" ? s : null;
  }
  return null;
}

// safety-net-ignore: Stripe calls this server-to-server, never a browser, so there are no CORS headers to carry; the handler still has a full-body try/catch.
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response(null, { status: 405 });

  // Safety net: never let an exception escape without a response.
  try {
    const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!secret || !stripeKey) return new Response(JSON.stringify({ error: "not configured" }), { status: 503, headers: HEADERS });

    let payload: string;
    try {
      payload = await readTextBodyBounded(req, MAX_BODY_BYTES);
    } catch (e) {
      if (e instanceof PayloadTooLargeError) return new Response(null, { status: 413 });
      return new Response(null, { status: 400 });
    }
    if (!(await verifyStripeSignature(payload, req.headers.get("stripe-signature"), secret))) {
      return new Response(JSON.stringify({ error: "bad signature" }), { status: 400, headers: HEADERS });
    }

    let event: StripeEvent;
    try {
      event = JSON.parse(payload);
    } catch {
      return new Response(null, { status: 400 });
    }

    const subId = subscriptionIdOf(event);
    if (!subId) return new Response(JSON.stringify({ received: true, ignored: event.type }), { status: 200, headers: HEADERS });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const sub = await stripeRequest<StripeSubscription>(stripeKey, "GET", `/subscriptions/${encodeURIComponent(subId)}`);
    const cols = membershipColumns(sub);

    // Who is this? checkout carries client_reference_id; subscriptions carry
    // metadata.user_id (set at checkout); otherwise match the Stripe customer.
    const obj = event.data?.object ?? {};
    let userId: string | null =
      (event.type === "checkout.session.completed" && typeof obj.client_reference_id === "string" ? obj.client_reference_id : null) ??
      sub.metadata?.user_id ?? null;
    if (!userId && cols.stripe_customer_id) {
      const { data } = await withTimeout(
        admin.from("memberships").select("user_id").eq("stripe_customer_id", cols.stripe_customer_id).maybeSingle(),
        TIMED_OUT,
      );
      userId = (data as { user_id?: string } | null)?.user_id ?? null;
    }
    if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
      console.error(JSON.stringify({ fn: "stripe-webhook", event: event.type, id: event.id, problem: "no_user_for_subscription" }));
      // 200: retrying will never find a user either; logged for a human.
      return new Response(JSON.stringify({ received: true, unmatched: true }), { status: 200, headers: HEADERS });
    }

    // Never let a dead duplicate subscription overwrite the reader's live one.
    const { data: current, error: readErr } = await withTimeout(
      admin.from("memberships").select("stripe_subscription_id, status").eq("user_id", userId).maybeSingle(),
      TIMED_OUT,
    );
    if (readErr) {
      // 500 so Stripe retries: deciding blind could revoke a paying reader.
      console.error(JSON.stringify({ fn: "stripe-webhook", event: event.type, id: event.id, stage: "read", error: String((readErr as { message?: string })?.message ?? readErr).slice(0, 200) }));
      return new Response(JSON.stringify({ error: "storage failed" }), { status: 500, headers: HEADERS });
    }
    if (!shouldApplySubscription(current as { stripe_subscription_id?: string | null; status?: string | null } | null, { id: sub.id, status: sub.status })) {
      console.warn(JSON.stringify({ fn: "stripe-webhook", event: event.type, id: event.id, problem: "stale_duplicate_subscription", sub: sub.id, status: sub.status }));
      return new Response(JSON.stringify({ received: true, skipped: "duplicate_subscription" }), { status: 200, headers: HEADERS });
    }

    const { error } = await withTimeout(
      admin.from("memberships").upsert({ user_id: userId, ...cols }, { onConflict: "user_id" }),
      TIMED_OUT,
    );
    if (error) {
      console.error(JSON.stringify({ fn: "stripe-webhook", event: event.type, id: event.id, stage: "upsert", error: String((error as { message?: string })?.message ?? error).slice(0, 200) }));
      return new Response(JSON.stringify({ error: "storage failed" }), { status: 500, headers: HEADERS });
    }

    // Audit trail of processed deliveries (best effort, ignore duplicates).
    admin.from("stripe_events").upsert({ id: event.id, type: event.type }, { onConflict: "id", ignoreDuplicates: true })
      .then(() => {}, () => {});

    console.log(JSON.stringify({ fn: "stripe-webhook", event: event.type, status: cols.status }));
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: HEADERS });
  } catch (err) {
    console.error(JSON.stringify({ fn: "stripe-webhook", error: String((err as Error)?.message ?? err).slice(0, 300) }));
    return new Response(JSON.stringify({ error: "temporary failure" }), { status: 500, headers: HEADERS });
  }
});
