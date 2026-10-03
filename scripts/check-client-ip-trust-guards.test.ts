// Unit tests for check-client-ip-trust-guards.ts's findViolationLines
// heuristic. Run: deno test --allow-read scripts/
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { findViolationLines } from "./check-client-ip-trust-guards.ts";

function lines(text: string): string[] {
  return text.split("\n");
}

Deno.test("flags a direct x-forwarded-for read outside the shared helper", () => {
  const src = lines(`
function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
}
`);
  assertEquals(findViolationLines(src), [2]);
});

Deno.test("flags a direct x-real-ip read outside the shared helper", () => {
  const src = lines(`
const ip = req.headers.get("x-real-ip") ?? "unknown";
`);
  assertEquals(findViolationLines(src), [1]);
});

Deno.test("flags both headers when both appear on separate lines", () => {
  const src = lines(`
const a = req.headers.get("x-forwarded-for");
const b = req.headers.get("x-real-ip");
`);
  assertEquals(findViolationLines(src), [1, 2]);
});

Deno.test("is case-insensitive on the header literal", () => {
  const src = lines(`
const a = req.headers.get("X-Forwarded-For");
`);
  assertEquals(findViolationLines(src), [1]);
});

Deno.test("does not flag a call to the shared getClientIp() helper", () => {
  const src = lines(`
import { getClientIp } from "../_shared/client-ip.ts";
const ip = getClientIp(req);
`);
  assertEquals(findViolationLines(src), []);
});

Deno.test("does not flag a header literal inside a comment", () => {
  const src = lines(`
// Previously read "x-forwarded-for" directly here; now uses getClientIp().
const ip = getClientIp(req);
`);
  assertEquals(findViolationLines(src), []);
});

Deno.test("respects the client-ip-trust-ignore escape hatch", () => {
  const src = lines(`
// client-ip-trust-ignore: diagnostic logging only, never used for rate-limit keying
console.log("raw xff for debugging:", req.headers.get("x-forwarded-for"));
`);
  assertEquals(findViolationLines(src), []);
});
