// scripts/check-body-limit-guards.ts
//
// CI guard added 2026-09-26 (daily_backend audit). All 7 JSON-body-
// accepting edge functions (analyze-novel, dna-consensus,
// recommend-anti-shelf, recommend-by-dna, resolve-buy-link, seed-cache,
// takeaways) were fixed by hand on 2026-09-18 to read their incoming
// request body through the shared, byte-capped readJsonBodyBounded()
// reader instead of a bare `req.json()` -- closing a compute/memory-
// exhaustion DoS surface where a huge or maliciously-nested body gets
// fully buffered and parsed before any size check ever runs (see
// _shared/body-limit.ts's own top-of-file comment for the full writeup).
//
// That fix, like the timeout-guard class the 2026-09-25 audit machine-
// checked, was applied to every call site that existed at the time, but
// nothing stops a new function -- or a future edit to an existing one --
// from reintroducing a bare `req.json()`/`req.text()`/`req.arrayBuffer()`/
// `req.blob()`/`req.formData()` call and silently reopening the same class
// of bug. There is no live gap today (confirmed by hand across every
// current function before writing this script -- all 7 call sites still
// use readJsonBodyBounded, and search-books/popular-books/health/db-
// maintenance don't read a body at all). But the timeout-guard history is
// exactly this codebase's real failure mode: a bug class gets fixed
// everywhere by hand, then quietly regresses one file at a time, a full
// audit cycle after it lands. This closes the loop before it opens instead
// of after, the same way check-timeout-guards.ts already does for its bug
// class.
//
// What this checks: for every top-level `Deno.serve(async (X) => {...})` /
// `serve(async (X) => {...})` request handler in
// `supabase/functions/*/index.ts`, a bare `X.json(`/`X.text(`/
// `X.arrayBuffer(`/`X.blob(`/`X.formData(` call on the handler's own
// request parameter is flagged, unless silenced with a
// `// body-limit-ignore: <reason>` comment on one of the lines immediately
// above.
//
// What this deliberately does NOT flag: `.json()`/`.text()`/etc. called on
// anything other than the handler's own request parameter -- e.g. `await
// res.json()` or `await r.text()` parsing a *response* from an outbound
// fetch (Gemini, Google Books, ...) is not a request-body read and isn't
// the vector this guards against. Matching only the literal request-
// parameter identifier (not just any `.json(`) is what keeps this from
// flagging the many legitimate outbound-fetch-response reads already
// throughout this codebase.
//
// Run: deno run --allow-read scripts/check-body-limit-guards.ts
// Exits 1 (and prints every finding) if any bare, unguarded request-body
// read is found; exits 0 otherwise. Wired into `edge-functions-test` in
// ci.yml alongside check-timeout-guards.ts.

const ROOT = new URL("../supabase/functions/", import.meta.url);

// Matches the request parameter's identifier off a top-level handler
// registration, tolerating an inline type annotation
// (`Deno.serve(async (req: Request) => {`) since `\b...\b` around the
// identifier stops at the `:` either way.
const HANDLER_RE = /\b(?:Deno\.serve|serve)\s*\(\s*async\s*\(\s*([A-Za-z_$][\w$]*)\b/;

const BARE_READ_METHODS = ["json", "text", "arrayBuffer", "blob", "formData"];

const IGNORE_LOOKBACK = 8;

function isCommentLine(line: string): boolean {
  return line.trim().startsWith("//") || line.trim().startsWith("*");
}

function isIgnored(lines: string[], idx: number): boolean {
  for (let i = idx - 1; i >= Math.max(0, idx - IGNORE_LOOKBACK); i--) {
    if (!isCommentLine(lines[i])) break;
    if (/body-limit-ignore/.test(lines[i])) return true;
  }
  return false;
}

// Finds the identifier bound as the request parameter of this file's
// handler (first `Deno.serve(async (X) => ` / `serve(async (X) => ` match
// wins -- every function in this codebase registers exactly one handler).
function findRequestParamName(lines: string[]): string | null {
  for (const line of lines) {
    const m = HANDLER_RE.exec(line);
    if (m) return m[1];
  }
  return null;
}

// Pure, file-system-free core: given a file's lines, returns the 0-indexed
// line numbers of bare request-body reads on the handler's own request
// parameter. Exported so check-body-limit-guards.test.ts can exercise the
// heuristic directly against small fixtures instead of writing files to
// disk.
export function findViolationLines(lines: string[]): number[] {
  const paramName = findRequestParamName(lines);
  if (!paramName) return [];

  const bareReadRe = new RegExp(
    `\\b${paramName}\\.(?:${BARE_READ_METHODS.join("|")})\\s*\\(`,
  );

  const out: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentLine(line)) continue;
    if (!bareReadRe.test(line)) continue;
    if (isIgnored(lines, i)) continue;
    out.push(i);
  }
  return out;
}

interface Finding {
  file: string;
  line: number;
  text: string;
}

// Only the top-level `supabase/functions/<name>/index.ts` files are
// request handlers -- `_shared/*.ts` has no `Deno.serve`/`serve` call of
// its own (findRequestParamName correctly returns null for it regardless,
// but scoping the scan this way keeps the intent -- "every function's
// entry point" -- explicit rather than incidental).
async function collectHandlerFiles(dir: URL): Promise<URL[]> {
  const out: URL[] = [];
  for await (const entry of Deno.readDir(dir)) {
    if (!entry.isDirectory || entry.name.startsWith("_") || entry.name.startsWith(".")) {
      continue;
    }
    const indexUrl = new URL(`${entry.name}/index.ts`, dir);
    try {
      await Deno.stat(indexUrl);
      out.push(indexUrl);
    } catch {
      // No index.ts in this directory -- skip.
    }
  }
  return out;
}

async function checkFile(url: URL): Promise<Finding[]> {
  const text = await Deno.readTextFile(url);
  const lines = text.split("\n");
  return findViolationLines(lines).map((i) => ({
    file: url.pathname,
    line: i + 1,
    text: lines[i].trim(),
  }));
}

async function main() {
  const files = await collectHandlerFiles(ROOT);
  const allFindings: Finding[] = [];

  for (const file of files) {
    allFindings.push(...await checkFile(file));
  }

  if (allFindings.length === 0) {
    console.log(
      `check-body-limit-guards: OK -- every request handler across ${files.length} functions reads its body through a bounded reader.`,
    );
    Deno.exit(0);
  }

  console.error(
    `check-body-limit-guards: found ${allFindings.length} bare, unbounded request-body read(s):\n`,
  );
  for (const f of allFindings) {
    const rel = f.file.replace(/^.*\/supabase\/functions\//, "supabase/functions/");
    console.error(`  ${rel}:${f.line}: ${f.text}`);
  }
  console.error(
    `\nRead the body through readJsonBodyBounded(...) (see _shared/body-limit.ts) instead of a bare req.json()/req.text()/req.arrayBuffer()/req.blob()/req.formData(), or add ` +
      `"// body-limit-ignore: <reason>" on a line above if this read is genuinely already bounded some other way.`,
  );
  Deno.exit(1);
}

// Only run when executed directly (`deno run .../check-body-limit-guards.ts`),
// not when imported by check-body-limit-guards.test.ts -- otherwise
// importing this module for its exports would also call Deno.exit() mid
// test run.
if (import.meta.main) {
  await main();
}
