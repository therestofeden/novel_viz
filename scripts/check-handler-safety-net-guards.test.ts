// Unit tests for check-handler-safety-net-guards.ts's findHandlerFindings heuristic.
// Run: deno test --allow-read scripts/
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { findHandlerFindings } from "./check-handler-safety-net-guards.ts";

function lines(text: string): string[] {
  return text.split("\n");
}

Deno.test("flags a handler with no top-level try/catch at all", () => {
  const src = lines(`
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const secret = req.headers.get("x-secret") ?? "";
  if (secret !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await doWork();

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
`);
  const findings = findHandlerFindings(src);
  assertEquals(findings.length, 1);
  assertEquals(findings[0].reason, "no top-level try/catch found in this handler");
});

Deno.test("flags a handler whose only try/catch guards just the body-parse step", () => {
  const src = lines(`
Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let body;
  try {
    body = await readJsonBodyBounded(req, 1000);
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { phase } = body ?? {};
  if (phase === "questions") {
    await doQuestionsWork();
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (phase === "synthesize") {
    await doSynthesisWork();
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "unknown phase" }), {
    status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
`);
  const findings = findHandlerFindings(src);
  assertEquals(findings.length, 1);
  assertEquals(findings[0].reason.includes("looks like it guards a narrow"), true);
});

Deno.test("does not flag a handler with a full-body try/catch wrap (nested body-parse try included)", () => {
  const src = lines(`
Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {

  let body;
  try {
    body = await readJsonBodyBounded(req, 1000);
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { phase } = body ?? {};
  if (phase === "questions") {
    await doQuestionsWork();
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "unknown phase" }), {
    status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
  } catch (err) {
    console.error(JSON.stringify({ fn: "example", error: String(err) }));
    return new Response(JSON.stringify({ error: "Unexpected server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
`);
  assertEquals(findHandlerFindings(src), []);
});

Deno.test("does not flag an auth-check-first handler whose single try/catch spans nearly the whole body", () => {
  const src = lines(`
Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Sign in required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await doWork();

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(JSON.stringify({ fn: "example", error: String(err) }));
    return new Response(JSON.stringify({ error: "Unexpected server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
`);
  assertEquals(findHandlerFindings(src), []);
});

Deno.test("flags a catch block that returns a Response but omits corsHeaders", () => {
  const src = lines(`
Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await doStepOne();
    await doStepTwo();
    await doStepThree();
    await doStepFour();
    await doWork();
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Unexpected server error" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
`);
  const findings = findHandlerFindings(src);
  assertEquals(findings.length, 1);
  assertEquals(findings[0].reason, "outer catch block's response doesn't reference corsHeaders");
});

Deno.test("respects the safety-net-ignore escape hatch", () => {
  const src = lines(`
// safety-net-ignore: every check below is independently try/catch-guarded
// and the final response only serializes already-safe primitives.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let db = "ok";
  try {
    await checkDb();
  } catch {
    db = "error";
  }

  return new Response(JSON.stringify({ db }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
`);
  assertEquals(findHandlerFindings(src), []);
});

Deno.test("does not flag a nested try inside an inner arrow function as a top-level guard", () => {
  const src = lines(`
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const secret = req.headers.get("x-secret") ?? "";
  if (!secretsMatch(secret, expected)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results = {};
  const runPurge = async (key, rpcName) => {
    try {
      results[key] = await supabase.rpc(rpcName);
    } catch (e) {
      results[key] = "error";
    }
  };

  await runPurge("a", "purge_a");

  return new Response(JSON.stringify({ ok: true, ...results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
`);
  const findings = findHandlerFindings(src);
  assertEquals(findings.length, 1);
  assertEquals(findings[0].reason, "no top-level try/catch found in this handler");
});
