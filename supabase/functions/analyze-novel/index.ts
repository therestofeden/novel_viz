import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// gemini-2.0-* shut down 2026-06-01; gemini-2.5-flash was 503-prone.
// Primary model is gemini-3.5-flash (latest Flash tier as of 2026-06).
// Since every analysis is DB-cached after the first call, the speed cost of
// a heavier model is borne exactly once per book — all subsequent users get
// an instant cache hit regardless of which model produced the result.
// Use the best model so the cached copy is as good as possible.
const MODEL = "gemini-3.5-flash";
const PREAMBLE_MODEL = "gemini-3.5-flash";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

// Fallback chain: newest → older lite (last resort for 503/429 surges).
const MODEL_FALLBACKS = [MODEL, "gemini-2.5-flash", "gemini-2.5-flash-lite"];

// ---------- Circuit breaker ----------
// Tracks per-model transient failure counts within this isolate.
// After CIRCUIT_TRIP_AFTER consecutive 429/503 responses the circuit opens and
// the model is skipped entirely for CIRCUIT_OPEN_MS — turning a 15s timeout
// cascade into a <1ms reroute.
const CIRCUIT_OPEN_MS = 30_000;
const CIRCUIT_TRIP_AFTER = 1;
type CircuitState = { fails: number; openUntil: number };
const modelCircuit = new Map<string, CircuitState>();

function circuitIsOpen(model: string): boolean {
  const s = modelCircuit.get(model);
  if (!s) return false;
  if (Date.now() < s.openUntil) return true;
  modelCircuit.delete(model); // window expired — reset
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
    {
      const r = await fetch(GEMINI_BASE, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, model }),
      });
      if (r.ok) {
        circuitRecordSuccess(model);
        return r;
      }
      // Retry on rate-limit, service-unavailable, bad-gateway, and internal errors.
      // 4xx client errors (400, 401, 403, 404 …) are hard failures — no retry.
      // 429 is a 4xx but IS retryable (rate-limit). 5xx are always retryable.
      const isRetryable = r.status === 429 || r.status >= 500;
      if (!isRetryable) return r; // client error — no retry
      console.warn(`gemini ${model} -> ${r.status}, tripping circuit`);
      await r.body?.cancel().catch(() => {});
      last = r;
      circuitRecordFail(model);
      // Circuit trips after first 503/429 (CIRCUIT_TRIP_AFTER=1), jump to next model immediately.
    }
  }
  return last!;
}

// ---------- Non-fiction tool ----------

const nonfictionAnalysisTool = {
  type: "function",
  function: {
    name: "render_nonfiction_analysis",
    description:
      "Return a structured analysis of a non-fiction book: central thesis, argument pillars, idea cards (claims), concept network, chapter breakdown, and DNA.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        author: { type: "string" },
        confidence: { type: "string", enum: ["high", "medium", "low", "unknown_work"] },
        summary: { type: "string" },
        thesis: { type: "string", description: "The book's central claim in one sentence. A full grammatical sentence stating the author's position, not a topic." },
        argument_pillars: {
          type: "array",
          description: "3-5 major pillars supporting the thesis. Each is a distinct line of argument.",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              claim: { type: "string", description: "The pillar argument stated as a full claim sentence." },
              evidence: { type: "string", description: "The key experiment, data point, or case study supporting this pillar. 1-2 sentences." },
              implication: { type: "string", description: "Practical so-what. What this means for the reader. 1 sentence." },
              ideaIds: { type: "array", items: { type: "string" }, description: "IDs of idea_cards that belong to this pillar." },
            },
            required: ["id", "claim", "evidence", "implication", "ideaIds"],
            additionalProperties: false,
          },
        },
        idea_cards: {
          type: "array",
          description: "Exactly 8-10 key ideas from the book. EACH MUST be stated as a full claim sentence — not a topic name. E.g. 'The availability heuristic causes people to overestimate the probability of vivid events' not 'Availability heuristic'.",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              claim: { type: "string", description: "The idea as a complete, specific claim sentence." },
              evidence: { type: "string", description: "1-2 sentences: the key evidence, experiment, or example that supports this claim." },
              tag: { type: "string", enum: ["core_thesis", "supporting_argument", "evidence", "implication", "counterpoint"] },
              pillarId: { type: "string", description: "ID of the argument_pillar this card belongs to (if applicable)." },
            },
            required: ["id", "claim", "evidence", "tag"],
            additionalProperties: false,
          },
        },
        concepts: {
          type: "array",
          description: "8–14 key ideas, arguments, or mental models from the book.",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string", description: "Short concept name (2–5 words)." },
              description: { type: "string", description: "1–2 sentence explanation." },
              importance: { type: "number", description: "0-100: centrality to the book's argument." },
              type: { type: "string", enum: ["thesis", "framework", "evidence", "example", "conclusion", "principle"] },
            },
            required: ["id", "name", "description", "importance", "type"],
            additionalProperties: false,
          },
        },
        conceptRelationships: {
          type: "array",
          description: "Directed relationships between concept ids.",
          items: {
            type: "object",
            properties: {
              fromId: { type: "string" },
              toId: { type: "string" },
              type: { type: "string", enum: ["supports", "contradicts", "expands", "illustrates", "leads_to", "challenges"] },
              description: { type: "string" },
            },
            required: ["fromId", "toId", "type", "description"],
            additionalProperties: false,
          },
        },
        chapters: {
          type: "array",
          description: "All major chapters or parts of the book.",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              number: { type: "number" },
              title: { type: "string" },
              position: { type: "number", description: "Normalised 0–100 position in the book." },
              summary: { type: "string", description: "2–4 sentences capturing the chapter's argument." },
              keyConceptIds: { type: "array", items: { type: "string" } },
              argumentType: { type: "string", enum: ["introduction", "setup", "evidence", "case_study", "counterargument", "synthesis", "conclusion"] },
            },
            required: ["id", "number", "title", "position", "summary", "keyConceptIds", "argumentType"],
            additionalProperties: false,
          },
        },
        dna: {
          type: "object",
          description: "12-axis DNA vector for non-fiction. For each axis: write one concrete evidence sentence first, then assign the score.",
          properties: {
            axes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: {
                    type: "string",
                    enum: [
                      "accessibility", "idea_density", "structure", "scope", "evidence_rigor",
                      "tone", "prose_density", "certainty", "theory_vs_case",
                      "political_charge", "structural_innovation", "actionability",
                    ],
                  },
                  score: { type: "number", description: "0-100. Avoid 40-60 unless you have specific evidence the book is genuinely mid-range." },
                  evidence: { type: "string", description: "One concrete sentence about THIS BOOK that drives the score. Name specific stylistic, structural, or methodological features." },
                },
                required: ["id", "score", "evidence"],
                additionalProperties: false,
              },
            },
            signature: { type: "string", description: "A 3-7 word intellectual fingerprint. E.g. 'rigorous empiricism wearing a storytelling mask'." },
          },
          required: ["axes", "signature"],
          additionalProperties: false,
        },
        recommendation: {
          type: "object",
          description: "Another non-fiction book with similar DNA.",
          properties: {
            title: { type: "string" },
            author: { type: "string" },
            similarity: { type: "number" },
            why: { type: "string" },
            shared_axes: { type: "array", items: { type: "string" } },
            divergent_axes: { type: "array", items: { type: "string" } },
          },
          required: ["title", "author", "similarity", "why", "shared_axes", "divergent_axes"],
          additionalProperties: false,
        },
        explanation: { type: "string" },
      },
      required: ["title", "author", "confidence", "summary", "thesis", "argument_pillars", "idea_cards", "concepts", "conceptRelationships", "chapters", "dna", "recommendation", "explanation"],
      additionalProperties: false,
    },
  },
};

