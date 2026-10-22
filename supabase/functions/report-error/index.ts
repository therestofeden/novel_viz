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

// DB timeout guard (added 2026-10-22, daily_backend): every awaited Supabase
// call here must fail fast instead of hanging the request on a stalled
// Postgres/GoTrue connection. Same fail-open shape as the per-file helpers in
// analyze-novel/takeaways (not shared by design). Caught by
// scripts/check-timeout-guards.ts, which had kept CI red since 2026-10-18.
const DB_TIMEOUT_MS = 4000;
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

// safety-net-ignore: outer try/catch wraps the whole body and returns a CORS-headed response via `cors`/json(cors, 500, ...) (track-event deliberately answers 204 so analytics never breaks the UI); the checker only recognises the literal corsHeaders/new Response shape.
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
      withTimeout(admin.from("rate_limit_events").insert({ ip_hash: ipHash, route: ROUTE, is_prefetch: false }), TIMED_OUT),
      withTimeout(admin.rpc("record_client_error", rec), TIMED_OUT),
    ]);
    if (ins.error) throw new Error(ins.error.message);
    return json(cors, 200, { ok: true });
  } catch (err) {
    console.error(JSON.stringify({ fn: ROUTE, error: String((err as Error)?.message ?? err).slice(0, 200) }));
    return json(cors, 500, { error: "server_error" });
  }
});
