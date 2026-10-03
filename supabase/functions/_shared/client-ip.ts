// Shared, spoof-resistant client-IP extraction for every rate-limit / abuse
// / Gemini-spend-budget check in this codebase.
//
// Added 2026-10-03 (daily_backend audit). Every function that keys a rate
// limit or budget on the caller's IP (analyze-novel, search-books,
// popular-books, takeaways, recommend-by-dna, recommend-anti-shelf,
// dna-consensus) independently re-implemented `getClientIp`, and 6 of the 7
// copies read ONLY the leftmost entry of `x-forwarded-for`. That is exactly
// the one entry a client always controls: X-Forwarded-For is additive --
// each hop is supposed to *append* the address it observed, never overwrite
// the front of the list -- so sending one extra header,
// `X-Forwarded-For: <anything>`, was enough to make every per-IP rate limit
// and Gemini-spend budget in the app key on an attacker-chosen value
// instead of a real address. That's a one-line bypass of the exact
// protection analyze-novel's own `LIMITS` comment describes as "tuned to be
// invisible to any real reader, lethal to scripted abuse" -- it was neither,
// against anyone who read this file.
//
// This project's edge-functions domain is served through Cloudflare
// (confirmed live, 2026-10-03: an OPTIONS request to this project's own
// `/functions/v1/seed-cache` endpoint returned `server: cloudflare` and a
// `cf-ray` header). Cloudflare's documented behavior is to always overwrite
// any client-supplied `CF-Connecting-IP` with the address it actually saw
// on the TCP connection -- a client cannot inject or override this value,
// unlike `X-Forwarded-For`, which Cloudflare (and Supabase's own gateway
// behind it) only ever *appends* to. `cf-connecting-ip` is therefore the
// one signal here that is not attacker-controlled, and is tried first.
//
// `x-forwarded-for` is kept only as a degraded fallback for the rare case
// `cf-connecting-ip` is missing -- and even then this helper reads the
// RIGHTMOST entry, not the leftmost: the rightmost is the one most
// recently *appended* by the hop closest to this function, while every
// entry to its left is whatever the client (or an earlier, less-trusted
// hop) wrote. Reading the leftmost entry was the original bug.
//
// Fails open to "unknown" if nothing usable is present, matching every
// prior call site's behavior -- a missing IP degrades a rate limit to
// "can't key this request," never a crash or a 500.
export function getClientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;

  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }

  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;

  return "unknown";
}