// ---------- Fiction tool ----------

const analysisTool = {
  type: "function",
  function: {
    name: "render_novel_analysis",
    description:
      "Return a structured analysis of a work of fiction: characters, relationships, narrative timelines/lanes, and key events.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        author: { type: "string" },
        confidence: { type: "string", enum: ["high", "medium", "low", "unknown_work"] },
        summary: { type: "string" },
        lanes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              description: { type: "string" },
            },
            required: ["id", "name", "description"],
            additionalProperties: false,
          },
        },
        characters: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              role: {
                type: "string",
                enum: ["protagonist", "deuteragonist", "antagonist", "supporting", "minor", "narrator"],
              },
              laneId: { type: "string" },
              description: { type: "string" },
              introducedAt: { type: "number" },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
            },
            required: ["id", "name", "role", "laneId", "description", "introducedAt", "confidence"],
            additionalProperties: false,
          },
        },
        relationships: {
          type: "array",
          items: {
            type: "object",
            properties: {
              fromId: { type: "string" },
              toId: { type: "string" },
              type: {
                type: "string",
                enum: ["family", "romantic", "friend", "rival", "mentor", "professional", "antagonistic", "acquaintance"],
              },
              description: { type: "string" },
              strength: { type: "number" },
            },
            required: ["fromId", "toId", "type", "description", "strength"],
            additionalProperties: false,
          },
        },
        events: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              laneId: { type: "string" },
              position: { type: "number" },
              title: { type: "string" },
              description: { type: "string" },
              characterIds: { type: "array", items: { type: "string" } },
              chapterRef: { type: "string" },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
            },
            required: ["id", "laneId", "position", "title", "description", "characterIds", "chapterRef", "confidence"],
            additionalProperties: false,
          },
        },
        dna: {
          type: "object",
          description: "12-axis literary DNA vector. Each axis 0-100 with a one-line evidence sentence.",
          properties: {
            axes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: {
                    type: "string",
                    enum: [
                      "interiority",
                      "plot_density",
                      "time_linearity",
                      "scale",
                      "realism",
                      "tonal_register",
                      "prose_density",
                      "moral_ambiguity",
                      "character_vs_plot",
                      "political_charge",
                      "formal_experimentation",
                      "ending_openness",
                    ],
                  },
                  score: { type: "number", description: "0-100" },
                  evidence: { type: "string", description: "One short sentence justifying the score." },
                },
                required: ["id", "score", "evidence"],
                additionalProperties: false,
              },
            },
            signature: {
              type: "string",
              description: "A 3-6 word poetic descriptor of this book's DNA, e.g. 'Slow interior haunted recursion'.",
            },
          },
          required: ["axes", "signature"],
          additionalProperties: false,
        },
        recommendation: {
          type: "object",
          description: "A different novel with the closest DNA to this book.",
          properties: {
            title: { type: "string" },
            author: { type: "string" },
            similarity: { type: "number", description: "0-100 estimated DNA similarity." },
            why: { type: "string", description: "1-2 sentence explanation of the kinship." },
            shared_axes: {
              type: "array",
              description: "Axis ids where both books score similarly (the strongest matches).",
              items: { type: "string" },
            },
            divergent_axes: {
              type: "array",
              description: "Axis ids where the recommendation differs most (what makes it a fresh read).",
              items: { type: "string" },
            },
          },
          required: ["title", "author", "similarity", "why", "shared_axes", "divergent_axes"],
          additionalProperties: false,
        },
        explanation: { type: "string" },
      },
      required: ["title", "author", "confidence", "summary", "lanes", "characters", "relationships", "events", "dna", "recommendation", "explanation"],
      additionalProperties: false,
    },
  },
};

const DNA_AXIS_IDS = [
  "interiority",
  "plot_density",
  "time_linearity",
  "scale",
  "realism",
  "tonal_register",
  "prose_density",
  "moral_ambiguity",
  "character_vs_plot",
  "political_charge",
  "formal_experimentation",
  "ending_openness",
] as const;

