// Anti-Shelf recommender.
// Reads a signed-in user's shelf, fetches cached DNA for each book,
// and asks Gemini for either "similar" or "stretch/contrast" picks.
// Result is cached per (user_id, shelf_signature, mode) and frozen
// until the user explicitly regenerates.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { geminiFetchWithFallback, MODEL } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ROUTE = "recommend-anti-shelf";

type Mode = "similar" | "stretch";

const recommendationsTool = {
  type: "function",
  function: {
    name: "render_recommendations",
    description:
      "Return a list of book recommendations for a reader, based on the DNA of books they already love.",
    parameters: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["similar", "stretch"] },
        rationale: {
          type: "string",
          description:
            "One short editorial sentence describing the throughline of these picks, written in the voice of a literary editor.",
        },
        recommendations: {
          type: "array",
          minItems: 6,
          maxItems: 10,
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              author: { type: "string" },
              one_liner: {
                type: "string",
                description: "One sharp editorial sentence on why this fits the reader.",
              },
              tags: {
                type: "array",
                items: { type: "string" },
                description: "2-4 short thematic tags (e.g. 'fragmented memory', 'Southern Gothic').",
              },
              echoes: {
                type: "array",
                items: { type: "string" },
                description:
                  "Up to 3 titles from the user's shelf that this pick resonates with or deliberately diverges from.",
              },
            },
            required: ["title", "author", "one_liner", "tags", "echoes"],
            // additionalProperties: false — omitted: Gemini OpenAI-compat endpoint rejects this field with 400
          },
        },
      },
      required: ["mode", "rationale", "recommendations"],
      // additionalProperties: false — omitted: Gemini OpenAI-compat endpoint rejects this field with 400
    },
  },
};

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function shelfSignature(
  books: { cache_key: string }[],
  liked: string[] = [],
  disliked: string[] = [],
  blockedAuthors: string[] = [],
  blockedTags: string[] = [],
): Promise<string> {
  // Reader signal is part of the cache key — changing it should produce fresh picks on next force.
  const sortedBooks = [...books].map((b) => b.cache_key.trim().toLowerCase()).sort();
  const norm = (xs: string[]) => [...new Set(xs.map((x) => (x || "").toLowerCase().trim()).filter(Boolean))].sort();
  const parts = [
    sortedBooks.join("|"),
    "L:" + norm(liked).join(","),
    "D:" + norm(disliked).join(","),
    "BA:" + norm(blockedAuthors).join(","),
    "BT:" + norm(blockedTags).join(","),
  ];
  return sha256Hex(parts.join("::"));
}

