// Unit tests for check-error-leak-guards.ts's findViolationLines heuristic.
// Run: deno test --allow-read scripts/
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { findViolationLines } from "./check-error-leak-guards.ts";

function lines(text: string): string[] {
  return text.split("\n");
}

Deno.test("flags a bare e.message sent to the client with no .status guard", () => {
  const src = lines(`
try {
  doWork();
} catch (e) {
  send("error", { error: e.message });
}
`);
  assertEquals(findViolationLines(src), [4]);
});

Deno.test("flags String(err) returned to the client with no .status guard", () => {
  const src = lines(`
try {
  doWork();
} catch (err) {
  return new Response(JSON.stringify({ error: String(err) }));
}
`);
  assertEquals(findViolationLines(src), [4]);
});

Deno.test("does not flag e.message/String(e) inside a console.error/log/warn/info call", () => {
  const src = lines(`
try {
  doWork();
} catch (err) {
  console.error(JSON.stringify({ fn: "x", error: err instanceof Error ? err.message : String(err) }));
  return new Response(JSON.stringify({ error: "Unexpected server error" }));
}
`);
  assertEquals(findViolationLines(src), []);
});

Deno.test("does not flag e.message gated behind a nearby .status curated-failure check", () => {
  const src = lines(`
try {
  doWork();
} catch (e: any) {
  const isCuratedFailure = typeof e?.status === "number";
  const message = isCuratedFailure ? e.message : "Unexpected server error";
  return new Response(JSON.stringify({ error: message }));
}
`);
  assertEquals(findViolationLines(src), []);
});

Deno.test("does not flag e.message when .status appears several lines away but within WINDOW", () => {
  const src = lines(`
try {
  doWork();
} catch (e: any) {
  const isCuratedFailure = typeof e?.status === "number";
  console.error("stream error:", e);
  send("error", { error: isCuratedFailure ? e.message : "Unexpected server error" });
}
`);
  assertEquals(findViolationLines(src), []);
});

Deno.test("does not flag e.message gated behind a nearby PayloadTooLargeError instanceof check", () => {
  const src = lines(`
try {
  body = await readJsonBodyBounded(req, MAX_BODY_BYTES);
} catch (e) {
  if (e instanceof PayloadTooLargeError) {
    return new Response(JSON.stringify({ error: e.message }), { status: 413 });
  }
  body = {};
}
`);
  assertEquals(findViolationLines(src), []);
});

Deno.test("recognizes a console.error(...) call split across multiple lines", () => {
  const src = lines(`
try {
  doWork();
} catch (err) {
  console.error(JSON.stringify({
    fn: "x",
    stage: "y",
    error: err instanceof Error ? err.message : String(err),
  }));
  return new Response(JSON.stringify({ error: "Temporary server error." }));
}
`);
  assertEquals(findViolationLines(src), []);
});

Deno.test("does not confuse a .catch((e) => ...) promise handler with a catch (e) clause", () => {
  const src = lines(`
somePromise
  .catch((e: unknown) => console.error("background write error:", e));
send("done", {});
`);
  assertEquals(findViolationLines(src), []);
});

Deno.test("respects the error-leak-ignore escape hatch", () => {
  const src = lines(`
try {
  doWork();
} catch (e: any) {
  // error-leak-ignore: message is a fixed constant string set above, never raw
  send("error", { error: e.message });
}
`);
  assertEquals(findViolationLines(src), []);
});

Deno.test("a distant, unrelated catch far above (outside CATCH_LOOKBACK) does not leak scope", () => {
  const before = Array.from({ length: 45 }, (_, i) => `// filler line ${i}`);
  const src = [
    "try {",
    "  doWork();",
    "} catch (e) {",
    ...before,
    '  send("error", { error: e.message });',
    "}",
  ];
  assertEquals(findViolationLines(src), []);
});

Deno.test("flags both e.message and String(e) on separate unguarded lines", () => {
  const src = lines(`
try {
  doWork();
} catch (e: any) {
  logSomewhereElse(e.message);
  auditTrail(String(e));
}
`);
  assertEquals(findViolationLines(src), [4, 5]);
});
