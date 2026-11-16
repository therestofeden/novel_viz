import { assertEquals, assertMatch, assertNotEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { hashCacheKey } from "./cache-key.ts";

Deno.test("hashCacheKey is deterministic 64-char hex", async () => {
  const a = await hashCacheKey("search", "dune", "p");
  assertEquals(a, await hashCacheKey("search", "dune", "p"));
  assertMatch(a, /^[0-9a-f]{64}$/);
});

Deno.test("hashCacheKey does not contain the plaintext and depends on pepper/namespace", async () => {
  const a = await hashCacheKey("search", "dune", "p1");
  assertEquals(a.includes("dune"), false);
  assertNotEquals(a, await hashCacheKey("search", "dune", "p2"));
  assertNotEquals(a, await hashCacheKey("dna", "dune", "p1"));
});
