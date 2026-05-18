# Backend upgrade: cache, stream, validate

Three improvements to the `analyze-novel` flow. They're independent but ship together so the UX jump is felt all at once.

---

## 1. Persistent analysis cache

**New table** `public.novel_analyses`:
- `id` uuid pk
- `cache_key` text unique — normalized `lower(trim(title)) + '||' + lower(trim(author))` (author empty string if unknown)
- `title` text, `author` text
- `analysis` jsonb — the full validated payload
- `model` text — which model produced it (so we can invalidate later)
- `hit_count` int default 0
- `created_at`, `last_accessed_at` timestamptz

**RLS**: public `SELECT` (anyone can read cached analyses — they're not user data), no public `INSERT/UPDATE/DELETE`. Edge function writes via service role.

**Edge function flow change**:
1. Compute `cache_key` from request (title + optional author from autocomplete pick).
2. `SELECT` from cache. On hit → bump `hit_count`/`last_accessed_at`, return immediately (target <300ms).
3. On miss → call Gemini, validate (step 3 below), `INSERT` row, return.
4. Refinement requests (`refinement` + `previousAnalysis`) **bypass cache** — they're user-specific iterations.

Index on `cache_key`. Optional later: a `popular_searches` view ordered by `hit_count` for a future "Trending" section — schema supports it from day one.

---

## 2. Streaming progress feedback

The structured tool-call output can't be partially streamed cleanly, so we use a **two-channel approach** in the same edge function:

- Switch endpoint to **SSE** (`text/event-stream`).
- Phase A (fast): stream a short narrative preamble from `gemini-2.5-flash-lite` ("Found *Beloved* by Toni Morrison. Mapping 3 narrative threads across past and present…") — tokens appear in ~500ms. Emit as `event: status` SSE frames.
- Phase B (parallel): the structured `render_novel_analysis` tool call runs concurrently. When it resolves and validates, emit `event: analysis` with the final JSON payload, then `event: done`.
- On cache hit, skip phase A entirely and emit `event: analysis` immediately.

**Frontend** (`src/pages/Index.tsx`):
- Replace `supabase.functions.invoke` with a `fetch` to the function URL that reads the SSE stream (pattern from the AI gateway streaming docs).
- Show streamed status text in the loading card (replaces today's static "Analyzing…" spinner) so the user sees real progress.
- On `event: analysis`, set the analysis state exactly like today.
- Handle `429`/`402`/`500` with the existing toast logic.

---

## 3. Server-side validation + repair

Add a Zod schema in the edge function mirroring `analysisTool.parameters`. After Gemini returns:

**Hard repairs** (silent, always applied):
- Drop any `event` whose `laneId` doesn't match a defined lane.
- Drop any `relationship` whose `fromId`/`toId` doesn't match a defined character.
- Drop any `character.laneId` that's invalid → coerce to `""`.
- Clamp `position` and `introducedAt` to `0–100`.
- Cap `characters` at 14 and `events` at 14 (keep highest-confidence first).

**Spacing repair**:
- Per lane, sort events by `position`. If two events are within 4 units, nudge the later one forward; if that pushes past 100 or collides again, drop the lower-confidence one.

**Retry-once guard**:
- If after repair we have <3 events or <2 characters, fire a single corrective re-prompt: "Your previous response was incomplete after validation. Please return at least 6 events and 4 characters with valid laneIds."
- If still bad, return a `confidence: "unknown_work"` shaped payload so the UI shows its existing "we couldn't map this" state instead of crashing.

Validated payload is what gets cached — the cache never stores broken data.

---

## Files touched

- **migration**: create `novel_analyses` table + RLS + index.
- **`supabase/functions/analyze-novel/index.ts`**: add Zod, cache lookup/write via service-role client, switch response to SSE, add preamble call, add validation + retry.
- **`src/pages/Index.tsx`**: switch from `functions.invoke` to streaming `fetch`, render live status text in the loading state.
- (no changes to TimelineView, CharacterNetwork, or the analysis schema itself — same payload shape downstream.)

## Out of scope (intentionally)

- Per-IP rate limiting — flagged as honorable mention; can ship next round once we see real traffic.
- Trending/popular UI — the schema supports it but no UI work this pass.
- Cache invalidation UI — `model` column lets us bulk-invalidate later via SQL when we upgrade models.
