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
        const { data } = await withTimeout(admin.auth.getUser(token), { data: { user: null }, error: null } as unknown as Awaited<ReturnType<typeof admin.auth.getUser>>);
        userId = data?.user?.id ?? null;
      } catch { /* anon key or invalid token -> anonymous */ }
    }

    await Promise.all([
      withTimeout(admin.from("rate_limit_events").insert({ ip_hash: ipHash, route: ROUTE, is_prefetch: false }), TIMED_OUT),
      withTimeout(admin.from("app_events").insert(events.map((e) => ({ ...e, user_id: userId }))), TIMED_OUT),
    ]);
    return new Response(null, { status: 204, headers: cors });
  } catch (err) {
    console.error(JSON.stringify({ fn: ROUTE, error: String((err as Error)?.message ?? err).slice(0, 200) }));
    return new Response(null, { status: 204, headers: cors });
  }
});
