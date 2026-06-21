import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// gemini-2.0-* models were shut down by Google on 2026-06-01;
// gemini-2.5-flash was constantly 503 (overloaded) as of 2026-06-10.
const MODEL = "gemini-3.5-flash";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

// Google is load-shedding aggressively since the 2.0 shutdown (intermittent
// 503 UNAVAILABLE / 429). Retry each model briefly, then fall back down the chain.
const MODEL_FALLBACKS = [MODEL, "gemini-2.5-flash", "gemini-2.5-flash-lite"];

// ---------- Circuit breaker ----------
const CIRCUIT_OPEN_MS = 60_000;
const CIRCUIT_TRIP_AFTER = 2;
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
    console.warn(JSON.stringify({ circuit: "open", model, until: new Date(s.openUntil).toISOString() }));
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
    if (circuitIsOpen(model)) {
      console.log(JSON.stringify({ circuit: "skipped", model }));
      continue;
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await fetch(GEMINI_BASE, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, model }),
      });
      if (r.ok) {
        circuitRecordSuccess(model);
        return r;
      }
      if (r.status !== 429 && r.status !== 503) return r; // hard error — retrying won't help
      console.warn(`gemini ${model} attempt ${attempt + 1} -> ${r.status}`);
      await r.body?.cancel().catch(() => {});
      last = r;
      circuitRecordFail(model);
      if (circuitIsOpen(model)) break; // tripped — jump to next model immediately
      const base = 1000 * (attempt + 1);
      await new Promise((res) => setTimeout(res, base + Math.random() * 500));
    }
  }
  return last!;
}

// ─── SSE helpers ──────────────────────────────────────────────────────────────

function sseFrame(event: string, data: unknown): Uint8Array {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  return new TextEncoder().encode(payload);
}

// ─── Phase A: generate questions ─────────────────────────────────────────────

const questionsTool = {
  type: "function",
  function: {
    name: "render_takeaway_questions",
    description: "Return 4–5 thoughtful, book-specific questions to prompt a reader's reflection and help surface their genuine understanding and personal takeaways.",
    parameters: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          minItems: 4,
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              question: { type: "string" },
            },
            required: ["id", "question"],
            additionalProperties: false,
          },
        },
      },
      required: ["questions"],
      additionalProperties: false,
    },
  },
};

const QUESTIONS_SYSTEM = `You are a skilled reading coach and intellectual guide. Your task is to generate deeply personalised reflection questions that will help a reader articulate what they truly understood and took away from a book.

Rules for great questions:
- Make each question SPECIFIC to THIS book — generic questions like "What did you learn?" are forbidden.
- Mix four dimensions: conceptual (did they grasp the core ideas?), critical (do they agree / disagree?), personal (how does it connect to their life?), and action-oriented (what will they actually do or change?).
- For non-fiction: focus on the central argument, surprising evidence, mental models, and practical application.
- For fiction: focus on themes, character arcs, emotional resonance, and what the story reveals about the human condition.
- Write questions in the second person ("What was your reaction to...") so they feel like a conversation.
- Each question should be 1–2 sentences. Avoid compound questions (two questions in one).
- Order from concrete → abstract: start with a grounded recall question, end with a big-picture or action question.`;

