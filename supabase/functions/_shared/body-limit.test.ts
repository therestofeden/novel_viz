// Regression tests for body-limit.ts's readJsonBodyBounded — the bounded
// body reader that replaced the bare `req.json()` call in all 7 JSON-body
// edge functions (2026-09-18 daily backend audit; see the module's own
// top-of-file comment for the compute/memory-exhaustion DoS this closes).
//
// Run: deno test supabase/functions/_shared/
import { assertEquals, assertRejects } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { PayloadTooLargeError, readJsonBodyBounded } from "./body-limit.ts";

function reqWithBody(body: string, contentLength?: string | null): Request {
  const headers = new Headers();
  if (contentLength !== null) {
    headers.set("content-length", contentLength ?? String(new TextEncoder().encode(body).byteLength));
  }
  return new Request("https://example.com/fn", { method: "POST", headers, body });
}

// A Request whose declared Content-Length lies (too small) about the actual
// streamed byte count — simulates a client that sends a bad/missing header
// (or one that's been stripped/mangled in transit) to confirm the streaming
// cap is the real backstop, not just the header fast-path.
function reqWithMismatchedHeader(body: string, declaredLen: number): Request {
  const headers = new Headers({ "content-length": String(declaredLen) });
  return new Request("https://example.com/fn", { method: "POST", headers, body });
}

Deno.test("readJsonBodyBounded - parses a normal small JSON body", async () => {
  const req = reqWithBody(JSON.stringify({ title: "Moby-Dick", author: "Melville" }));
  const data = await readJsonBodyBounded(req, 10_000);
  assertEquals(data, { title: "Moby-Dick", author: "Melville" });
});

Deno.test("readJsonBodyBounded - rejects via Content-Length fast path without reading the body", async () => {
  const bigBody = JSON.stringify({ title: "x".repeat(5000) });
  const req = reqWithBody(bigBody);
  await assertRejects(
    () => readJsonBodyBounded(req, 100),
    PayloadTooLargeError,
  );
});

Deno.test("readJsonBodyBounded - rejects an oversized body even when Content-Length under-reports it", async () => {
  const bigBody = JSON.stringify({ title: "x".repeat(5000) });
  // Declares only 10 bytes but actually streams ~5KB — the header alone must
  // not be trusted, since it's exactly what an attacker controls.
  const req = reqWithMismatchedHeader(bigBody, 10);
  await assertRejects(
    () => readJsonBodyBounded(req, 100),
    PayloadTooLargeError,
  );
});

Deno.test("readJsonBodyBounded - accepts a body right at the byte cap", async () => {
  // {"a":"..."} with the value sized so the whole thing is exactly 50 bytes.
  const value = "x".repeat(50 - '{"a":""}'.length);
  const body = JSON.stringify({ a: value });
  assertEquals(new TextEncoder().encode(body).byteLength, 50);
  const req = reqWithBody(body);
  const data = await readJsonBodyBounded(req, 50);
  assertEquals(data, { a: value });
});

Deno.test("readJsonBodyBounded - rejects a body one byte over the cap", async () => {
  const value = "x".repeat(51 - '{"a":""}'.length);
  const body = JSON.stringify({ a: value });
  assertEquals(new TextEncoder().encode(body).byteLength, 51);
  const req = reqWithBody(body);
  await assertRejects(
    () => readJsonBodyBounded(req, 50),
    PayloadTooLargeError,
  );
});

Deno.test("readJsonBodyBounded - throws a SyntaxError for malformed JSON, same failure mode as req.json()", async () => {
  const req = reqWithBody("{not valid json");
  await assertRejects(
    () => readJsonBodyBounded(req, 10_000),
    SyntaxError,
  );
});

Deno.test("readJsonBodyBounded - throws (not silently returns {}) for an empty body, matching req.json()", async () => {
  const req = reqWithBody("");
  await assertRejects(() => readJsonBodyBounded(req, 10_000));
});
