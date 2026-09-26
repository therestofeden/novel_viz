// Unit tests for check-body-limit-guards.ts's findViolationLines heuristic.
// Run: deno test --allow-read scripts/
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { findViolationLines } from "./check-body-limit-guards.ts";

function lines(text: string): string[] {
  return text.split("\n");
}

Deno.test("flags a bare req.json() call in a request handler", () => {
  const src = lines(`
Deno.serve(async (req) => {
  const body = await req.json();
  return new Response(JSON.stringify(body));
});
`);
  assertEquals(findViolationLines(src), [2]);
});

Deno.test("does not flag a request read wrapped in readJsonBodyBounded", () => {
  const src = lines(`
Deno.serve(async (req) => {
  const body = await readJsonBodyBounded(req, MAX_BODY_BYTES);
  return new Response(JSON.stringify(body));
});
`);
  assertEquals(findViolationLines(src), []);
});

Deno.test("does not flag .json()/.text() called on an outbound fetch response, not the request param", () => {
  const src = lines(`
Deno.serve(async (req) => {
  const body = await readJsonBodyBounded(req, MAX_BODY_BYTES);
  const geminiRes = await fetch(GEMINI_URL);
  const data = await geminiRes.json();
  const errText = await geminiRes.text().catch(() => "");
  return new Response(JSON.stringify(data));
});
`);
  assertEquals(findViolationLines(src), []);
});

Deno.test("respects the body-limit-ignore escape hatch", () => {
  const src = lines(`
Deno.serve(async (req) => {
  // body-limit-ignore: GET-only route, no body expected, req.json() only
  // hit on a malformed client that we want to fail fast and cheap on
  const body = await req.json();
  return new Response("ok");
});
`);
  assertEquals(findViolationLines(src), []);
});

Deno.test("returns no violations for a file with no Deno.serve/serve handler", () => {
  const src = lines(`
export function helper(req: Request) {
  return req.json();
}
`);
  assertEquals(findViolationLines(src), []);
});

Deno.test("flags req.text()/req.arrayBuffer()/req.blob()/req.formData() the same way as req.json()", () => {
  const src = lines(`
Deno.serve(async (req) => {
  if (Math.random() > 2) {
    const a = await req.text();
    const b = await req.arrayBuffer();
    const c = await req.blob();
    const d = await req.formData();
  }
  return new Response("ok");
});
`);
  assertEquals(findViolationLines(src), [3, 4, 5, 6]);
});

Deno.test("handles a typed request parameter (req: Request)", () => {
  const src = lines(`
Deno.serve(async (req: Request) => {
  const body = await req.json();
  return new Response("ok");
});
`);
  assertEquals(findViolationLines(src), [2]);
});

Deno.test("uses whichever identifier the handler actually binds, e.g. request instead of req", () => {
  const src = lines(`
serve(async (request) => {
  const body = await request.json();
  return new Response("ok");
});
`);
  assertEquals(findViolationLines(src), [2]);
});

Deno.test("a distant, unrelated req.json() several lines below the ignore comment is still flagged", () => {
  const src = lines(`
Deno.serve(async (req) => {
  // body-limit-ignore: this comment only covers the very next line
  const other = 1;
  const body = await req.json();
  return new Response("ok");
});
`);
  assertEquals(findViolationLines(src), [4]);
});
