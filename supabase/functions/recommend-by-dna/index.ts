// recommend-by-dna
// Takes a book's title/author/bookType and a DNA axes array (with user overrides
// already applied) and returns a single Recommendation from Gemini.
// Called by BookDNA.tsx whenever the user saves a perturbed DNA.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "gemini-2.5-flash-lite";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const MODEL_FALLBACKS = [MODEL, "gemini-2.5-flash", "gemini-3.5-flash"];

// ---------- Circuit breaker ----------
const CIRCUIT_OPEN_MS = 30_000;
const CIRCUIT_TRIP_AFTER = 1;
type CircuitState = { fails: number; openUntil: number };
const modelCircuit = new Map<string, CircuitState>();

function circuitIsOpen(model: string): boolean {
  const s = modelCircuit.get(model);
  if (!s) return false;
  if (Date.now() < s.openUntil) return true;
  modelCircuit.delete(model);
  return false;
}
function circuitRecordFail(model: string): void {
  const s = modelCircuit.get(model) ?? { fails: 0, openUntil: 0 };
  s.fails += 1;
  if (s.fails >= CIRCUIT_TRIP_AFTER) {
    s.openUntil = Date.now() + CIRCUIT_OPEN_MS;
  }
  modelCircuit.set(model, s);
}
function circuitRecordSuccess(model: string): void {
  modelCircuit.delete(model);
}

async function geminiFetchWithFallback(
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<Response> {
  let last: Response | null = null;
  for (const model of MODEL_FALLBACKS) {
    if (circuitIsOpen(model)) continue;
    const r = await fetch(GEMINI_BASE, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, model }),
    });
    if (r.ok) { circuitRecordSuccess(model); return r; }
    if (r.status !== 429 && r.status !== 503) return r;
    await r.body?.cancel().catch(() => {});
    last = r;
    circuitRecordFail(model);
  }
  return last!;
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
      additionalProperties: false,
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

  const { title, author, bookType, axes, gemini_key: userKey } = body ?? {};

  if (!title || !Array.isArray(axes) || axes.length === 0) {
    return new Response(JSON.stringify({ error: "title and axes are required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

  const res = await geminiFetchWithFallback(GEMINI_API_KEY, {
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

  return new Response(JSON.stringify({ recommendation }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
