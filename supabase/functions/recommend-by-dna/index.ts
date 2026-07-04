// recommend-by-dna
// Takes a book's title/author/bookType and a DNA axes array (with user overrides
// already applied) and returns a single Recommendation from Gemini.
// Called by BookDNA.tsx whenever the user saves a perturbed DNA.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { geminiFetchWithFallback, MODEL } from "../_shared/gemini.ts";

// ---------- Rate limiting ----------
const ROUTE = "recommend-by-dna";
const RATE_LIMIT = 30; // requests per hour per IP

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

async function hashIp(ip: string): Promise<string> {
  const salt =
    Deno.env.get("RATE_LIMIT_SALT") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    "fallback-salt";
  return sha256Hex(salt + ip);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ---------- DNA point cache ----------
// Every drag of a slider produces a slightly different axes vector, so exact-
// match caching would almost never hit. Round each axis to the nearest 5 and
// build a stable signature from it — coarse enough that repeat visits to
// "roughly the same point" (including the crowd-consensus point computed by
// dna-consensus) reuse a cached recommendation instead of re-calling Gemini,
// fine enough that a real slider move still produces a different match.
function buildAxesSignature(axes: Array<{ id: string; score: number }>): string {
  return axes
    .map((a) => ({ id: a.id, score: Math.round(a.score / 5) * 5 }))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((a) => `${a.id}:${a.score}`)
    .join("|");
}

function buildCacheKeyFallback(title: string, author?: string): string {
  const t = title.trim().toLowerCase().replace(/\s+/g, " ");
  const a = (author ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return `v3|${t}||${a}`;
}

// ---------- Tool ----------

const recommendationTool = {
  type: "function",
  function: {
    name: "render_dna_recommendation",
    description: "Return a single book recommendation whose DNA best matches the provided profile.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        author: { type: "string" },
        similarity: {
          type: "number",
          description: "0-100 estimated DNA similarity. Most good matches land 70-88.",
        },
        why: {
          type: "string",
          description: "1-2 sentences explaining why a fan of this DNA would love the recommendation.",
        },
        shared_axes: {
          type: "array",
          items: { type: "string" },
          description: "3-5 axis IDs where both books score within ~15 of each other.",
        },
        divergent_axes: {
          type: "array",
          items: { type: "string" },
          description: "1-3 axis IDs where the recommendation differs most — what makes it a fresh read.",
        },
      },
      required: ["title", "author", "similarity", "why", "shared_axes", "divergent_axes"],
      // additionalProperties: false — omitted: Gemini OpenAI-compat endpoint rejects this field with 400
    },
  },
};