const SYSTEM_PROMPT = `You are a literary scholar specializing in mapping the structure of books — both fiction and non-fiction. Given a book's title, you determine whether it is fiction or non-fiction and call the appropriate tool.

OBSCURE OR LESSER-KNOWN BOOKS: Always attempt a best-effort analysis. Return confidence "low" if your knowledge is limited. NEVER use "unknown_work" for a real book just because it is obscure — only use "unknown_work" when the input is clearly NOT a book (a film, TV show, video game, or complete gibberish). Even a thin analysis with confidence "low" is far more useful than refusing.

IMPORTANT — choose the right tool:
- For FICTION (novels, novellas, short stories, plays): call \`render_novel_analysis\`.
- For NON-FICTION (essays, memoirs, history, science, philosophy, self-help, business, biography): call \`render_nonfiction_analysis\`.
- If the work is a film, TV show, video game, or is completely unknown to you, set confidence to "unknown_work" in the most appropriate tool and explain in the explanation field.

FICTION RULES (render_novel_analysis):
- For books with multiple narrative threads, create one lane per major thread/POV.
- For single-narrative books, return ONE lane covering the whole story.
- Limit characters to the 8–14 most important.
- Limit events to 8–14 key plot points spread evenly across the 0–100 timeline. Avoid clustering: if two events would land within 4 units of each other on the same lane, merge or drop the lesser one.
- Every event's laneId MUST match a lane id you defined. Every character's laneId MUST match a lane id, or be empty string for cross-lane characters.
- Every relationship's fromId/toId MUST match character ids you defined.
- Include major plot events including the ending — the UI has a spoiler slider that masks late events.
- For each event, set 'position' carefully (0 = first page, 100 = last page).
- For each character, set 'introducedAt' to the position where they first meaningfully appear.
- Provide 'chapterRef' when reasonably known. Use empty string if uncertain — do NOT invent.
- Provide per-item 'confidence' honestly.
- For relationships, set 'strength' 1–5.
- The explanation field should be insightful literary commentary in markdown (300–600 words).

DNA AXES — score each 0–100. Be specific, calibrated against the canon of literary fiction. Do NOT bunch scores around 50.
  - interiority: 0 = pure external action, 100 = total stream-of-consciousness (Mrs Dalloway = 95).
  - plot_density: 0 = almost nothing happens, 100 = thriller pacing (Gone Girl = 90).
  - time_linearity: 0 = wildly fragmented/non-linear (Cloud Atlas = 10), 100 = strict chronological.
  - scale: 0 = single room/single day (Mrs Dalloway = 15), 100 = generations/continents (One Hundred Years of Solitude = 95).
  - realism: 0 = high fantasy/surreal, 100 = strict literary realism. Magical realism ~ 35–50.
  - tonal_register: 0 = bleak/tragic, 50 = neutral, 100 = comic/joyful (Pride and Prejudice = 85).
  - prose_density: 0 = sparse plain prose (Hemingway = 10), 100 = baroque/maximalist (Nabokov, McCarthy late work = 90).
  - moral_ambiguity: 0 = clear good vs evil, 100 = no moral compass (Blood Meridian = 95).
  - character_vs_plot: 0 = pure plot machine, 100 = pure character study.
  - political_charge: 0 = apolitical, 100 = explicitly political (1984 = 95).
  - formal_experimentation: 0 = conventional novel form, 100 = radical formal innovation (Pale Fire, House of Leaves = 95).
  - ending_openness: 0 = fully resolved, 100 = radically open/ambiguous.

For the 'signature' field, write a 3–6 word poetic descriptor capturing the book's essence (e.g. 'Slow interior haunted recursion', 'Dry epistolary moral comedy').

RECOMMENDATION (fiction):
- Suggest ONE other novel (NOT the same book, NOT by the same author if avoidable) whose DNA is closest. Prefer well-known works the reader could actually find.
- 'similarity' is a 0–100 estimate. Most good matches land 70–88.
- 'shared_axes': 3–5 axis ids where both books score within ~15 of each other.
- 'divergent_axes': 1–3 axis ids where the recommendation differs most (this is what makes it a fresh read, not a clone).
- 'why': 1–2 sentences explaining the kinship in human terms — what a reader who loves this book would also love about the recommendation.

NON-FICTION RULES (render_nonfiction_analysis):

THESIS: One complete grammatical sentence stating the author's central claim — not a topic label. E.g. "Human cognitive biases are systematic, predictable, and stem from the clash between two distinct mental systems" not "Cognitive biases".

ARGUMENT PILLARS (argument_pillars): 3-5 major lines of argument that together support the thesis.
- Each pillar is a distinct argument, not a chapter summary.
- 'claim': full sentence stating what this pillar argues.
- 'evidence': the key experiment, dataset, or case study the author uses. 1-2 sentences, specific.
- 'implication': one sentence — what this means for the reader in practice.
- 'ideaIds': list IDs of idea_cards that belong to this pillar.

IDEA CARDS (idea_cards): EXACTLY 8-10 cards. This is the most important field.
- EVERY card's 'claim' MUST be a full, specific sentence — never a topic name.
  BAD: "Anchoring effect"
  GOOD: "People's numerical estimates are systematically pulled toward an arbitrary number they encountered first, even when they know it's irrelevant"
- 'evidence': 1-2 sentences. Name the specific experiment, statistic, or story. Be concrete.
- 'tag': classify as core_thesis / supporting_argument / evidence / implication / counterpoint.
- 'pillarId': match to one of the argument_pillar IDs where applicable.
- Spread tags — don't make all cards "supporting_argument". Include at least 1 implication and 1 evidence.

CONCEPTS: 8–14 distinct concepts, frameworks, or ideas. Short name (2–5 words) + 1–2 sentence description. Mark the most central with type "thesis" and importance 90-100. Connect with 8–16 directed relationships.

CHAPTERS: List all major chapters or parts. Set 'position' 0–100. Classify each chapter's argumentType honestly.

DNA AXES for NON-FICTION — 12 axes, each 0-100.

SCORING PROTOCOL — for each axis:
1. Write 'evidence' first: one concrete sentence about THIS BOOK (cite a specific stylistic feature, structural choice, methodological approach, or critical consensus).
2. Then assign 'score'. Let the evidence determine the number.
3. Do NOT cluster around 50. Only score 40-60 if you have specific evidence the book genuinely sits in the middle of that dimension. Most books are not mediocre on most axes.

CALIBRATION TABLE — use as reference:
Cols: acc=accessibility, id=idea_density, st=structure, sc=scope, ev=evidence_rigor, to=tone, pr=prose_density, ce=certainty, tc=theory_vs_case, po=political_charge, si=structural_innovation, ac=actionability

Book                          | acc | id  | st  | sc  | ev  | to  | pr  | ce  | tc  | po  | si  | ac
------------------------------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|----
Thinking Fast and Slow        |  62 |  85 |  78 |  70 |  92 |  35 |  38 |  50 |  35 |   8 |  25 |  38
Sapiens (Harari)              |  82 |  58 |  62 |  98 |  38 |  62 |  65 |  68 |  55 |  52 |  42 |  12
Atomic Habits (Clear)         |  94 |  45 |  92 |  35 |  45 |  72 |  22 |  96 |  78 |   2 |  15 |  98
Antifragile (Taleb)           |  48 |  78 |  20 |  92 |  55 |  55 |  60 |  10 |  40 |  38 |  65 |  28
The New Jim Crow (Alexander)  |  72 |  65 |  85 |  62 |  82 |  75 |  62 |  84 |  68 |  98 |  30 |  40
Being and Time (Heidegger)    |   4 |  72 |  38 |  82 |  18 |  20 |  78 |  65 |   5 |  20 |  55 |   4
Quiet (Susan Cain)            |  80 |  30 |  70 |  48 |  68 |  68 |  52 |  72 |  72 |  28 |  20 |  65
The Elements of Style         |  88 |  55 |  95 |  22 |  35 |  42 |  30 |  98 |  45 |   5 |  38 |  96

AXIS DEFINITIONS:
  - accessibility: prerequisite knowledge and cognitive effort. Low = graduate seminar; high = beach read.
  - idea_density: number of new arguments or insights per chapter. Low = one big idea slowly developed; high = new claim every few pages.
  - structure: how tightly organised the argument is. Low = wandering essays; high = cumulative case, one thesis per chapter.
  - scope: how widely the argument generalises. Low = one company/event; high = all of human civilisation.
  - evidence_rigor: quality of evidence. Low = anecdote and assertion; high = named RCTs, meta-analyses, datasets.
  - tone: author's presence and emotional register. Low = cold and clinical; high = intimate and passionate.
  - prose_density: sentence-level richness. Low = plain business prose; high = literary, Montaigne-style.
  - certainty: how closed the author's argument is. Low = tentative, many caveats; high = prescriptive rules and systems.
  - theory_vs_case: what drives the argument. Low = abstract first principles; high = assembled from real-world stories.
  - political_charge: engagement with power and ideology. Low = explicitly apolitical; high = call to political action.
  - structural_innovation: how conventional the form is. Low = standard chapters; high = genre-bending experimental form.
  - actionability: what the reader walks away with. Low = richer sense of a problem; high = step-by-step system.

For 'signature': 3-7 word intellectual fingerprint. E.g. "rigorous empiricism wearing a storytelling mask", "sweeping grand theory, thin on evidence", "polemical framework, wildly digressive execution".

RECOMMENDATION (non-fiction):
- Suggest ONE other non-fiction book (different author) with the closest DNA.
- 'why': explain the intellectual kinship in one or two human sentences.
- shared_axes and divergent_axes MUST use these axis IDs: accessibility, idea_density, structure, scope, evidence_rigor, tone, prose_density, certainty, theory_vs_case, political_charge, structural_innovation, actionability.`;

