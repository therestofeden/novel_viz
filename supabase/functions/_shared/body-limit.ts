// Shared bounded JSON body reader for all POST-accepting edge functions.
//
// 2026-09-18 (daily backend audit): every function that accepts a JSON body
// (analyze-novel, dna-consensus, recommend-anti-shelf, recommend-by-dna,
// resolve-buy-link, seed-cache, takeaways) called the bare `req.json()` and
// only bounded individual *fields* (title/refinement/axes/etc.) — several
// with an explicit comment about exactly this class of risk ("an unbounded
// input is a free request-to-response amplification vector") — but nothing
// bounded the *body itself* before that parse. `req.json()` fully buffers
// and decodes the entire request body into memory before any application
// code, including those field-length checks, ever runs. A POST with a
// multi-hundred-MB body (or one exploiting JSON's ability to nest
// cheaply — a few KB on the wire expanding into a huge parsed object graph)
// forces every edge function isolate to pay the full memory/CPU cost of
// buffering and parsing it before rejecting anything, on every attempt,
// with no retry cost to the attacker. That's a compute/memory-exhaustion
// DoS surface distinct from (and unaddressed by) both the per-IP rate
// limiter (which only caps request *count*, not per-request cost) and the
// existing post-parse field caps (which run too late to matter here).
// analyze-novel's previousAnalysis cap is the sharpest example: it measures
// `JSON.stringify(previousAnalysis).length` — meaning a huge previousAnalysis
// payload is already fully parsed into live V8 objects, then immediately
// re-serialized, before its size is ever checked.
//
// Fix: read the body as a stream and enforce a hard byte ceiling *while*
// reading (aborting the read the instant the cap is crossed, before
// decoding or parsing anything), with a Content-Length fast-path to reject
// honestly-labeled oversized requests without reading a single byte at all.
// A dishonest/missing Content-Length still can't get past the streaming
// check — the true cost bound is the byte cap, not the header. Mirrors this
// project's existing shared-module pattern (cors.ts, rate-limit.ts,
// secret-auth.ts) rather than copy-pasting a bespoke reader into 7 files.
export class PayloadTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`Request body too large (max ${maxBytes} bytes)`);
    this.name = "PayloadTooLargeError";
  }
}

/**
 * Reads and JSON-parses a request body, enforcing `maxBytes` as a hard
 * ceiling on the raw byte count actually read off the wire (independent of
 * any client-supplied Content-Length). Throws `PayloadTooLargeError` if the
 * body exceeds the cap, or a `SyntaxError` for malformed JSON (matching
 * `req.json()`'s own failure mode) — callers keep their existing catch
 * blocks and only need one extra `instanceof PayloadTooLargeError` branch.
 */
export async function readJsonBodyBounded(req: Request, maxBytes: number): Promise<unknown> {
  const declaredLen = req.headers.get("content-length");
  if (declaredLen && Number(declaredLen) > maxBytes) {
    throw new PayloadTooLargeError(maxBytes);
  }

  if (!req.body) return JSON.parse("");

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.byteLength > 0) {
        total += value.byteLength;
        if (total > maxBytes) {
          throw new PayloadTooLargeError(maxBytes);
        }
        chunks.push(value);
      }
    }
  } finally {
    // Always release the reader; on the throw path this also aborts pulling
    // any further bytes for an oversized body instead of draining it.
    try { reader.releaseLock(); } catch { /* already released/closed */ }
  }

  const buf = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.byteLength;
  }
  const text = new TextDecoder().decode(buf);
  return JSON.parse(text);
}