// ---------- Handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (body?.is_warmup) return new Response("ok", { status: 200, headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { title, author, bookType, axes, cacheKey: rawCacheKey, gemini_key: userKey } = body ?? {};

  if (!title || !Array.isArray(axes) || axes.length === 0) {
    return new Response(JSON.stringify({ error: "title and axes are required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ---------- Input size caps ----------
  // title/author/bookType and axis labels get embedded into the Gemini
  // prompt. Without a cap, one request could smuggle an oversized payload
  // into a single prompt against the shared server key. Limits are generous
  // for any real book title or DNA axis set (the app never sends >~10 axes).
  const tooLong = (v: unknown, max: number) => typeof v === "string" && v.length > max;
  if (tooLong(title, 300) || tooLong(author, 200) || tooLong(bookType, 100)) {
    return new Response(JSON.stringify({ error: "One or more fields exceed the maximum allowed length" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (axes.length > 30 || axes.some((ax: any) => tooLong(ax?.id, 100))) {
    return new Response(JSON.stringify({ error: "Axes payload too large" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const cacheKey = typeof rawCacheKey === "string" && rawCacheKey.trim()
    ? rawCacheKey.trim()
    : buildCacheKeyFallback(title, author);
  const axesSignature = buildAxesSignature(axes as Array<{ id: string; score: number }>);

  // ---------- Cache-first: skip the rate-limit RPC AND Gemini entirely on a hit ----------
  // Slider drags are quantized (nearest 5), so this is the single highest-
  // frequency request in the app — most drags land on an already-seen point.
  // Checking the cache before the rate-limit round trip (which analyze-novel
  // already does, but this function didn't) means a cache hit costs exactly
  // one DB read instead of two, and never counts against a user's budget.
  const { data: cachedRec } = await admin
    .from("dna_recommendation_cache")
    .select("id, recommendation, hit_count")
    .eq("cache_key", cacheKey)
    .eq("axes_signature", axesSignature)
    .maybeSingle();

  if (cachedRec?.recommendation) {
    admin
      .from("dna_recommendation_cache")
      .update({ hit_count: (cachedRec.hit_count ?? 0) + 1, last_accessed_at: new Date().toISOString() })
      .eq("id", cachedRec.id)
      .then(() => {}, (e: any) => console.error("dna_recommendation_cache hit-bump error:", e));

    return new Response(JSON.stringify({ recommendation: cachedRec.recommendation, cached: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ---------- Rate-limit gate (only reached on a genuine cache miss) ----------
  const ip = getClientIp(req);
  const ipHash = await hashIp(ip);
  const { data: rlCount } = await admin.rpc("count_recent_events", {
    p_ip_hash: ipHash,
    p_route: ROUTE,
    p_window_seconds: 3600,
    p_prefetch_only: false,
  });
  if (typeof rlCount === "number" && rlCount >= RATE_LIMIT) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded. Please wait before requesting more DNA recommendations." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const GEMINI_API_KEY =
    typeof userKey === "string" && userKey.trim()
      ? userKey.trim()
      : Deno.env.get("GEMINI_API_KEY");

  if (!GEMINI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "No Gemini API key available. Add your key via the API Key button." }),
      { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const axesStr = (axes as Array<{ id: string; score: number }>)
    .map((a) => `  ${a.id}: ${Math.round(a.score)}/100`)
    .join("\n");

  const type = bookType === "nonfiction" ? "non-fiction" : "fiction";

  const systemPrompt = `You are a literary scholar and expert book recommender covering both fiction and non-fiction. Given a book's 12-axis DNA profile, recommend ONE different book (different author if possible) from the literary canon whose DNA best matches. The recommendation must be a real, verifiable book.`;

  const userPrompt = `Book: "${title}"${author ? ` by ${author}` : ""} (${type})

DNA profile (0 = low pole, 100 = high pole):
${axesStr}

Recommend the single best DNA neighbour from the canon.`;

  const res = await geminiFetchWithFallback(admin, GEMINI_API_KEY, {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    tools: [recommendationTool],
    tool_choice: { type: "function", function: { name: "render_dna_recommendation" } },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Gemini error", res.status, text);
    return new Response(JSON.stringify({ error: `AI error ${res.status}` }), {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const data = await res.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    return new Response(JSON.stringify({ error: "AI returned no recommendation" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let recommendation: unknown;
  try {
    recommendation = JSON.parse(toolCall.function.arguments);
  } catch {
    return new Response(JSON.stringify({ error: "Malformed AI output" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Log rate event (fire-and-forget; don't block the response)
  admin
    .from("rate_limit_events")
    .insert({ ip_hash: ipHash, route: ROUTE, is_prefetch: false })
    .then(() => {});

  // Write-through: the NEXT visitor (or the consensus recompute) who lands on
  // this exact quantized DNA point for this book skips Gemini entirely.
  // ignoreDuplicates — a race between two callers hitting the same new point
  // silently no-ops on the loser; both already have their own result in hand.
  admin
    .from("dna_recommendation_cache")
    .upsert(
      { cache_key: cacheKey, axes_signature: axesSignature, recommendation, model: MODEL },
      { onConflict: "cache_key,axes_signature", ignoreDuplicates: true },
    )
    .then(() => {}, (e: any) => console.error("dna_recommendation_cache write error:", e));

  return new Response(JSON.stringify({ recommendation, cached: false }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