// ---------- Validation & repair ----------

type Lane = { id: string; name: string; description: string };
type Character = {
  id: string; name: string; role: string; laneId: string;
  description: string; introducedAt: number; confidence: string;
};
type Relationship = { fromId: string; toId: string; type: string; description: string; strength: number };
type Event = {
  id: string; laneId: string; position: number; title: string;
  description: string; characterIds: string[]; chapterRef: string; confidence: string;
};
type DnaAxis = { id: string; score: number; evidence: string };
type Dna = { axes: DnaAxis[]; signature: string };
type Recommendation = {
  title: string; author: string; similarity: number; why: string;
  shared_axes: string[]; divergent_axes: string[];
};
type FictionAnalysis = {
  bookType: "fiction";
  title: string; author: string; confidence: string; summary: string;
  lanes: Lane[]; characters: Character[]; relationships: Relationship[];
  events: Event[]; explanation: string;
  dna: Dna; recommendation: Recommendation;
};
type NfConcept = { id: string; name: string; description: string; importance: number; type: string };
type NfRelationship = { fromId: string; toId: string; type: string; description: string };
type NfChapter = {
  id: string; number: number; title: string; position: number;
  summary: string; keyConceptIds: string[]; argumentType: string;
};
type NonFictionAnalysis = {
  bookType: "nonfiction";
  title: string; author: string; confidence: string; summary: string;
  thesis: string;
  concepts: NfConcept[]; conceptRelationships: NfRelationship[]; chapters: NfChapter[];
  explanation: string; dna: Dna; recommendation: Recommendation;
};
type Analysis = FictionAnalysis | NonFictionAnalysis;

type BookMetadata = {
  title?: string;
  author?: string;
  description?: string;
  pageCount?: number;
  publishedYear?: number;
  genres?: string[];
};

const confRank = (c: string) => (c === "high" ? 3 : c === "medium" ? 2 : c === "low" ? 1 : 0);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));

function repairAnalysis(raw: any): Analysis {
  const a = raw ?? {};
  const lanes: Lane[] = Array.isArray(a.lanes) ? a.lanes.filter((l: any) => l?.id && l?.name) : [];
  const laneIds = new Set(lanes.map((l) => l.id));

  let characters: Character[] = (Array.isArray(a.characters) ? a.characters : [])
    .filter((c: any) => c?.id && c?.name)
    .map((c: any) => ({
      id: String(c.id),
      name: String(c.name),
      role: c.role ?? "supporting",
      laneId: laneIds.has(c.laneId) ? c.laneId : "",
      description: c.description ?? "",
      introducedAt: clamp(Number(c.introducedAt), 0, 100),
      confidence: c.confidence ?? "medium",
    }));
  // Cap characters at 14, keep highest-confidence first (then preserve order)
  if (characters.length > 14) {
    characters = characters
      .map((c, i) => ({ c, i }))
      .sort((x, y) => confRank(y.c.confidence) - confRank(x.c.confidence) || x.i - y.i)
      .slice(0, 14)
      .sort((x, y) => x.i - y.i)
      .map(({ c }) => c);
  }
  const charIds = new Set(characters.map((c) => c.id));

  const relationships: Relationship[] = (Array.isArray(a.relationships) ? a.relationships : [])
    .filter((r: any) => r?.fromId && r?.toId && charIds.has(r.fromId) && charIds.has(r.toId))
    .map((r: any) => ({
      fromId: r.fromId,
      toId: r.toId,
      type: r.type ?? "acquaintance",
      description: r.description ?? "",
      strength: clamp(Number(r.strength), 1, 5),
    }));

  let events: Event[] = (Array.isArray(a.events) ? a.events : [])
    .filter((e: any) => e?.id && e?.title && laneIds.has(e.laneId))
    .map((e: any) => ({
      id: String(e.id),
      laneId: e.laneId,
      position: clamp(Number(e.position), 0, 100),
      title: String(e.title),
      description: e.description ?? "",
      characterIds: Array.isArray(e.characterIds) ? e.characterIds.filter((id: string) => charIds.has(id)) : [],
      chapterRef: e.chapterRef ?? "",
      confidence: e.confidence ?? "medium",
    }));

  // Cap to 14 events, keep highest-confidence
  if (events.length > 14) {
    events = events
      .slice()
      .sort((x, y) => confRank(y.confidence) - confRank(x.confidence))
      .slice(0, 14);
  }

  // Spacing repair per lane: sort by position, enforce >=4 unit spacing
  const byLane = new Map<string, Event[]>();
  for (const e of events) {
    if (!byLane.has(e.laneId)) byLane.set(e.laneId, []);
    byLane.get(e.laneId)!.push(e);
  }
  const kept: Event[] = [];
  for (const [, lst] of byLane) {
    lst.sort((x, y) => x.position - y.position);
    const out: Event[] = [];
    for (const ev of lst) {
      if (out.length === 0) { out.push(ev); continue; }
      const prev = out[out.length - 1];
      if (ev.position - prev.position >= 4) {
        out.push(ev);
      } else {
        // try nudging forward
        const nudged = Math.min(100, prev.position + 4);
        if (nudged <= 100 && nudged - prev.position >= 4) {
          out.push({ ...ev, position: nudged });
        } else {
          // collision: drop lower-confidence
          if (confRank(ev.confidence) > confRank(prev.confidence)) {
            out[out.length - 1] = ev;
          }
          // else drop ev
        }
      }
    }
    kept.push(...out);
  }
  events = kept;

  // ---- DNA repair ----
  const allowedAxisIds = new Set<string>(DNA_AXIS_IDS);
  const rawAxes = Array.isArray(a?.dna?.axes) ? a.dna.axes : [];
  const axesById = new Map<string, DnaAxis>();
  for (const ax of rawAxes) {
    if (!ax?.id || !allowedAxisIds.has(ax.id)) continue;
    if (axesById.has(ax.id)) continue;
    axesById.set(ax.id, {
      id: ax.id,
      score: clamp(Number(ax.score), 0, 100),
      evidence: typeof ax.evidence === "string" ? ax.evidence : "",
    });
  }
  // Ensure all 12 axes present (fill missing with neutral 50)
  const orderedAxes: DnaAxis[] = DNA_AXIS_IDS.map(
    (id) => axesById.get(id) ?? { id, score: 50, evidence: "" },
  );
  const dna: Dna = {
    axes: orderedAxes,
    signature: typeof a?.dna?.signature === "string" ? a.dna.signature : "",
  };

  // ---- Recommendation repair ----
  const rec = a?.recommendation ?? {};
  const recommendation: Recommendation = {
    title: typeof rec.title === "string" ? rec.title : "",
    author: typeof rec.author === "string" ? rec.author : "",
    similarity: clamp(Number(rec.similarity), 0, 100),
    why: typeof rec.why === "string" ? rec.why : "",
    shared_axes: Array.isArray(rec.shared_axes)
      ? rec.shared_axes.filter((x: any) => allowedAxisIds.has(x))
      : [],
    divergent_axes: Array.isArray(rec.divergent_axes)
      ? rec.divergent_axes.filter((x: any) => allowedAxisIds.has(x))
      : [],
  };

  return {
    bookType: "fiction",
    title: a.title ?? "Unknown",
    author: a.author ?? "Unknown",
    confidence: a.confidence ?? "medium",
    summary: a.summary ?? "",
    lanes,
    characters,
    relationships,
    events,
    explanation: a.explanation ?? "",
    dna,
    recommendation,
  };
}

