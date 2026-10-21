// Unit tests for check-deploy-config.ts. Run: deno test --allow-read scripts/
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { findProblems, parseFunctionConfigs } from "./check-deploy-config.ts";

const TOML = `project_id = "x"
# comment
[functions.a]
verify_jwt = false   # trailing comment

[functions."b"]
verify_jwt = true

[functions.c]

[db]
verify_jwt = false
`;

Deno.test("parses function tables and verify_jwt values", () => {
  const c = parseFunctionConfigs(TOML);
  assertEquals(c.get("a")?.verifyJwt, false);
  assertEquals(c.get("b")?.verifyJwt, true);
  assertEquals(c.get("c")?.verifyJwt, undefined);
  assertEquals(c.has("db"), false);
});

Deno.test("passes when every function is configured with verify_jwt = false", () => {
  assertEquals(findProblems(["a"], parseFunctionConfigs("[functions.a]\nverify_jwt = false\n")), []);
});

Deno.test("flags missing, true, unset and orphaned entries", () => {
  const p = findProblems(["a", "b", "c", "d"], parseFunctionConfigs(TOML.replace("[functions.a]", "[functions.e]")));
  assertEquals(p.length, 5);
  assertEquals(p.filter((x) => x.startsWith("a:")).length, 1); // missing
  assertEquals(p.filter((x) => x.startsWith("b:")).length, 1); // true
  assertEquals(p.filter((x) => x.startsWith("c:")).length, 1); // unset
  assertEquals(p.filter((x) => x.startsWith("d:")).length, 1); // missing
  assertEquals(p.filter((x) => x.startsWith("e:")).length, 1); // orphan
});
