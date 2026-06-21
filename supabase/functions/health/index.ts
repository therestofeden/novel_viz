// Lightweight health check endpoint.
// Returns DB reachability and whether the server Gemini key is configured.
// Responds 200 when healthy, 503 when degraded — safe to use as an uptime monitor target.
// Circuit breaker state lives in each function's isolate memory so can't be read from here;
// instead this endpoint is the thing a monitor should hit to confirm the stack is alive.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // DB ping — cheapest possible read.
  let db: "ok" | "error" = "ok";
  let dbLatencyMs: number | null = null;
  try {
    const t0 = Date.now();
    const { error } = await supabase.from("novel_analyses").select("id").limit(1);
    dbLatencyMs = Date.now() - t0;
    if (error) db = "error";
  } catch {
    db = "error";
  }

  const geminiKeyConfigured = !!Deno.env.get("GEMINI_API_KEY");
  const status = db === "ok" ? "ok" : "degraded";

  return new Response(
    JSON.stringify({
      status,
      db,
      db_latency_ms: dbLatencyMs,
      gemini_key_configured: geminiKeyConfigured,
      ts: new Date().toISOString(),
    }),
    {
      status: status === "ok" ? 200 : 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
