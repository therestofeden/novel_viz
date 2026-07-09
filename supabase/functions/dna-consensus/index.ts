// dna-consensus
// Wisdom-of-the-crowds recompute for a book's DNA. Triggered fire-and-forget
// by BookDNA.tsx after a reader saves their own axis_overrides.
//
// For a given book (cache_key):
//   1. Reads the original Gemini axes from novel_analyses (the anchor).
//   2. Reads the most recent 100 readers' book_overrides for this book
//      (ordered by updated_at desc) — a moving window, not an all-time
//      average, so a book's consensus can drift as new readers replace old
//      ones (e.g. a psychology book's evidence_rigor axis sliding down years
//      after a replicability-crisis reassessment, without needing to purge
//      history).
//   3. Blends each axis as a Bayesian average: the original Gemini score
//      counts as PRIOR_WEIGHT "virtual votes", so a couple of early readers
//      can't swing a book's DNA — it takes real volume.
//   4. Resolves a recommendation for the resulting consensus point, reusing
//      dna_recommendation_cache (shared with recommend-by-dna) or calling
//      Gemini once if this exact quantized point has never been seen.
//   5. Upserts book_dna_consensus so every future visitor reads this for
//      free — no aggregation or Gemini call on the read path.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { geminiFetchWithFallback, MODEL } from "../_shared/gemini.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";

// ---------- Tunables ----------
const PRIOR_WEIGHT = 5; // original Gemini score counts as this many "votes"
const MIN_VOTES = 3;    // fewer real votes than this → consensus stays at the original score
const VOTE_WINDOW = 100; // moving window size — most-recently-updated readers only

// ---------- Rate limiting (mirrors recommend-by-dna) ----------
const ROUTE = "dna-consensus";
const RATE_LIMIT = 30;

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}
async function hashIp(ip: string): Promise<string> {
  const salt = Deno.env.get("RATE_LIMIT_SALT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "fallback-salt";
  return sha256Hex(salt + ip);
}

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
        similarity: { type: "number", description: "0-100 estimated DNA similarity. Most good matches land 70-88." },
        why: { type: "string", description: "1-2 sentences explaining why a fan of this DNA would love the recommendation." },
        shared_axes: { type: "array", items: { type: "string" }, description: "3-5 axis IDs where both books score within ~15 of each other." },
        divergent_axes: { type: "array", items: { type: "string" }, description: "1-3 axis IDs where the recommendation differs most — what makes it a fresh read." },
      },
      required: ["title", "author", "similarity", "why", "shared_axes", "divergent_axes"],
    },
  },
};