async function generateQuestions(
  apiKey: string,
  title: string,
  author: string,
  bookType: string,
  summary: string,
  thesis?: string,
): Promise<Array<{ id: string; question: string }> | null> {
  const bookDesc = bookType === "nonfiction"
    ? `The non-fiction book "${title}" by ${author}.\n\nSummary: ${summary}\n\nCentral thesis: ${thesis ?? "(not provided)"}`
    : `The novel "${title}" by ${author}.\n\nSummary: ${summary}`;

  const response = await geminiFetchWithFallback(apiKey, {
    messages: [
      { role: "system", content: QUESTIONS_SYSTEM },
      { role: "user", content: `Generate reflection questions for:\n\n${bookDesc}` },
    ],
    tools: [questionsTool],
    tool_choice: { type: "function", function: { name: "render_takeaway_questions" } },
  });

  if (!response.ok) {
    const err: any = new Error(`AI gateway error ${response.status}`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) return null;

  try {
    const raw = JSON.parse(toolCall.function.arguments);
    return Array.isArray(raw.questions) ? raw.questions : null;
  } catch {
    return null;
  }
}

// ─── Phase B: synthesize takeaways (streaming) ───────────────────────────────

const SYNTHESIS_SYSTEM = `You are a thoughtful reading companion helping a reader distil and elevate their personal takeaways from a book.

You are given:
- The book's title, author, type (fiction/non-fiction), and summary
- A set of reflection questions you asked the reader
- The reader's answers to those questions
- Any free-form notes they added

Your job: synthesise all of this into a beautifully structured, deeply personal "Your Takeaways" document. This is NOT a generic book summary — it should feel like the reader's own intellectual diary entry, organised and elevated by you.

Format rules (markdown):
1. Start with a one-line personal headline that captures the reader's unique angle on the book. Use the reader's own language and ideas, not marketing copy.
2. ## Core Insights — 3–5 bullet points capturing the key ideas the reader took away. Draw from their answers. Quote their words when they're vivid.
3. ## What Surprised You — 1–3 things from their answers that signal genuine discovery or shift in thinking.
4. ## Personal Connections — how the book connects to their life, work, or beliefs, based on what they said.
5. ## Questions Still Open — 1–3 questions the book raised that the reader hasn't fully resolved yet. Infer these from gaps, tensions, or curiosity in their answers.
6. ## Your Next Steps (non-fiction only) — 2–4 concrete actions or experiments the reader mentioned or implied they want to take.
7. End with a single italicised sentence that captures the essence of this reader's relationship to this book — something they could read back years from now and feel seen.

Writing rules:
- Write in second person ("You came to this book…", "What struck you most…").
- Be warm, incisive, and genuine. Avoid corporate or generic language.
- The document should feel like it was written BY the reader, not about them.
- If a reader's answer is thin or vague, gently expand it using the book's ideas — but never fabricate strong opinions they didn't express.
- Total length: 350–600 words.`;

async function streamSynthesis(
  apiKey: string,
  title: string,
  author: string,
  bookType: string,
  summary: string,
  questions: Array<{ id: string; question: string }>,
  answers: Array<{ questionId: string; answer: string }>,
  freeNotes: string,
  controller: ReadableStreamDefaultController,
): Promise<string> {
  const send = (event: string, data: unknown) => {
    try { controller.enqueue(sseFrame(event, data)); } catch { /* closed */ }
  };

  // Build the Q&A transcript
  const qaTranscript = questions
    .map((q) => {
      const answer = answers.find((a) => a.questionId === q.id)?.answer ?? "(no answer)";
      return `Q: ${q.question}\nA: ${answer}`;
    })
    .join("\n\n");

  const userContent = [
    `Book: "${title}" by ${author} (${bookType})`,
    `Summary: ${summary}`,
    ``,
    `--- Reflection Q&A ---`,
    qaTranscript,
    freeNotes?.trim() ? `\n--- Free notes from the reader ---\n${freeNotes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await geminiFetchWithFallback(apiKey, {
    stream: true,
    messages: [
      { role: "system", content: SYNTHESIS_SYSTEM },
      { role: "user", content: userContent },
    ],
  });

  if (!response.ok) {
    const err: any = new Error(`AI gateway error ${response.status}`);
    err.status = response.status;
    throw err;
  }

  if (!response.body) throw new Error("No response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") break;
      try {
        const parsed = JSON.parse(json);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          send("token", { text: delta });
        }
      } catch { /* partial chunk */ }
    }
  }

  return fullText;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Keep-warm ping: return immediately before touching DB or Gemini.
  if (body?.is_warmup) return new Response("ok", { status: 200, headers: corsHeaders });

  const { phase, title, author, bookType, summary, thesis, questions, answers, freeNotes, cacheKey, gemini_key: userGeminiKey } = body ?? {};

  if (!phase || !title) {
    return new Response(JSON.stringify({ error: "phase and title are required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // BYOK: use the user's own key if provided, otherwise fall back to server key.
  const GEMINI_API_KEY = (typeof userGeminiKey === "string" && userGeminiKey.trim())
    ? userGeminiKey.trim()
    : Deno.env.get("GEMINI_API_KEY");

  if (!GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: "No Gemini API key available. Add your key via the API Key button." }), {
      status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── Auth: only signed-in users can use takeaways ───────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  const userJwt = authHeader.replace(/^Bearer\s+/, "");
  const { data: { user }, error: authErr } = await supabase.auth.getUser(userJwt);
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Phase: questions ───────────────────────────────────────────────────────
  if (phase === "questions") {
    // Check if user has an existing session for this book
    if (cacheKey) {
      const { data: existing } = await supabase
        .from("book_takeaways")
        .select("questions, answers, free_notes, takeaways, status")
        .eq("user_id", user.id)
        .eq("cache_key", cacheKey)
        .maybeSingle();

      if (existing?.questions && Array.isArray(existing.questions) && existing.questions.length > 0) {
        return new Response(
          JSON.stringify({
            questions: existing.questions,
            existingAnswers: existing.answers ?? [],
            freeNotes: existing.free_notes ?? "",
            takeaways: existing.takeaways ?? "",
            status: existing.status ?? "draft",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    let generatedQuestions: Array<{ id: string; question: string }> | null = null;
    try {
      generatedQuestions = await generateQuestions(
        GEMINI_API_KEY,
        title,
        author ?? "",
        bookType ?? "fiction",
        summary ?? "",
        thesis,
      );
    } catch (e: any) {
      const status = e.status ?? 500;
      return new Response(JSON.stringify({ error: e.message }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!generatedQuestions || generatedQuestions.length === 0) {
      return new Response(JSON.stringify({ error: "Could not generate questions" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persist the session stub
    if (cacheKey) {
      await supabase
        .from("book_takeaways")
        .upsert(
          {
            user_id: user.id,
            cache_key: cacheKey,
            title,
            author: author ?? "",
            book_type: bookType ?? "fiction",
            questions: generatedQuestions,
            answers: [],
            status: "draft",
          },
          { onConflict: "user_id,cache_key" },
        );
    }

    return new Response(
      JSON.stringify({ questions: generatedQuestions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // ── Phase: synthesize ──────────────────────────────────────────────────────
  if (phase === "synthesize") {
    if (!questions || !answers) {
      return new Response(JSON.stringify({ error: "questions and answers are required for synthesis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          try { controller.enqueue(sseFrame(event, data)); } catch { /* closed */ }
        };

        try {
          send("status", { text: "Distilling your takeaways…" });

          const fullTakeaways = await streamSynthesis(
            GEMINI_API_KEY,
            title,
            author ?? "",
            bookType ?? "fiction",
            summary ?? "",
            questions,
            answers,
            freeNotes ?? "",
            controller,
          );

          // Persist the final takeaways
          if (cacheKey) {
            await supabase
              .from("book_takeaways")
              .upsert(
                {
                  user_id: user.id,
                  cache_key: cacheKey,
                  title,
                  author: author ?? "",
                  book_type: bookType ?? "fiction",
                  questions,
                  answers,
                  free_notes: freeNotes ?? null,
                  takeaways: fullTakeaways,
                  status: "complete",
                },
                { onConflict: "user_id,cache_key" },
              );
          }

          send("done", { takeaways: fullTakeaways });
        } catch (e: any) {
          send("error", { error: e.message ?? "Unknown error" });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  return new Response(JSON.stringify({ error: `Unknown phase: ${phase}` }), {
    status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
