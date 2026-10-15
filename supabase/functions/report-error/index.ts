import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { raceRateLimitCount } from "../_shared/rate-limit.ts";
import { readJsonBodyBounded, PayloadTooLargeError } from "../_shared/body-limit.ts";
import { getClientIp } from "../_shared/client-ip.ts";
import { validateError } from "./sanitize.ts";

// Client error sink (MVP checklist B2). Anonymous, no user identifiers stored.
// Per-IP cap + per-(fingerprint, day) dedupe in the DB bound abuse and growth.
const ROUTE = "report-error";
const RATE_LIMIT = 30; // reports per hour per IP
const MAX_BODY_BYTES = 8_000;

async function hashIp(ip: string): Promise<string> {
  const salt = Deno.env.get("RATE_LIMIT_SALT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "fallback-salt";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ip));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const json = (cors: HeadersInit, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

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
      return json({ ...cors, "Retry-After": "900" }, 429, { error: "rate_limited" });
    }

    let body: unknown;
    try {
      body = await readJsonBodyBounded(req, MAX_BODY_BYTES);
    } catch (e) {
      if (e instanceof PayloadTooLargeError) return json(cors, 413, { error: "too_large" });
      return json(cors, 400, { error: "bad_request" });
    }
    const rec = validateError(body, req.headers.get("user-agent"));
    if (!rec) return json(cors, 400, { error: "invalid" });

    const [, ins] = await Promise.all([
      admin.from("rate_limit_events").insert({ ip_hash: ipHash, route: ROUTE, is_prefetch: false }),
      admin.rpc("record_client_error", rec),
    ]);
    if (ins.error) throw new Error(ins.error.message);
    return json(cors, 200, { ok: true });
  } catch (err) {
    console.error(JSON.stringify({ fn: ROUTE, error: String((err as Error)?.message ?? err).slice(0, 200) }));
    return json(cors, 500, { error: "server_error" });
  }
});
