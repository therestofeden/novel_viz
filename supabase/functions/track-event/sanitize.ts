// Pure validation for track-event (unit-testable without Deno/Supabase).
export const ALLOWED_EVENTS = new Set([
  "signup", "search_submitted", "analysis_viewed", "shelf_add", "rating_set",
  "note_saved", "recommendation_clicked", "feedback_sent", "session_start",
]);
export const MAX_EVENTS_PER_REQUEST = 20;
export const MAX_PROPS_BYTES = 1024;
const SESSION_RE = /^[A-Za-z0-9_-]{8,64}$/;

export interface CleanEvent { event: string; session_id: string; props: Record<string, string | number | boolean | null>; }

/** Keep only flat scalar props, short keys/strings, total serialized size capped. */
export function cleanProps(raw: unknown): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  let n = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (n >= 12) break;
    if (!/^[a-z0-9_]{1,32}$/i.test(k)) continue;
    if (typeof v === "string") out[k] = v.slice(0, 200);
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean" || v === null) out[k] = v;
    else continue;
    n++;
  }
  while (JSON.stringify(out).length > MAX_PROPS_BYTES) {
    const keys = Object.keys(out);
    delete out[keys[keys.length - 1]];
  }
  return out;
}

export function validateBatch(body: unknown): CleanEvent[] | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { session_id?: unknown; events?: unknown };
  if (typeof b.session_id !== "string" || !SESSION_RE.test(b.session_id)) return null;
  if (!Array.isArray(b.events) || b.events.length === 0 || b.events.length > MAX_EVENTS_PER_REQUEST) return null;
  const out: CleanEvent[] = [];
  for (const e of b.events) {
    if (!e || typeof e !== "object") continue;
    const name = (e as { event?: unknown }).event;
    if (typeof name !== "string" || !ALLOWED_EVENTS.has(name)) continue;
    out.push({ event: name, session_id: b.session_id, props: cleanProps((e as { props?: unknown }).props) });
  }
  return out.length ? out : null;
}
