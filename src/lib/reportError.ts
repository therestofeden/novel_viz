// Client error capture (B2). First-party, no cookies, never throws, never blocks UI.
// Dedupes per session and caps volume so an error loop cannot flood the endpoint.
const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/report-error`;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const MAX_PER_SESSION = 10;

export type ErrorSource = "boundary" | "window" | "promise";
const seen = new Set<string>();

function fnv(str: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < str.length; i++) {
    h1 = Math.imul(h1 ^ str.charCodeAt(i), 0x01000193) >>> 0;
    h2 = Math.imul(h2 + str.charCodeAt(i), 0x85ebca6b) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

function pageName(): string {
  const seg = location.pathname.split("/").filter(Boolean)[0] ?? "home";
  return /^[a-z0-9_-]{1,32}$/i.test(seg) ? seg : "unknown";
}

// Benign noise that is not actionable.
const IGNORE = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ResizeObserver loop|Script error\.?$|AbortError|Load failed|NetworkError when attempting/i;

export function reportError(err: unknown, source: ErrorSource) {
  try {
    if (!KEY || seen.size >= MAX_PER_SESSION) return;
    const e = err instanceof Error ? err : new Error(typeof err === "string" ? err : "non-error thrown");
    const message = String(e.message || e.name || "unknown").slice(0, 500);
    if (IGNORE.test(message)) return;
    const stack = e.stack ? e.stack.split("\n").slice(0, 12).join("\n") : "";
    const fingerprint = fnv(`${source}|${message}|${stack.split("\n")[1] ?? ""}`);
    if (seen.has(fingerprint)) return;
    seen.add(fingerprint);
    void fetch(ENDPOINT, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        fingerprint, source, message, stack, page: pageName(),
        release: (import.meta.env.VITE_RELEASE as string | undefined)?.slice(0, 40),
      }),
    }).catch(() => {});
  } catch { /* reporting must never surface errors */ }
}

export function installErrorReporting() {
  window.addEventListener("error", (ev) => reportError(ev.error ?? ev.message, "window"));
  window.addEventListener("unhandledrejection", (ev) => reportError(ev.reason, "promise"));
}
