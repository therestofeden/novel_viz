// Pure validation/scrubbing for report-error (unit-testable without Deno/Supabase).
export const SOURCES = new Set(["boundary", "window", "promise"]);
const PAGE_RE = /^[a-z0-9_-]{1,32}$/i;
const FP_RE = /^[a-f0-9]{8,64}$/i;
const REL_RE = /^[A-Za-z0-9._-]{1,40}$/;

/** Remove query strings/fragments from URLs, emails, long tokens and control chars. */
export function scrub(s: string, max: number): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/(https?:\/\/[^\s?#)]+)[?#][^\s)]*/g, "$1")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/\b(eyJ[\w-]{10,}\.[\w-]+\.[\w-]+|[A-Za-z0-9_-]{32,})\b/g, "[token]")
    .trim()
    .slice(0, max);
}

export interface CleanError {
  p_fingerprint: string; p_source: string; p_message: string; p_stack: string | null;
  p_page: string; p_release: string | null; p_user_agent: string | null;
}

export function validateError(body: unknown, ua: string | null): CleanError | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.message !== "string" || typeof b.fingerprint !== "string") return null;
  if (!FP_RE.test(b.fingerprint) || typeof b.source !== "string" || !SOURCES.has(b.source)) return null;
  const message = scrub(b.message, 500);
  if (!message) return null;
  const stack = typeof b.stack === "string" && b.stack ? scrub(b.stack, 3000) : null;
  const page = typeof b.page === "string" && PAGE_RE.test(b.page) ? b.page : "unknown";
  const release = typeof b.release === "string" && REL_RE.test(b.release) ? b.release : null;
  return {
    p_fingerprint: b.fingerprint.toLowerCase(), p_source: b.source, p_message: message,
    p_stack: stack, p_page: page, p_release: release,
    p_user_agent: ua ? ua.replace(/[\u0000-\u001F\u007F]/g, "").slice(0, 200) : null,
  };
}
