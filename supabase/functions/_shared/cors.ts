// Shared CORS handling for all browser-facing edge functions. Consolidated
// 2026-07-09 (daily backend agent) — previously every function hardcoded
// `"Access-Control-Allow-Origin": "*"` (11 functions, byte-identical block
// each). This was flagged repeatedly across prior sessions as a deferred
// security gap: no session could confirm the actual production web origin,
// because the connected Vercel MCP connector is scoped to an unrelated
// project ("vita-life-assistant"), not this one ("novel-viz") — see project
// memory [[novelviz-vercel-deploy-gap]]. Initially (mis-)confirmed via
// first-party repo evidence — APP_STORE_SUBMISSION.md's Marketing/Support/
// Privacy URLs, Privacy.tsx's contact address, and capacitor.config.ts's
// appId all pointed at novelviz.app — but Stefano corrected this same day:
// the actual live production origin is the bare Vercel domain
// **https://novel-viz.vercel.app**, not (or not yet) novelviz.app. Keeping
// novelviz.app in the allowlist too (harmless — it's still a real,
// first-party-documented domain, likely a custom domain intended for the
// same deployment) but novel-viz.vercel.app is the one that matters. Lesson
// logged in project memory: repo-evidence domain inference (App Store
// metadata, privacy policy text) is not a substitute for confirming what's
// actually deployed — ask/verify before trusting it as ground truth for a
// change that can silently break prod if wrong.
//
// Design is intentionally FAIL-OPEN on the server side, not fail-closed: an
// unrecognized Origin gets NO Access-Control-Allow-Origin header (the
// browser then blocks page JS from reading the response — the standard,
// safe CORS-deny behavior), but the request is still processed normally
// and the unrecognized origin is logged. This is defense-in-depth against a
// third-party website silently burning this project's rate limits / Gemini
// budget via visitors' browsers (a real concern given this project's past
// cost incidents) — it is NOT a hard security boundary: these functions
// have no cookie-based session (Authorization is an explicit header, not a
// cookie) and the anon key is public in the client bundle anyway, so a
// non-browser client (curl, a server-side script) can trivially spoof the
// Origin header and bypass this entirely. RLS + rate limiting + the daily
// Gemini spend cap remain the real security/cost boundaries; this only
// raises the bar for the "embed on a random site, abuse via visitors'
// browsers" pattern.
//
// If this list is ever wrong (app moves domains, a new preview/staging
// origin needs testing), a real user's browser will simply reject reading
// the response — check edge logs for `cors: "origin_not_allowlisted"` to
// see the actual Origin that was sent, then add it below.

const ALLOWED_ORIGINS = new Set([
  // Confirmed by Stefano (2026-07-09) as the actual live production origin.
  "https://novel-viz.vercel.app",
  "https://novelviz.app",
  "https://www.novelviz.app",
  // Capacitor (iOS/Android) native WebView origins — appId com.novelviz.app.
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost", // some Capacitor Android configurations report this exact origin
  // Local dev (Vite default + common alternates).
  "http://localhost:5173",
  "http://localhost:8080",
  "http://localhost:3000",
]);

// Vercel preview deployments get a per-branch/per-commit subdomain
// (novel-viz-<hash>-<team>.vercel.app) that can't be enumerated statically —
// allow the whole pattern so preview/staging links keep working.
const VERCEL_PREVIEW_RE = /^https:\/\/novel-viz-[a-z0-9-]+\.vercel\.app$/;

const BASE_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Vary": "Origin",
};

/** Build per-request CORS headers, echoing the Origin only if it's recognized. */
export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  if (origin && (ALLOWED_ORIGINS.has(origin) || VERCEL_PREVIEW_RE.test(origin))) {
    return { ...BASE_HEADERS, "Access-Control-Allow-Origin": origin };
  }
  if (origin) {
    // Logged, not blocked at this layer — see module comment above for why
    // an unanticipated real origin should be diagnosable, not a silent dead end.
    console.warn(JSON.stringify({ cors: "origin_not_allowlisted", origin }));
  }
  return { ...BASE_HEADERS };
}
