// Pure validation for submit-feedback (unit-testable without Deno/Supabase).
export const KINDS = new Set(["general", "bug", "idea", "praise"]);
const SESSION_RE = /^[A-Za-z0-9_-]{8,64}$/;
const PAGE_RE = /^[a-z0-9_-]{1,32}$/i;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,198}$/i;

export interface CleanFeedback {
  message: string; page: string; slug: string | null; kind: string; session_id: string | null;
}

export function validateFeedback(body: unknown): CleanFeedback | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.message !== "string") return null;
  // Strip control chars (keep \n and \t), collapse trailing space, cap length.
  const message = b.message.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, 2000);
  if (message.length < 3) return null;
  const page = typeof b.page === "string" && PAGE_RE.test(b.page) ? b.page : "unknown";
  const slug = typeof b.slug === "string" && SLUG_RE.test(b.slug) ? b.slug : null;
  const kind = typeof b.kind === "string" && KINDS.has(b.kind) ? b.kind : "general";
  const session_id = typeof b.session_id === "string" && SESSION_RE.test(b.session_id) ? b.session_id : null;
  return { message, page, slug, kind, session_id };
}
