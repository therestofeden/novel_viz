import { assertEquals } from "jsr:@std/assert@1";
import { scrub, validateError } from "./sanitize.ts";

Deno.test("scrub strips query strings, emails and tokens", () => {
  const s = scrub("fail at https://x.app/a?token=abc#h by me@x.com key " + "a".repeat(40), 500);
  assertEquals(s.includes("token=abc"), false);
  assertEquals(s.includes("me@x.com"), false);
  assertEquals(s.includes("[token]"), true);
});
Deno.test("validateError rejects bad source/fingerprint", () => {
  assertEquals(validateError({ message: "m", fingerprint: "zz", source: "window" }, null), null);
  assertEquals(validateError({ message: "m", fingerprint: "abcdef12", source: "evil" }, null), null);
  assertEquals(validateError(null, null), null);
});
Deno.test("validateError accepts and caps", () => {
  const r = validateError({ message: "word ".repeat(200), // not "x".repeat: a 32+ char run is scrubbed as a token
     fingerprint: "ABCDEF1234", source: "boundary", page: "bad page!" }, "UA");
  assertEquals(r?.p_message.length, 500);
  assertEquals(r?.p_page, "unknown");
  assertEquals(r?.p_fingerprint, "abcdef1234");
});
