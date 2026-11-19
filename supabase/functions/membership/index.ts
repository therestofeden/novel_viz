// membership (2026-11-18)
//
// NovelViz Membership: EUR 2.20 a month through Stripe Checkout. Unlocks My
// Notes and "Refine the visualization". Two actions, both for a signed-in
// reader (Bearer = their Supabase access token):
//
//   POST {action: "checkout", return_path?}  -> {url} of a Stripe Checkout page
//   POST {action: "portal",   return_path?}  -> {url} of the Stripe customer
//                                               portal (update card, cancel)
//
// Stripe stays the source of truth: this function never marks anyone a
// member. stripe-webhook writes public.memberships when Stripe confirms.
//
// Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_ID (the EUR 2.20/month price),
// optional STRIPE_AUTOMATIC_TAX=true (needs Stripe Tax enabled), optional
// APP_URL (fallback origin for redirect URLs). Until the two required
// secrets exist every call answers 503 "not_configured" and the app shows
// "Membership opens soon".

import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { readJsonBodyBounded, PayloadTooLargeError } from "../_shared/body-limit.ts";
import { ENTITLING_STATUSES, stripeRequest, StripeError } from "../_shared/stripe.ts";

const MAX_BODY_BYTES = 2_000;
const DB_TIMEOUT_MS = 4000;
const DEFAULT_APP_URL = "https://novel-viz.vercel.app";

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

/** Only same-app paths: "/book/x" yes, "//evil.com" or "https://..." no. */
function safePath(p: unknown): string {
  if (typeof p !== "string" || p.length > 300 || !p.startsWith("/") || p.startsWith("//") || p.includes("\\")) return "/";
  return p;
}

/** Redirect base: the caller's own allowlisted https origin, else APP_URL. */
function appOrigin(corsHeaders: Record<string, string>): string {
  const o = corsHeaders["Access-Control-Allow-Origin"];
  if (o && o.startsWith("https://")) return o;
  return (Deno.env.get("APP_URL") ?? DEFAULT_APP_URL).replace(/\/+$/, "");
}

function withParam(origin: string, path: string, key: string, value: string): string {
  const u = new URL(path, origin);
  u.searchParams.set(key, value);
  return u.toString();
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  // Safety net: every path below returns a Response that carries CORS headers.
  try {
    const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const priceId = Deno.env.get("STRIPE_PRICE_ID");
    if (!secretKey || !priceId) {
      return json(503, { error: "Membership opens soon.", code: "not_configured" });
    }

    let body: { action?: unknown; return_path?: unknown };
    try {
      body = (await readJsonBodyBounded(req, MAX_BODY_BYTES)) as typeof body;
    } catch (e) {
      if (e instanceof PayloadTooLargeError) return json(413, { error: "Request too large" });
      return json(400, { error: "Invalid JSON body" });
    }
    const action = body?.action === "portal" ? "portal" : body?.action === "checkout" ? "checkout" : null;
    if (!action) return json(400, { error: "Unknown action" });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: who } = await withTimeout(
      admin.auth.getUser(token),
      { data: { user: null }, error: null } as unknown as Awaited<ReturnType<typeof admin.auth.getUser>>,
    );
    const user = token ? who?.user : null;
    if (!user) return json(401, { error: "Sign in to manage your membership.", code: "signed_out" });

    const origin = appOrigin(corsHeaders);
    const path = safePath(body?.return_path);

    const { data: row } = await withTimeout(
      admin.from("memberships").select("stripe_customer_id").eq("user_id", user.id).maybeSingle(),
      { data: null, error: { message: "timeout" } } as unknown as { data: { stripe_customer_id: string | null } | null; error: unknown },
    );
    let customerId = row?.stripe_customer_id ?? null;

    if (action === "portal") {
      if (!customerId) return json(404, { error: "There is no billing account for you yet.", code: "no_customer" });
      const portal = await stripeRequest<{ url: string }>(secretKey, "POST", "/billing_portal/sessions", {
        customer: customerId,
        return_url: withParam(origin, path, "membership", "updated"),
      });
      return json(200, { url: portal.url });
    }

    // ---- checkout ----
    const { data: member } = await withTimeout(
      admin.rpc("has_membership", { p_user: user.id }),
      { data: null, error: { message: "timeout" } } as unknown as { data: boolean | null; error: unknown },
    );
    if (member === true) return json(200, { url: null, already_member: true });

    if (!customerId) {
      const customer = await stripeRequest<{ id: string }>(secretKey, "POST", "/customers", {
        email: user.email ?? undefined,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      const { error: upsertErr } = await withTimeout(
        admin.from("memberships").upsert(
          { user_id: user.id, stripe_customer_id: customerId, updated_at: new Date().toISOString() },
          { onConflict: "user_id" },
        ),
        { error: { message: "timeout" } } as { error: unknown },
      );
      if (upsertErr) console.error(JSON.stringify({ fn: "membership", stage: "customer_upsert", error: String((upsertErr as { message?: string })?.message ?? upsertErr).slice(0, 200) }));
    }

    // The webhook can lag a few seconds behind payment, so has_membership may
    // still say no right after a reader paid. Ask Stripe before opening a
    // second checkout: a double click must not become a double subscription.
    if (row?.stripe_customer_id) {
      const subs = await stripeRequest<{ data?: Array<{ status?: string }> }>(secretKey, "GET", "/subscriptions", {
        customer: customerId,
        status: "all",
        limit: 10,
      });
      if ((subs.data ?? []).some((s) => ENTITLING_STATUSES.has(s.status ?? ""))) {
        console.log(JSON.stringify({ fn: "membership", stage: "checkout", problem: "already_subscribed_webhook_pending" }));
        return json(200, { url: null, already_member: true });
      }
    }

    const automaticTax = Deno.env.get("STRIPE_AUTOMATIC_TAX") === "true";
    const session = await stripeRequest<{ url: string }>(secretKey, "POST", "/checkout/sessions", {
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { metadata: { user_id: user.id } },
      allow_promotion_codes: true,
      ...(automaticTax ? { automatic_tax: { enabled: true }, customer_update: { address: "auto" } } : {}),
      success_url: withParam(origin, path, "membership", "welcome"),
      cancel_url: withParam(origin, path, "membership", "cancelled"),
    });
    return json(200, { url: session.url });
  } catch (err) {
    const status = err instanceof StripeError ? err.status : 0;
    console.error(JSON.stringify({ fn: "membership", status, error: String((err as Error)?.message ?? err).slice(0, 300) }));
    return new Response(JSON.stringify({ error: "Couldn't reach the payment provider. Please try again." }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
