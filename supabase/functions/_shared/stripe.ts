// Minimal Stripe client for the membership functions (2026-11-18).
//
// Plain fetch against the REST API instead of the stripe npm package: two
// endpoints' worth of calls doesn't justify a large dependency in every cold
// start, and the webhook signature check is a few lines of Web Crypto.
// Every call carries an AbortSignal timeout so a slow Stripe can't hang an
// edge function.

const STRIPE_API = "https://api.stripe.com/v1";
const STRIPE_TIMEOUT_MS = 8000;
/** Stripe's own libraries default to a 300 s tolerance for replayed events. */
export const SIGNATURE_TOLERANCE_S = 300;

export class StripeError extends Error {
  constructor(public status: number, public stripeCode: string | undefined, message: string) {
    super(message);
    this.name = "StripeError";
  }
}

type FormValue = string | number | boolean | null | undefined | FormObject | FormValue[];
interface FormObject { [k: string]: FormValue }

/** Stripe's bracketed form encoding: {a: {b: [1]}} -> "a[b][0]=1". */
export function formEncode(obj: FormObject, prefix = ""): string {
  const parts: string[] = [];
  const add = (key: string, v: FormValue) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) {
      v.forEach((item, i) => add(`${key}[${i}]`, item));
    } else if (typeof v === "object") {
      for (const [k, inner] of Object.entries(v)) add(`${key}[${k}]`, inner);
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  };
  for (const [k, v] of Object.entries(obj)) add(prefix ? `${prefix}[${k}]` : k, v);
  return parts.join("&");
}

export async function stripeRequest<T = Record<string, unknown>>(
  secretKey: string,
  method: "GET" | "POST",
  path: string,
  params?: FormObject,
): Promise<T> {
  const body = params ? formEncode(params) : "";
  const url = method === "GET" && body ? `${STRIPE_API}${path}?${body}` : `${STRIPE_API}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: method === "POST" ? body : undefined,
    signal: AbortSignal.timeout(STRIPE_TIMEOUT_MS),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (json as { error?: { code?: string; message?: string } }).error;
    throw new StripeError(res.status, err?.code, err?.message ?? `stripe ${res.status}`);
  }
  return json as T;
}

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signPayload(secret: string, timestamp: number, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`));
  return hex(sig);
}

/**
 * Verifies a `Stripe-Signature` header (t=<unix>,v1=<hex>[,v1=...]) against
 * the raw request body, as Stripe documents for webhook endpoints.
 */
export async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = SIGNATURE_TOLERANCE_S,
): Promise<boolean> {
  if (!header || !secret) return false;
  let timestamp = NaN;
  const candidates: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.trim().split("=", 2);
    if (k === "t") timestamp = Number(v);
    else if (k === "v1" && v) candidates.push(v);
  }
  if (!Number.isFinite(timestamp) || candidates.length === 0) return false;
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;
  const expected = await signPayload(secret, timestamp, payload);
  return candidates.some((c) => timingSafeEqualHex(c, expected));
}

export type StripeSubscription = {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end?: boolean;
  current_period_end?: number;
  metadata?: Record<string, string>;
  items?: { data?: Array<{ current_period_end?: number; price?: { id?: string } }> };
};

/** Flattens a subscription into the columns public.memberships stores. */
export function membershipColumns(sub: StripeSubscription) {
  const item = sub.items?.data?.[0];
  // Newer API versions moved current_period_end from the subscription to its items.
  const periodEnd = sub.current_period_end ?? item?.current_period_end;
  return {
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : null,
    stripe_subscription_id: sub.id,
    status: sub.status,
    price_id: item?.price?.id ?? null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  };
}

/** Subscription statuses that grant (or briefly keep) membership; mirrors has_membership(). */
export const ENTITLING_STATUSES = new Set(["active", "trialing", "past_due"]);

/**
 * memberships has one row per reader, but a reader can end up with two Stripe
 * subscriptions (two checkout tabs, a retry after a declined card). Events for
 * the dead one must not overwrite the live one, or a paying reader loses
 * access when the duplicate is cancelled or expires. Rule: a non-entitling
 * subscription never replaces a row that points at a *different*,
 * still-entitling subscription. Same subscription, or an entitling one, wins.
 */
export function shouldApplySubscription(
  existing: { stripe_subscription_id?: string | null; status?: string | null } | null | undefined,
  incoming: { id: string; status: string },
): boolean {
  if (!existing?.stripe_subscription_id) return true;
  if (existing.stripe_subscription_id === incoming.id) return true;
  if (ENTITLING_STATUSES.has(incoming.status)) return true;
  return !ENTITLING_STATUSES.has(existing.status ?? "");
}