const NF_DNA_AXIS_IDS = [
  "accessibility", "idea_density", "structure", "scope", "evidence_rigor",
  "tone", "prose_density", "certainty", "theory_vs_case",
  "political_charge", "structural_innovation", "actionability",
] as const;

function repairNonfictionAnalysis(raw: any): NonFictionAnalysis {
  const a = raw ?? {};
  const allowedAxisIds = new Set<string>(NF_DNA_AXIS_IDS);
  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));

  // Argument pillars
  const VALID_TAGS = new Set(["core_thesis", "supporting_argument", "evidence", "implication", "counterpoint"]);
  const argumentPillars = (Array.isArray(a.argument_pillars) ? a.argument_pillars : [])
    .filter((p: any) => p?.id && p?.claim)
    .slice(0, 5)
    .map((p: any) => ({
      id: String(p.id),
      claim: String(p.claim),
      evidence: p.evidence ?? "",
      implication: p.implication ?? "",
      ideaIds: Array.isArray(p.ideaIds) ? p.ideaIds.map(String) : [],
    }));
  const pillarIds = new Set(argumentPillars.map((p: any) => p.id));

  // Idea cards
  const ideaCards = (Array.isArray(a.idea_cards) ? a.idea_cards : [])
    .filter((c: any) => c?.id && c?.claim)
    .slice(0, 10)
    .map((c: any) => ({
      id: String(c.id),
      claim: String(c.claim),
      evidence: c.evidence ?? "",
      tag: VALID_TAGS.has(c.tag) ? c.tag : "supporting_argument",
      ...(c.pillarId && pillarIds.has(String(c.pillarId)) ? { pillarId: String(c.pillarId) } : {}),
    }));

  // Concepts
  const concepts: NfConcept[] = (Array.isArray(a.concepts) ? a.concepts : [])
    .filter((c: any) => c?.id && c?.name)
    .slice(0, 14)
    .map((c: any) => ({
      id: String(c.id),
      name: String(c.name),
      description: c.description ?? "",
      importance: clamp(Number(c.importance ?? 50), 0, 100),
      type: c.type ?? "evidence",
    }));
  const conceptIds = new Set(concepts.map((c) => c.id));

  // Concept relationships
  const conceptRelationships: NfRelationship[] = (Array.isArray(a.conceptRelationships) ? a.conceptRelationships : [])
    .filter((r: any) => r?.fromId && r?.toId && conceptIds.has(r.fromId) && conceptIds.has(r.toId))
    .map((r: any) => ({
      fromId: r.fromId,
      toId: r.toId,
      type: r.type ?? "supports",
      description: r.description ?? "",
    }));

  // Chapters
  const chapters: NfChapter[] = (Array.isArray(a.chapters) ? a.chapters : [])
    .filter((c: any) => c?.id && c?.title)
    .map((c: any) => ({
      id: String(c.id),
      number: Number(c.number ?? 0),
      title: String(c.title),
      position: clamp(Number(c.position ?? 50), 0, 100),
      summary: c.summary ?? "",
      keyConceptIds: Array.isArray(c.keyConceptIds) ? c.keyConceptIds.filter((id: string) => conceptIds.has(id)) : [],
      argumentType: c.argumentType ?? "evidence",
    }));

  // DNA repair — non-fiction axis IDs
  const rawAxes = Array.isArray(a?.dna?.axes) ? a.dna.axes : [];
  const axesById = new Map<string, DnaAxis>();
  for (const ax of rawAxes) {
    if (!ax?.id || !allowedAxisIds.has(ax.id)) continue;
    if (axesById.has(ax.id)) continue;
    axesById.set(ax.id, { id: ax.id, score: clamp(Number(ax.score), 0, 100), evidence: ax.evidence ?? "" });
  }
  const dna: Dna = {
    axes: NF_DNA_AXIS_IDS.map((id) => axesById.get(id) ?? { id, score: 50, evidence: "" }),
    signature: typeof a?.dna?.signature === "string" ? a.dna.signature : "",
  };

  const rec = a?.recommendation ?? {};
  const recommendation: Recommendation = {
    title: rec.title ?? "",
    author: rec.author ?? "",
    similarity: clamp(Number(rec.similarity), 0, 100),
    why: rec.why ?? "",
    shared_axes: Array.isArray(rec.shared_axes) ? rec.shared_axes.filter((x: any) => allowedAxisIds.has(x)) : [],
    divergent_axes: Array.isArray(rec.divergent_axes) ? rec.divergent_axes.filter((x: any) => allowedAxisIds.has(x)) : [],
  };

  return {
    bookType: "nonfiction",
    title: a.title ?? "Unknown",
    author: a.author ?? "Unknown",
    confidence: a.confidence ?? "medium",
    summary: a.summary ?? "",
    thesis: a.thesis ?? "",
    argumentPillars,
    ideaCards,
    concepts,
    conceptRelationships,
    chapters,
    explanation: a.explanation ?? "",
    dna,
    recommendation,
  };
}

function isAdequate(a: Analysis): boolean {
  if (a.confidence === "unknown_work") return true;
  if (a.bookType === "nonfiction") {
    return a.concepts.length >= 3 && a.chapters.length >= 2;
  }
  return a.events.length >= 3 && a.characters.length >= 2 && a.lanes.length >= 1;
}

function hasDna(a: Analysis): boolean {
  if (!a?.dna || !Array.isArray(a.dna.axes)) return false;
  // Both fiction and NF target 12 axes. Accept >= 10 to be resilient to 1-2 missing.
  return a.dna.axes.length >= 10 && !!a?.recommendation?.title;
}