async function getClientIp(req: Request): Promise<string> {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

async function hashIp(ip: string): Promise<string> {
  const salt = Deno.env.get("GEMINI_API_KEY") || "fallback-salt";
  return sha256Hex(`${salt}::${ip}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Sign in required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Parse body first so we can read the user-supplied Gemini key (BYOK).
    const body = await req.json().catch(() => ({}));

    // Keep-warm ping: return immediately before touching DB or Gemini.
    if (body?.is_warmup) return new Response("ok", { status: 200, headers: corsHeaders });

    const mode: Mode = body?.mode === "stretch" ? "stretch" : "similar";
    const force: boolean = !!body?.force;
    // Cap both array length AND per-item length: these strings (book titles,
    // author names, tags) get embedded directly into the Gemini prompt, so
    // an array of 100 megabyte-sized strings would still be a single-request
    // cost/DoS vector even with the count cap alone.
    const capStrings = (arr: unknown, maxItems: number, maxLen: number): string[] =>
      Array.isArray(arr)
        ? arr.slice(0, maxItems).map((s) => String(s).slice(0, maxLen))
        : [];
    const liked: string[] = capStrings(body?.liked, 100, 300);
    const disliked: string[] = capStrings(body?.disliked, 100, 300);
    const blockedAuthors: string[] = capStrings(body?.blocked_authors, 100, 200);
    const blockedTags: string[] = capStrings(body?.blocked_tags, 100, 100);

    // BYOK: prefer the user's own Gemini key; fall back to the shared server key.
    const lovableKey = (typeof body?.gemini_key === "string" && body.gemini_key.trim())
      ? body.gemini_key.trim()
      : Deno.env.get("GEMINI_API_KEY");

    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "No Gemini API key available. Add your key via the API Key button." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    // Service-role client for cache + cross-table reads
    const admin = createClient(supabaseUrl, serviceKey);

    // Pull the user's shelf
    const { data: shelfBooks, error: shelfErr } = await admin
      .from("shelf_books")
      .select("cache_key, title, author")
      .eq("user_id", userId);

    if (shelfErr) throw shelfErr;
    if (!shelfBooks || shelfBooks.length === 0) {
      return new Response(
        JSON.stringify({ error: "Add at least one book to your shelf first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Pull persisted feedback rows so we can resolve rec_keys back to title/author for the prompt
    const { data: feedbackRows } = await admin
      .from("recommendation_feedback")
      .select("rec_key, title, author, signal")
      .eq("user_id", userId);

    // Pull the user's own DNA overrides for shelf books.
    // axis_overrides stores effective scores { [axisId]: number }.
    const { data: overrideRows } = await admin
      .from("book_overrides")
      .select("cache_key, axis_overrides")
      .eq("user_id", userId)
      .in("cache_key", shelfBooks.map((b) => b.cache_key));

    const overrideByKey = new Map<string, Record<string, number>>();
    for (const row of overrideRows ?? []) {
      if (row.axis_overrides && typeof row.axis_overrides === "object") {
        overrideByKey.set(row.cache_key, row.axis_overrides as Record<string, number>);
      }
    }

    const fbByKey = new Map<string, { title: string; author: string; signal: number }>();
    for (const r of feedbackRows ?? []) fbByKey.set(r.rec_key, r);

    // Stable string of all user DNA overrides, included in the signature so
    // the recommendation cache invalidates whenever the user edits any axis.
    const overridesDigest = JSON.stringify(
      [...overrideByKey.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, Object.entries(v).sort(([a], [b]) => a.localeCompare(b))]),
    );

    const signature = await shelfSignature(
      shelfBooks,
      liked,
      disliked,
      blockedAuthors,
      [...blockedTags, overridesDigest],
    );

    // Cache lookup
    if (!force) {
      const { data: cached } = await admin
        .from("shelf_recommendations")
        .select("id, recommendations, source_titles, created_at, model")
        .eq("user_id", userId)
        .eq("shelf_signature", signature)
        .eq("mode", mode)
        .maybeSingle();

      if (cached) {
        // bump last_accessed_at, fire-and-forget
        admin
          .from("shelf_recommendations")
          .update({ last_accessed_at: new Date().toISOString() })
          .eq("id", cached.id)
          .then(() => {});
        return new Response(
          JSON.stringify({
            cached: true,
            mode,
            payload: cached.recommendations,
            source_titles: cached.source_titles,
            generated_at: cached.created_at,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Rate limit: 20 generations / hour / IP, AND 20/hour per authenticated
    // user ID. IP-only limiting lets a signed-in user bypass the cap by
    // cycling IPs/VPNs while staying logged into the same account. hashIp()
    // is a generic salted-SHA256 helper (name predates this use) — reused
    // here to hash the user's UUID into its own counter bucket under a
    // distinct route key.
    const ip = await getClientIp(req);
    const ipHash = await hashIp(ip);
    const userIdHash = await hashIp(userId);
    try {
      const [{ data: count }, { data: userCount }] = await Promise.all([
        admin.rpc("count_recent_events", {
          p_ip_hash: ipHash,
          p_route: ROUTE,
          p_window_seconds: 3600,
          p_prefetch_only: false,
        }),
        admin.rpc("count_recent_events", {
          p_ip_hash: userIdHash,
          p_route: `${ROUTE}:user`,
          p_window_seconds: 3600,
          p_prefetch_only: false,
        }),
      ]);
      if (
        (typeof count === "number" && count >= 20) ||
        (typeof userCount === "number" && userCount >= 20)
      ) {
        return new Response(
          JSON.stringify({ error: "Too many regenerations. Try again in an hour." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "3600" },
          },
        );
      }
    } catch {
      // fail open
    }

    // Pull cached DNAs for shelf books (best-effort; some may be missing)
    const cacheKeys = shelfBooks.map((b) => b.cache_key);
    const { data: dnas } = await admin
      .from("novel_analyses")
      .select("cache_key, title, author, analysis")
      .in("cache_key", cacheKeys);

    const dnaByKey = new Map<string, any>();
    (dnas || []).forEach((d) => dnaByKey.set(d.cache_key, d));

    // Build a compact DNA digest for the prompt (cap to keep tokens reasonable).
    // For each book we now include the 12-axis DNA profile, applying the user's
    // own overrides so recommendations respond to their reading fingerprint.
    const digest = shelfBooks.slice(0, 12).map((b) => {
      const d = dnaByKey.get(b.cache_key);
      const a: any = d?.analysis;
      const themes = a?.summary?.slice(0, 200) || "—";
      const userOverrides: Record<string, number> = overrideByKey.get(b.cache_key) ?? {};

      // Merge user overrides into the base DNA axes.
      const baseAxes: Array<{ id: string; score: number }> = Array.isArray(a?.dna?.axes)
        ? a.dna.axes
        : [];
      const effectiveAxes = baseAxes.map((ax: { id: string; score: number }) => ({
        id: ax.id,
        score: typeof userOverrides[ax.id] === "number" ? userOverrides[ax.id] : ax.score,
      }));

      const dnaStr =
        effectiveAxes.length > 0
          ? effectiveAxes.map((ax) => `${ax.id}:${Math.round(ax.score)}`).join(" · ")
          : "—";

      const hasOverrides = Object.keys(userOverrides).length > 0;

      return {
        title: b.title,
        author: b.author || "Unknown",
        summary: themes,
        dna: dnaStr,
        userAdjusted: hasOverrides,
      };
    });

    const sourceList = digest.map((d) => `${d.title}${d.author ? " — " + d.author : ""}`);

    const modeBrief =
      mode === "similar"
        ? "Recommend books that resonate deeply with the structural and thematic DNA of the shelf — same emotional register, comparable narrative architecture, kindred preoccupations. The reader should feel: 'These belong with my collection.'"
        : "Recommend STRETCH picks that intentionally diverge from the shelf's DNA — different lane structures, different cultural traditions, different relational geometries — while still being books a thoughtful reader of the above would find genuinely rewarding. The reader should feel: 'I would never have picked this myself, but it's exactly what I needed.'";

    const systemPrompt = `You are the literary editor of a discerning indie magazine. You recommend books — fiction and non-fiction alike — with editorial precision. Never generic bestsellers, never pandering. Each pick must feel hand-chosen.

Rules:
- NEVER recommend books that are already on the reader's shelf.
- Match the shelf's centre of gravity: if it leans non-fiction, recommend mostly non-fiction; if fiction, mostly fiction; if mixed, mix accordingly.
- Real, verifiable books and authors only. No fabrications.
- Be specific in your one-liners — name the actual texture of the book, not vague praise.`;

    // Resolve liked / disliked rec_keys back to readable "Title — Author" lines
    const resolveSignal = (keys: string[]) =>
      keys
        .map((k) => fbByKey.get(k))
        .filter(Boolean)
        .map((r) => `${r!.title}${r!.author ? " — " + r!.author : ""}`)
        .slice(0, 20);
    const likedTitles = resolveSignal(liked);
    const dislikedTitles = resolveSignal(disliked);

    const signalSection =
      likedTitles.length || dislikedTitles.length || blockedAuthors.length || blockedTags.length
        ? `

READER SIGNAL (use this to refine — do NOT recommend any book by a blocked author or carrying a blocked tag):
${likedTitles.length ? "LIKED past picks (lean toward this register): " + likedTitles.join("; ") : ""}
${dislikedTitles.length ? "DISLIKED past picks (steer away from this register): " + dislikedTitles.join("; ") : ""}
${blockedAuthors.length ? "BLOCKED authors (never recommend): " + blockedAuthors.join("; ") : ""}
${blockedTags.length ? "BLOCKED tags (avoid these vibes): " + blockedTags.join("; ") : ""}`
        : "";

    const userPrompt = `READER'S SHELF (${digest.length} books):

${digest
  .map(
    (d, i) =>
      `${i + 1}. ${d.title} — ${d.author}${d.userAdjusted ? " ★ reader-adjusted DNA" : ""}
   DNA (0=low, 100=high): ${d.dna}
   Notes: ${d.summary}`,
  )
  .join("\n\n")}
${signalSection}

TASK: ${modeBrief}

Use the DNA profiles above as the primary signal for matching. Books marked ★ have reader-adjusted DNA — weight those axes more heavily as they reflect the reader's actual perception, not just the text's surface properties.

Return 6–10 recommendations via the render_recommendations tool. For each pick, fill 'echoes' with the 1–3 shelf titles it most directly relates to (similar mode) or contrasts against (stretch mode).`;

    // Call Gemini
    const aiRes = await geminiFetchWithFallback(admin, lovableKey, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [recommendationsTool],
      tool_choice: { type: "function", function: { name: "render_recommendations" } },
    });

    if (aiRes.status === 429 || aiRes.status === 503) {
      return new Response(JSON.stringify({ error: "AI is rate-limited. Try again shortly." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiRes.ok) {
      const text = await aiRes.text();
      console.error("AI gateway error", aiRes.status, text);
      return new Response(JSON.stringify({ error: "AI request failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "AI returned no recommendations" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(JSON.stringify({ error: "Malformed AI output" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter out shelf overlap, blocked authors, and blocked tags
    const shelfTitles = new Set(
      shelfBooks.map((b) => `${b.title.trim().toLowerCase()}|${(b.author || "").trim().toLowerCase()}`),
    );
    const blockedAuthorSet = new Set(blockedAuthors.map((a) => a.toLowerCase().trim()));
    const blockedTagSet = new Set(blockedTags.map((t) => t.toLowerCase().trim()));
    if (Array.isArray(parsed.recommendations)) {
      parsed.recommendations = parsed.recommendations.filter((r: any) => {
        const k = `${(r.title || "").trim().toLowerCase()}|${(r.author || "").trim().toLowerCase()}`;
        if (!r.title || shelfTitles.has(k)) return false;
        if (blockedAuthorSet.has((r.author || "").toLowerCase().trim())) return false;
        const tags: string[] = Array.isArray(r.tags) ? r.tags : [];
        if (tags.some((t) => blockedTagSet.has((t || "").toLowerCase().trim()))) return false;
        return true;
      });
    }

    // Upsert cache
    const { error: upsertErr } = await admin
      .from("shelf_recommendations")
      .upsert(
        {
          user_id: userId,
          shelf_signature: signature,
          mode,
          recommendations: parsed,
          source_titles: sourceList,
          model: MODEL,
          last_accessed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
        { onConflict: "user_id,shelf_signature,mode" },
      );
    if (upsertErr) console.error("Cache upsert failed", upsertErr);

    // Log rate events (both IP and per-user buckets) fire-and-forget.
    admin
      .from("rate_limit_events")
      .insert({ ip_hash: ipHash, route: ROUTE, is_prefetch: false })
      .then(() => {});
    admin
      .from("rate_limit_events")
      .insert({ ip_hash: userIdHash, route: `${ROUTE}:user`, is_prefetch: false })
      .then(() => {});

    return new Response(
      JSON.stringify({
        cached: false,
        mode,
        payload: parsed,
        source_titles: sourceList,
        generated_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("recommend-anti-shelf fatal", err);
    return new Response(JSON.stringify({ error: "Unexpected server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
