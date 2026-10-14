import { assertEquals } from "jsr:@std/assert@1";
import { validateFeedback } from "./sanitize.ts";

Deno.test("rejects non-objects, missing or tiny messages", () => {
  assertEquals(validateFeedback(null), null);
  assertEquals(validateFeedback({}), null);
  assertEquals(validateFeedback({ message: "  ab " }), null);
  assertEquals(validateFeedback({ message: 42 }), null);
});
Deno.test("caps length, strips control chars, defaults safe", () => {
  const r = validateFeedback({ message: "hi\u0000 there" + "x".repeat(5000), page: "bad page!", kind: "evil", slug: "../x" });
  assertEquals(r?.message.length, 2000);
  assertEquals(r?.message.startsWith("hi there"), true);
  assertEquals(r?.page, "unknown");
  assertEquals(r?.kind, "general");
  assertEquals(r?.slug, null);
});
Deno.test("keeps valid fields", () => {
  const r = validateFeedback({ message: "Love it", page: "book", slug: "the-great-gatsby", kind: "praise", session_id: "abcdefgh12" });
  assertEquals(r, { message: "Love it", page: "book", slug: "the-great-gatsby", kind: "praise", session_id: "abcdefgh12" });
});