// ---------- Signature (must match recommend-by-dna's quantization exactly) ----------
function buildAxesSignature(axes: Array<{ id: string; score: number }>): string {
  return axes
    .map((a) => ({ id: a.id, score: Math.round(a.score / 5) * 5 }))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((a) => `${a.id}:${a.score}`)
    .join("|");
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body?.is_warmup) return new Response("ok", { status: 200, headers: corsHeaders });

    const { cacheKey, gemini_key: userKey } = body ?? {};
    if (!cacheKey || typeof cacheKey !== "string") {
      return new Response(JSON.stringify({ error: "cacheKey is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const ip = getClientIp(req);
    const ipHash = await hashIp(ip);
    const usingServerKey = !(typeof userKey === "string" && userKey.trim());
    if (usingServerKey) {
      const { data: rlCount } = await admin.rpc("count_recent_events", {
        p_ip_hash: ipHash, p_route: ROUTE, p_window_seconds: 3600, p_prefetch_only: false,
      });
      if (typeof rlCount === "number" && rlCount >= RATE_LIMIT) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ---------- 1. Original (Gemini) axes — the anchor ----------
    const { data: book, error: bookErr } = await admin
      .from("novel_analyses")
      .select("title, author, analysis")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (bookErr || !book?.analysis) {
      return new Response(JSON.stringify({ error: "Book not found in cache" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analysis = book.analysis as any;
    const originalAxes: Array<{ id: string; score: number }> = Array.isArray(analysis?.dna?.axes)
      ? analysis.dna.axes.map((a: any) => ({ id: String(a.id), score: Number(a.score) }))
      : [];
    if (originalAxes.length === 0) {
      return new Response(JSON.stringify({ error: "Book has no DNA axes to build consensus from" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const bookType = analysis?.bookType === "nonfiction" ? "nonfiction" : "fiction";

    // ---------- 2. Last-100-by-recency reader overrides ----------
    const { data: overrideRows, error: ovErr } = await admin
      .from("book_overrides")
      .select("axis_overrides, updated_at")
      .eq("cache_key", cacheKey)
      .order("updated_at", { ascending: false })
      .limit(VOTE_WINDOW);

    if (ovErr) {
      console.error("dna-consensus: book_overrides query error", ovErr);
    }

    // ---------- 3. Bayesian-anchored, windowed consensus per axis ----------
    const consensus: Record<string, { score: number; voteCount: number }> = {};
    for (const axis of originalAxes) {
      const votes: number[] = [];
      for (const row of overrideRows ?? []) {
        const raw = (row.axis_overrides as Record<string, unknown> | null)?.[axis.id];
        if (typeof raw === "number" && Number.isFinite(raw)) votes.push(raw);
      }
      const voteCount = votes.length;
      const score = voteCount >= MIN_VOTES
        ? Math.round(
            (((PRIOR_WEIGHT * axis.score) + votes.reduce((s, v) => s + v, 0)) / (PRIOR_WEIGHT + voteCount)) * 100,
          ) / 100
        : axis.score;
      consensus[axis.id] = { score: Math.max(0, Math.min(100, score)), voteCount };
    }

    const consensusAxesForSignature = originalAxes.map((a) => ({ id: a.id, score: consensus[a.id].score }));
    const signature = buildAxesSignature(consensusAxesForSignature);

    // ---------- 4. Resolve a recommendation for this consensus point ----------
    const { data: existingConsensus } = await admin
      .from("book_dna_consensus")
      .select("recommendation, recommendation_signature")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    let recommendation: unknown = null;

    if (existingConsensus?.recommendation && existingConsensus.recommendation_signature === signature) {
      // Consensus hasn't moved into a new quantized bucket since last time — reuse.
      recommendation = existingConsensus.recommendation;
    } else {
      const { data: cachedRec } = await admin
        .from("dna_recommendation_cache")
        .select("id, recommendation, hit_count")
        .eq("cache_key", cacheKey)
        .eq("axes_signature", signature)
        .maybeSingle();

      if (cachedRec?.recommendation) {
        recommendation = cachedRec.recommendation;
        admin
          .from("dna_recommendation_cache")
          .update({ hit_count: (cachedRec.hit_count ?? 0) + 1, last_accessed_at: new Date().toISOString() })
          .eq("id", cachedRec.id)
          .then(() => {}, (e: any) => console.error("dna_recommendation_cache hit-bump error:", e));
      } else {
        const GEMINI_API_KEY = (typeof userKey === "string" && userKey.trim())
          ? userKey.trim()
          : Deno.env.get("GEMINI_API_KEY");

        if (GEMINI_API_KEY) {
          const axesStr = consensusAxesForSignature.map((a) => `  ${a.id}: ${Math.round(a.score)}/100`).join("\n");
          const type = bookType === "nonfiction" ? "non-fiction" : "fiction";
          const systemPrompt = `You are a literary scholar and expert book recommender covering both fiction and non-fiction. Given a book's 12-axis DNA profile, recommend ONE different book (different author if possible) from the literary canon whose DNA best matches. The recommendation must be a real, verifiable book.`;
          const userPrompt = `Book: "${book.title}"${book.author ? ` by ${book.author}` : ""} (${type})

DNA profile (0 = low pole, 100 = high pole) — this is the crowd-consensus profile after reader adjustments, not the original AI-only read:
${axesStr}

Recommend the single best DNA neighbour from the canon.`;

          try {
            const res = await geminiFetchWithFallback(admin, GEMINI_API_KEY, {
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              tools: [recommendationTool],
              tool_choice: { type: "function", function: { name: "render_dna_recommendation" } },
            });
            if (res.ok) {
              const data = await res.json();
              const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
              if (toolCall?.function?.arguments) {
                recommendation = JSON.parse(toolCall.function.arguments);
                admin
                  .from("dna_recommendation_cache")
                  .upsert(
                    { cache_key: cacheKey, axes_signature: signature, recommendation, model: MODEL },
                    { onConflict: "cache_key,axes_signature", ignoreDuplicates: true },
                  )
                  .then(() => {}, (e: any) => console.error("dna_recommendation_cache write error:", e));
              }
            } else {
              console.error("dna-consensus: Gemini error", res.status, await res.text().catch(() => ""));
            }
          } catch (e) {
            console.error("dna-consensus: Gemini call failed", e);
          }
        }
        // Fall back to whatever was previously cached, if the Gemini call above didn't produce anything —
        // better to keep showing a slightly-stale recommendation than none at all.
        if (!recommendation && existingConsensus?.recommendation) {
          recommendation = existingConsensus.recommendation;
        }
      }
    }

    // ---------- 5. Persist ----------
    const { error: upsertErr } = await admin
      .from("book_dna_consensus")
      .upsert(
        {
          cache_key: cacheKey,
          consensus,
          recommendation,
          recommendation_signature: signature,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "cache_key" },
      );
    if (upsertErr) console.error("dna-consensus: upsert error", upsertErr);

    if (usingServerKey) {
      admin.from("rate_limit_events").insert({ ip_hash: ipHash, route: ROUTE, is_prefetch: false }).then(() => {});
    }

    return new Response(JSON.stringify({ consensus, recommendation }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(JSON.stringify({ fn: "dna-consensus", error: err instanceof Error ? err.message : String(err) }));
    return new Response(JSON.stringify({ error: "Temporary server error." }), {
      status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
