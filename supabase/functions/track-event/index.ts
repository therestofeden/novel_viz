import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { raceRateLimitCount } from "../_shared/rate-limit.ts";
import { readJsonBodyBounded, PayloadTooLargeError } from "../_shared/body-limit.ts";
import { getClientIp } from "../_shared/client-ip.ts";
import { validateBatch } from "./sanitize.ts";

// First-party analytics sink (MVP checklist B1). Fire-and-forget from the client:
// always answers 204 on benign problems so tracking can never break the UI.
const ROUTE = "track-event";
const RATE_LIMIT = 300; // requests per hour per IP (batches of <=20 events)
const MAX_BODY_BYTES = 24_000;

async function hashIp(ip: string): Promise<string> {
  const salt = Deno.env.get("RATE_LIMIT_SALT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "fallback-salt";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ip));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(null, { status: 405, headers: cors });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ipHash = await hashIp(getClientIp(req));

    const count = await raceRateLimitCount(admin.rpc("count_recent_events", {
      p_ip_hash: ipHash, p_route: ROUTE, p_window_seconds: 3600, p_prefetch_only: false,
    }));
    if (typeof count === "number" && count >= RATE_LIMIT) {
      return new Response(null, { status: 429, headers: { ...cors, "Retry-After": "600" } });
    }

    let body: unknown;
    try {
      body = await readJsonBodyBounded(req, MAX_BODY_BYTES);
    } catch (e) {
      if (e instanceof PayloadTooLargeError) return new Response(null, { status: 413, headers: cors });
      return new Response(null, { status: 400, headers: cors });
    }
    const events = validateBatch(body);
    if (!events) return new Response(null, { status: 400, headers: cors });

    // Optional user attribution: only trust a JWT that Supabase Auth verifies.
    let userId: string | null = null;
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (token) {
      try {
        const { data } = await admin.auth.getUser(token);
        userId = data?.user?.id ?? null;
      } catch { /* anon key or invalid token -> anonymous */ }
    }

    await Promise.all([
      admin.from("rate_limit_events").insert({ ip_hash: ipHash, route: ROUTE, is_prefetch: false }),
      admin.from("app_events").insert(events.map((e) => ({ ...e, user_id: userId }))),
    ]);
    return new Response(null, { status: 204, headers: cors });
  } catch (err) {
    console.error(JSON.stringify({ fn: ROUTE, error: String((err as Error)?.message ?? err).slice(0, 200) }));
    return new Response(null, { status: 204, headers: cors });
  }
});