// ---------- Cache key ----------
// v3 = added non-fiction support + bookType discriminant.
const CACHE_VERSION = "v3";
function buildCacheKey(title: string, author?: string): string {
  const t = title.trim().toLowerCase().replace(/\s+/g, " ");
  const a = (author ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return `${CACHE_VERSION}|${t}||${a}`;
}

// Heuristic split: "Title by Author" → { title, author }
function splitTitleAuthor(input: string): { title: string; author: string } {
  const m = input.match(/^(.+?)\s+by\s+(.+)$/i);
  if (m) return { title: m[1].trim(), author: m[2].trim() };
  return { title: input.trim(), author: "" };
}

// ---------- Quick preview tool (progressive rendering) ----------
// Returns only the fields needed to render the masthead immediately (~1s),
// while the full structured analysis call runs in the background.

const previewTool = {
  type: "function",
  function: {
    name: "book_preview",
    description: "Return a quick preview of a book's key metadata so the UI can render a masthead immediately.",
    parameters: {
      type: "object",
      properties: {
        title:      { type: "string" },
        author:     { type: "string" },
        summary:    { type: "string", description: "2-3 sentence summary." },
        confidence: { type: "string", enum: ["high", "medium", "low", "unknown_work"] },
        bookType:   { type: "string", enum: ["fiction", "nonfiction"] },
        thesis:     { type: "string", description: "For nonfiction only: central claim in one sentence." },
      },
      required: ["title", "author", "summary", "confidence", "bookType"],
    },
  },
};

async function callPreview(apiKey: string, title: string): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(GEMINI_BASE, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: "You are a book database. Return the requested preview metadata for the given book. If you don't recognise it, set confidence to 'unknown_work'.",
          },
          { role: "user", content: `Book: ${title}` },
        ],
        tools: [previewTool],
        tool_choice: { type: "function", function: { name: "book_preview" } },
      }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return null;
    return JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
  } catch {
    return null; // preview is best-effort — never block the main call
  }
}

// ---------- Metadata fetch ----------

async function fetchBookMetadata(title: string, author: string): Promise<BookMetadata> {
  const gbQuery = author
    ? `intitle:${encodeURIComponent(title)}+inauthor:${encodeURIComponent(author)}`
    : `intitle:${encodeURIComponent(title)}`;
  const olQuery = author
    ? `title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}`
    : `title=${encodeURIComponent(title)}`;

  const [gbRes, olRes] = await Promise.allSettled([
    fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${gbQuery}&maxResults=3&printType=books`,
      { signal: AbortSignal.timeout(4000) },
    ).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch(
      `https://openlibrary.org/search.json?${olQuery}&fields=title,author_name,first_publish_year,number_of_pages_median,subject&limit=1`,
      { signal: AbortSignal.timeout(4000) },
    ).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);

  const gb = gbRes.status === "fulfilled" ? gbRes.value : null;
  const ol = olRes.status === "fulfilled" ? olRes.value : null;

  const meta: BookMetadata = {};

  // Google Books — primary source for description, page count, year, genres
  const gbItem = gb?.items?.[0]?.volumeInfo;
  if (gbItem) {
    if (gbItem.title) meta.title = gbItem.title;
    if (gbItem.authors?.length) meta.author = gbItem.authors[0];
    if (gbItem.description) meta.description = gbItem.description.slice(0, 600);
    if (gbItem.pageCount) meta.pageCount = gbItem.pageCount;
    if (gbItem.publishedDate) meta.publishedYear = parseInt(gbItem.publishedDate.slice(0, 4), 10) || undefined;
    if (gbItem.categories?.length) meta.genres = gbItem.categories.slice(0, 5);
  }

  // OpenLibrary — fills gaps
  const olDoc = ol?.docs?.[0];
  if (olDoc) {
    if (!meta.author && olDoc.author_name?.[0]) meta.author = olDoc.author_name[0];
    if (!meta.publishedYear && olDoc.first_publish_year) meta.publishedYear = olDoc.first_publish_year;
    if (!meta.pageCount && olDoc.number_of_pages_median) meta.pageCount = olDoc.number_of_pages_median;
    if (!meta.genres?.length && olDoc.subject?.length) {
      meta.genres = (olDoc.subject as string[]).slice(0, 5);
    }
  }

  return meta;
}

function buildMetadataBlock(meta: BookMetadata): string {
  if (!Object.keys(meta).some((k) => meta[k as keyof BookMetadata] !== undefined)) return "";
  const lines: string[] = [];
  if (meta.title)       lines.push(`Title: ${meta.title}`);
  if (meta.author)      lines.push(`Author: ${meta.author}`);
  if (meta.publishedYear) lines.push(`First published: ${meta.publishedYear}`);
  if (meta.pageCount)   lines.push(`Pages: ${meta.pageCount}`);
  if (meta.genres?.length) lines.push(`Genres/categories: ${meta.genres.join(", ")}`);
  if (meta.description) lines.push(`Publisher description:\n${meta.description}`);
  if (!lines.length) return "";
  return [
    "CONFIRMED BOOK METADATA (sourced from Google Books / Open Library — treat as factual ground truth; do not contradict title, author, year, or genre):",
    ...lines,
    "",
  ].join("\n");
}

// ---------- AI call ----------

