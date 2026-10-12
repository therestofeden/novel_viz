import { assertEquals } from "jsr:@std/assert@1";
import { validateBatch, cleanProps } from "./sanitize.ts";

Deno.test("rejects bad session id and empty batches", () => {
  assertEquals(validateBatch({ session_id: "x", events: [{ event: "signup" }] }), null);
  assertEquals(validateBatch({ session_id: "abcdefgh12", events: [] }), null);
  assertEquals(validateBatch(null), null);
});
Deno.test("drops unknown events, keeps allowed", () => {
  const r = validateBatch({ session_id: "abcdefgh12", events: [{ event: "evil" }, { event: "shelf_add", props: { slug: "dune" } }] });
  assertEquals(r?.length, 1);
  assertEquals(r?.[0].props, { slug: "dune" });
});
Deno.test("props: flat scalars only, capped", () => {
  const p = cleanProps({ a: { nested: 1 }, b: "x".repeat(500), c: 5, "bad key!": 1 });
  assertEquals(Object.keys(p).sort(), ["b", "c"]);
  assertEquals((p.b as string).length, 200);
});
Deno.test("rejects >20 events", () => {
  const events = Array.from({ length: 21 }, () => ({ event: "signup" }));
  assertEquals(validateBatch({ session_id: "abcdefgh12", events }), null);
});
