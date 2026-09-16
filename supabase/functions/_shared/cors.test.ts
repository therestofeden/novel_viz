// Regression tests for cors.ts's origin allowlist logic.
//
// Added 2026-09-16 (daily backend audit). This file has been hand-edited
// repeatedly since 2026-07-09 (production domain correction, Vercel preview
// regex, Capacitor origins) with zero automated coverage — every change was
// verified by eyeballing the diff or checking prod logs after deploy. A
// typo in ALLOWED_ORIGINS or a regex slip in VERCEL_PREVIEW_RE fails silent
// and CORS-shaped (the browser just blocks reading the response with no
// server-side error), which is exactly the kind of bug that's expensive to
// notice in prod and cheap to catch here.
//
// Run: deno test supabase/functions/_shared/
import { assertEquals, assertMatch } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { buildCorsHeaders } from "./cors.ts";

function reqWithOrigin(origin: string | null): Request {
  const headers = new Headers();
  if (origin !== null) headers.set("origin", origin);
  return new Request("https://example.com/fn", { headers });
}

Deno.test("buildCorsHeaders - allows the confirmed production origin", () => {
  const headers = buildCorsHeaders(reqWithOrigin("https://novel-viz.vercel.app"));
  assertEquals(headers["Access-Control-Allow-Origin"], "https://novel-viz.vercel.app");
});

Deno.test("buildCorsHeaders - allows the custom domain + www variant", () => {
  assertEquals(
    buildCorsHeaders(reqWithOrigin("https://novelviz.app"))["Access-Control-Allow-Origin"],
    "https://novelviz.app",
  );
  assertEquals(
    buildCorsHeaders(reqWithOrigin("https://www.novelviz.app"))["Access-Control-Allow-Origin"],
    "https://www.novelviz.app",
  );
});

Deno.test("buildCorsHeaders - allows Capacitor/Ionic native WebView origins", () => {
  for (const origin of ["capacitor://localhost", "ionic://localhost", "http://localhost"]) {
    assertEquals(buildCorsHeaders(reqWithOrigin(origin))["Access-Control-Allow-Origin"], origin);
  }
});

Deno.test("buildCorsHeaders - allows local Vite dev ports", () => {
  for (const origin of ["http://localhost:5173", "http://localhost:8080", "http://localhost:3000"]) {
    assertEquals(buildCorsHeaders(reqWithOrigin(origin))["Access-Control-Allow-Origin"], origin);
  }
});

Deno.test("buildCorsHeaders - allows a well-formed Vercel preview subdomain", () => {
  const origin = "https://novel-viz-a1b2c3d4-therestofeden.vercel.app";
  assertEquals(buildCorsHeaders(reqWithOrigin(origin))["Access-Control-Allow-Origin"], origin);
});

Deno.test("buildCorsHeaders - rejects a look-alike domain (no Access-Control-Allow-Origin header)", () => {
  // Guards against a regex/allowlist regression that's too permissive — e.g.
  // a naive .endsWith("vercel.app") check would let ANY Vercel project
  // (including an attacker's) read responses via CORS.
  for (const origin of [
    "https://novel-viz.vercel.app.evil.com",
    "https://evil-novel-viz.vercel.app",
    "https://novelviz.app.evil.com",
    "http://novel-viz.vercel.app", // http, not https
  ]) {
    const headers = buildCorsHeaders(reqWithOrigin(origin));
    assertEquals(headers["Access-Control-Allow-Origin"], undefined, `should reject ${origin}`);
  }
});

Deno.test("buildCorsHeaders - no Origin header still returns base headers, no ACAO", () => {
  const headers = buildCorsHeaders(reqWithOrigin(null));
  assertEquals(headers["Access-Control-Allow-Origin"], undefined);
  assertEquals(headers["Vary"], "Origin");
});

Deno.test("buildCorsHeaders - always sets Vary: Origin (cache correctness)", () => {
  // Without this, a CDN/browser cache could serve one origin's CORS-headered
  // response to a different origin's request.
  assertEquals(buildCorsHeaders(reqWithOrigin("https://novel-viz.vercel.app"))["Vary"], "Origin");
  assertEquals(buildCorsHeaders(reqWithOrigin(null))["Vary"], "Origin");
});

Deno.test("buildCorsHeaders - Access-Control-Allow-Headers covers the Supabase client headers", () => {
  const headers = buildCorsHeaders(reqWithOrigin(null));
  assertMatch(headers["Access-Control-Allow-Headers"], /authorization/);
  assertMatch(headers["Access-Control-Allow-Headers"], /apikey/);
});