async function callStructuredAnalysis(apiKey: string, userPrompt: string, corrective?: string): Promise<Analysis | null> {
  const messages: any[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];
  if (corrective) messages.push({ role: "user", content: corrective });

  const response = await geminiFetchWithFallback(apiKey, {
    messages,
    tools: [analysisTool, nonfictionAnalysisTool],
    tool_choice: "required", // never let the model skip the tool and return plain text
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Gemini API error:", response.status, errText);
    const err: any = new Error(`Gemini API error ${response.status}`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    console.error("No tool call in response");
    return null;
  }
  try {
    const raw = JSON.parse(toolCall.function.arguments);
    if (toolCall.function.name === "render_nonfiction_analysis") {
      return repairNonfictionAnalysis(raw);
    }
    return repairAnalysis(raw);
  } catch (e) {
    console.error("parse error:", e);
    return null;
  }
}

// ---------- SSE helpers ----------

// Returns the SSE frame as a plain string.
// Use sseBytes() when feeding into a ReadableStream controller (needs Uint8Array).
function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
function sseBytes(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(sseFrame(event, data));
}

// ---------- Rate-limit helpers ----------

// Salted SHA-256 of caller IP. Salt lives only on the server (LOVABLE_API_KEY
// reused as salt — already secret, already rotated when keys rotate).
async function hashIp(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}::${ip}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getClientIp(req: Request): string {
  // Supabase edge runtime sits behind a proxy. Trust the leftmost x-forwarded-for entry.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
}

// Budgets — tuned to be invisible to any real reader, lethal to scripted abuse.
const LIMITS = {
  // Real (paid) analyses
  realPerHour: 30,
  realPerDay: 100,
  // Prefetches — cheap on cache hits, free on misses (we short-circuit), so generous.
  prefetchPerHour: 120,
} as const;

// ---------- In-flight deduplication ----------
// Maps cacheKey → Promise that resolves when the Gemini call completes.
// If a second request arrives for the same book while one is in progress,
// it waits for the first to finish and then serves from cache — one Gemini
// call instead of N.
const inFlight = new Map<string, Promise<void>>();

// ---------- Main handler ----------

Deno.serve(async (req) => {
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

  const { title, refinement, previousAnalysis, prefetch, gemini_key: userGeminiKey, reanalyze } = body ?? {};
  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return new Response(JSON.stringify({ error: "Title is required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Accept the user's own Gemini key from the request body (BYOK).
  // If not provided, fall back to the shared server key.
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

  const isRefine = !!refinement && !!previousAnalysis;
  const isReanalyze = !!reanalyze && !isRefine;
  const isPrefetch = !!prefetch && !isRefine && !isReanalyze;
  const { title: cleanTitle, author: cleanAuthor } = splitTitleAuthor(title);
  const cacheKey = buildCacheKey(cleanTitle, cleanAuthor);

  // ---------- Cache-first: skip rate limiting entirely on hits ----------
  // ~90% of requests for popular books are cache hits. Checking the cache
  // before rate-limiting saves 2 DB RPC round-trips on every hit.
  if (!isRefine && !isReanalyze) {
    const { data: cached } = await supabase
      .from("novel_analyses")
      .select("analysis, id, hit_count")
      .eq("cache_key", cacheKey)
      .eq("is_validated", true)
      .maybeSingle();

    if (cached?.analysis) {
      // Bump stats async — never block the response on it.
      supabase
        .from("novel_analyses")
        .update({ hit_count: (cached.hit_count ?? 0) + 1, last_accessed_at: new Date().toISOString() })
        .eq("id", cached.id)
        .then(() => {}).catch((e: any) => console.error("hit bump error:", e));

      const sseBody = [
        sseFrame("status", { text: "Found in library — restoring instantly." }),
        sseFrame("analysis", { analysis: cached.analysis, cached: true, cacheKey }),
        sseFrame("done", {}),
      ].join("");

      console.log(JSON.stringify({ fn: "analyze-novel", outcome: "cache_hit_early", cache_key: cacheKey }));

      return new Response(sseBody, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      });
    }

    // On a cache miss, prefetch requests fall through to generate and cache the
    // analysis — that's the whole point of the seeder. Rate-limiting below uses
    // the generous prefetch budget (120/hr) to prevent abuse.
  }

  // ---------- Deduplication: coalesce concurrent requests for the same book ----------
  // Only for fresh analyses (not refinements, which are user-specific).
  if (!isRefine && !isReanalyze && inFlight.has(cacheKey)) {
    // Another request is already calling Gemini for this book. Wait for it,
    // then serve from cache — zero extra Gemini calls.
    await inFlight.get(cacheKey);
    const { data: cached } = await supabase
      .from("novel_analyses")
      .select("analysis, id, hit_count")
      .eq("cache_key", cacheKey)
      .eq("is_validated", true)
      .maybeSingle();

    if (cached?.analysis) {
      supabase
        .from("novel_analyses")
        .update({ hit_count: (cached.hit_count ?? 0) + 1, last_accessed_at: new Date().toISOString() })
        .eq("id", cached.id)
        .then(() => {}).catch(() => {});

      const sseBody = [
        sseFrame("status", { text: "Found in library — restoring instantly." }),
        sseFrame("analysis", { analysis: cached.analysis, cached: true, cacheKey }),
        sseFrame("done", {}),
      ].join("");

      console.log(JSON.stringify({ fn: "analyze-novel", outcome: "dedup_hit", cache_key: cacheKey }));
      return new Response(sseBody, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      });
    }
    // First request failed to produce a result — fall through and try independently.
  }

  // Register this request as the in-flight owner for this cache key.
  let resolveInFlight!: () => void;
  if (!isRefine && !isReanalyze) {
    const p = new Promise<void>((res) => { resolveInFlight = res; });
    inFlight.set(cacheKey, p);
  }

  // ---------- Rate-limit gate (only reached on cache misses / refinements) ----------
  const ip = getClientIp(req);
  // Use a dedicated salt so rotating the Gemini key doesn't invalidate all
  // rate-limit history, and BYOK users don't get fresh independent buckets.
  // Falls back to the service role key (always present) if not explicitly set.
  const rateLimitSalt =
    Deno.env.get("RATE_LIMIT_SALT") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    "novelviz-rl-default";
  const ipHash = await hashIp(ip, rateLimitSalt);
  const route = "analyze-novel";

  try {
    if (isPrefetch) {
      const { data: count } = await supabase.rpc("count_recent_events", {
        p_ip_hash: ipHash, p_route: route, p_window_seconds: 3600, p_prefetch_only: true,
      });
      if ((count ?? 0) >= LIMITS.prefetchPerHour) {
        return new Response(
          JSON.stringify({ error: "Prefetch rate limit reached." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } },
        );
      }
    } else {
      const [{ data: hourCount }, { data: dayCount }] = await Promise.all([
        supabase.rpc("count_recent_events", {
          p_ip_hash: ipHash, p_route: route, p_window_seconds: 3600, p_prefetch_only: false,
        }),
        supabase.rpc("count_recent_events", {
          p_ip_hash: ipHash, p_route: route, p_window_seconds: 86400, p_prefetch_only: false,
        }),
      ]);
      if ((hourCount ?? 0) >= LIMITS.realPerHour) {
        return new Response(
          JSON.stringify({ error: "You're reading fast! Please wait a minute before requesting another analysis." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "120" } },
        );
      }
      if ((dayCount ?? 0) >= LIMITS.realPerDay) {
        return new Response(
          JSON.stringify({ error: "Daily analysis limit reached. Please try again tomorrow." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "3600" } },
        );
      }
    }

    // Log this request (fire-and-forget — never block on the log write).
    supabase
      .from("rate_limit_events")
      .insert({ ip_hash: ipHash, route, is_prefetch: isPrefetch })
      .then(() => {}, (e: any) => console.error("rl insert error:", e));

    // Opportunistic cleanup ~1% of requests — keeps the table small forever, no cron needed.
    if (Math.random() < 0.01) {
      supabase.rpc("purge_old_rate_limit_events")
        .then(() => {}, (e: any) => console.error("rl purge error:", e));
    }
  } catch (e) {
    // If rate-limit infra fails, fail OPEN (don't block real users on infra hiccups).
    console.error("rate-limit gate error (failing open):", e);
  }

  const t0 = performance.now();
  const metric = (outcome: string, extra: Record<string, unknown> = {}) => {
    try {
      console.log(JSON.stringify({
        fn: "analyze-novel",
        outcome,
        ms: Math.round(performance.now() - t0),
        cache_key: cacheKey,
        is_refine: isRefine,
        is_reanalyze: isReanalyze,
        prefetch,
        model: MODEL,
        ...extra,
      }));
    } catch { /* ignore */ }
  };

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try { controller.enqueue(sseBytes(event, data)); } catch { /* closed */ }
      };

      try {
        // Cache hits and prefetch misses are handled before this stream is opened
        // (cache-first block above). By the time we get here it's always a genuine
        // cache miss that needs a Gemini call.

        // -------- Phase A: preamble + preview (only for fresh analyses) --------
        // Both run concurrently. Preview resolves first (~1s) and lets the
        // frontend show the masthead immediately. Preamble streams a teaser sentence.
        if (!isRefine && !isReanalyze) {
          send("status", { text: "Looking up the work…" });

          // Preview: fire early, send result as soon as it arrives.
          callPreview(GEMINI_API_KEY, title).then((preview) => {
            if (preview && preview.confidence !== "unknown_work") {
              send("analysis_preview", { preview });
            }
          });

          // Preamble: fire-and-stream in parallel with structured call below
          (async () => {
            try {
              const r = await fetch(GEMINI_BASE, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${GEMINI_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: PREAMBLE_MODEL,
                  stream: true,
                  messages: [
                    {
                      role: "system",
                      content:
                        "You are a literary scholar covering fiction and non-fiction alike. In ONE short sentence (max 22 words), confirm a book and tease its shape — narrative arc for fiction, central argument for non-fiction. No preamble like 'Sure'. Start with the title in italics-style markdown (*Title*). Example: '*Beloved* by Toni Morrison — a haunted house, a mother's reckoning, time folding in on itself.'",
                    },
                    { role: "user", content: `Tease the structure of: ${title}` },
                  ],
                }),
              });
              if (!r.ok || !r.body) return;
              const reader = r.body.getReader();
              const decoder = new TextDecoder();
              let buf = "";
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
                  if (json === "[DONE]") return;
                  try {
                    const p = JSON.parse(json);
                    const delta = p.choices?.[0]?.delta?.content;
                    if (delta) send("preamble", { text: delta });
                  } catch { /* partial */ }
                }
              }
            } catch (e) {
              console.error("preamble error:", e);
            }
          })();
        } else if (isReanalyze) {
          send("status", { text: "Re-analyzing…" });
        } else {
          send("status", { text: "Refining the analysis…" });
        }

        // -------- Phase B: structured analysis --------
        const userPrompt = isRefine
          ? `The user previously asked for a visualization of "${title}". Here is the previous analysis JSON:\n\n${JSON.stringify(previousAnalysis)}\n\nThe user now wants to refine the analysis with this prompt: "${refinement}"\n\nReturn an updated full analysis (same schema). Keep ids stable where possible.`
          : `Produce a structured analysis of the book: "${title}"`;

        // Fetch real metadata before calling Gemini (non-blocking — if it fails, proceed without)
        let metadataBlock = "";
        if (!isRefine) {
          try {
            const meta = await fetchBookMetadata(cleanTitle, cleanAuthor);
            metadataBlock = buildMetadataBlock(meta);
          } catch (e) {
            console.warn("metadata fetch failed (non-fatal):", e);
          }
        }

        const enrichedPrompt = metadataBlock
          ? `${metadataBlock}\n${userPrompt}`
          : userPrompt;

        let analysis: Analysis | null;
        try {
          analysis = await callStructuredAnalysis(GEMINI_API_KEY, enrichedPrompt);
        } catch (e: any) {
          if (e.status === 429 || e.status === 503) {
            send("error", { error: "The AI service is overloaded right now. Please try again in a minute.", status: 429 });
          } else {
            send("error", {
              error: "Couldn't analyze this book — it may be too obscure for the AI. Try adding 'by [Author Name]' to the title, or try again in a moment.",
              status: 500,
            });
          }
          controller.close();
          return;
        }

        // Retry on null result (model skipped tool call) OR inadequate result (too few events/chars).
        // Previously only retried on the inadequate branch — null fell straight through to "AI did not
        // return structured output". Now we catch both cases.
        if (!analysis || (!isAdequate(analysis) && analysis.confidence !== "unknown_work")) {
          const retryReason = !analysis ? "null_result" : "inadequate_result";
          console.log("retry:", retryReason);
          const corrective = !analysis
            ? "You MUST call either render_novel_analysis (for fiction) or render_nonfiction_analysis (for non-fiction). Do NOT reply in plain text — always call one of the provided tools with a complete, structured response."
            : "Your previous response was incomplete after server-side validation. Please return at least 6 events and 4 characters with valid laneIds (every event.laneId must match a defined lane.id; every character laneId must match or be an empty string).";
          try {
            const retry = await callStructuredAnalysis(GEMINI_API_KEY, enrichedPrompt, corrective);
            // Accept any non-null retry — even a thin result is better than a hard failure.
            if (retry) analysis = retry;
          } catch (e) {
            console.error("retry error:", e);
          }
        }

        if (!analysis) {
          send("error", { error: "AI did not return structured output", status: 500 });
          controller.close();
          return;
        }

        // -------- Cache write (only fresh analyses with real content) --------
        // Build the canonical key from what the AI actually identified.
        // This normalises title variants so "Sapiens" and "Sapiens by Harari"
        // share a single cache slot instead of generating two Gemini calls.
        const canonicalCacheKey =
          (!isRefine || isReanalyze) && analysis.confidence !== "unknown_work"
            ? buildCacheKey(analysis.title || cleanTitle, analysis.author || cleanAuthor)
            : cacheKey;

        if ((!isRefine || isReanalyze) && analysis.confidence !== "unknown_work" && isAdequate(analysis)) {
          // isReanalyze: ignoreDuplicates:false → overwrites the stale cached entry.
          // Fresh analyses: ignoreDuplicates:true → races between isolates silently no-op.
          const { error: upsertErr } = await supabase
            .from("novel_analyses")
            .upsert({
              cache_key: canonicalCacheKey,
              title: analysis.title || cleanTitle,
              author: analysis.author || cleanAuthor || "",
              analysis,
              model: MODEL,
              is_validated: true,
            }, { onConflict: "cache_key", ignoreDuplicates: !isReanalyze });
          if (upsertErr) console.error("cache write error:", upsertErr);

          // Also write an alias under the raw input key if it differs from
          // the canonical one — ensures this exact search string is a cache
          // hit next time without another Gemini call.
          if (canonicalCacheKey !== cacheKey) {
            await supabase
              .from("novel_analyses")
              .upsert({
                cache_key: cacheKey,
                title: analysis.title || cleanTitle,
                author: analysis.author || cleanAuthor || "",
                analysis,
                model: MODEL,
                is_validated: true,
              }, { onConflict: "cache_key", ignoreDuplicates: !isReanalyze })
              .then(() => {})
              .catch((e: any) => console.error("alias write error:", e));
          }
        }

        // Send the canonical key to the frontend so shelf/compare/DNA always
        // reference the same slot regardless of how the title was typed.
        send("analysis", { analysis, cached: false, cacheKey: canonicalCacheKey });
        send("done", {});
        metric("fresh", {
          characters: analysis.characters?.length ?? 0,
          events: analysis.events?.length ?? 0,
        });
        // Unblock any requests that were waiting on this in-flight call.
        if (resolveInFlight) { resolveInFlight(); inFlight.delete(cacheKey); }
        controller.close();
      } catch (e) {
        console.error("handler error:", e);
        send("error", { error: e instanceof Error ? e.message : "Unknown error", status: 500 });
        metric("error", { message: e instanceof Error ? e.message : String(e) });
        // Unblock waiters even on failure so they can retry independently.
        if (resolveInFlight) { resolveInFlight(); inFlight.delete(cacheKey); }
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
});
