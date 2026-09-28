// scripts/check-handler-safety-net-guards.ts
//
// CI guard added 2026-09-28 (daily_backend audit), mirroring
// check-timeout-guards.ts / check-body-limit-guards.ts /
// check-error-leak-guards.ts for a fourth repeated bug class in this same
// family: analyze-novel's handler carries an explicit, deliberate comment
// ("Safety net: everything below ... must return a Response that carries
// corsHeaders") wrapping its ENTIRE post-OPTIONS body in one top-level
// try/catch, specifically because Deno's default unhandled-error response
// has no Access-Control-Allow-Origin header -- the browser then reports a
// bare "TypeError: Failed to fetch" to client code, indistinguishable from
// a real network outage. That same full-handler wrap was independently
// re-derived, by hand, in recommend-anti-shelf, recommend-by-dna,
// dna-consensus, popular-books, search-books, and resolve-buy-link -- 7 of
// this project's 10 edge functions ended up with it -- but never written
// down as a rule, so it never propagated to the other 3: takeaways (its
// try/catch covered only the initial body-parse step; the entire
// "questions"-phase and most of the "synthesize"-phase setup ran fully
// unguarded), seed-cache (same shape: only the body-parse step was
// covered), and db-maintenance (no top-level try/catch at all). Fixed by
// hand for all three in this same commit; this script exists so a future
// function, or a future edit that narrows an existing wrap back down to
// just the body-parse step, can't silently reopen the gap a full audit
// cycle later.
//
// What this checks: every `(?:Deno\.)?serve(async (req) => {`-shaped
// handler in `supabase/functions/**/*.ts` must have a try/catch that is a
// DIRECT child of the handler body (not nested inside an if/for/inner
// arrow function -- this is determined by real brace-depth tracking, not
// indentation: this codebase does NOT re-indent a try nested one level
// deeper, e.g. recommend-by-dna's inner body-parse try is written at the
// exact same 2-space column as its outer safety-net try, so indentation
// alone can't tell them apart) whose try/catch(/finally) span covers most
// of the handler, with a catch clause present, and `corsHeaders` + `new
// Response(` both appearing somewhere inside that catch clause's own body.
//
// This is intentionally the same fast, grep-adjacent heuristic style as
// its three siblings, not a real type-aware analyzer -- it does real brace
// counting (character-by-character, tracking a single running depth) to
// find statement boundaries, but has no idea what a string or comment is,
// so a `{`/`}` character inside a string literal could in principle throw
// it off. This codebase's actual style never does that (object literals
// use real braces that balance within the same statement, which is all
// this script relies on).
//
// A handler legitimately structured differently (see health/index.ts,
// whose several short, independently-guarded checks never throw past their
// own try/catch and whose final response only serializes already-safe
// primitives -- no wrap needed) should be silenced with a
// `// safety-net-ignore: <reason>` comment on the line directly above its
// `(?:Deno\.)?serve(async (req) => {` line, rather than special-cased here.
//
// Run: deno run --allow-read scripts/check-handler-safety-net-guards.ts
// Exits 1 (and prints every finding) if any handler lacks a full-body
// safety net; exits 0 otherwise. Wired into `edge-functions-test` in
// ci.yml alongside the other three guards.

const ROOT = new URL("../supabase/functions/", import.meta.url);

const SPAN_RATIO_MIN = 0.4;

const HANDLER_RE = /^(?:Deno\.)?serve\(async \(req(?::\s*Request)?\)\s*=>\s*\{\s*$/;
const TRY_RE = /^\s*try\s*\{\s*$/;
const CLOSE_CONTINUATION_RE = /^\s*\}\s*(catch|finally)\b/;
const CORS_HEADERS_RE = /\bcorsHeaders\b/;
const NEW_RESPONSE_RE = /new Response\(/;

export interface HandlerFinding {
  line: number; // 1-indexed line of the `serve(async (req) => {` itself
  reason: string;
}

function isCommentLine(line: string): boolean {
  return line.trim().startsWith("//") || line.trim().startsWith("*");
}

const IGNORE_LOOKBACK = 12;
function isIgnored(lines: string[], handlerIdx: number): boolean {
  for (let i = handlerIdx - 1; i >= Math.max(0, handlerIdx - IGNORE_LOOKBACK); i--) {
    if (!isCommentLine(lines[i])) break;
    if (/safety-net-ignore/.test(lines[i])) return true;
  }
  return false;
}

interface ScanPos {
  line: number;
  char: number; // index just after the char that hit targetDepth
}

// Scans forward character-by-character from (startLine, startChar) with a
// running brace depth starting at startDepth, and returns the position
// immediately after the first character that brings depth down to
// targetDepth. This is real bracket matching (not line-based), so it's
// immune to this codebase's habit of not re-indenting nested blocks, and
// to multiple braces sharing one line (e.g. inline object literals in a
// `new Response(JSON.stringify({ ... }), { ... })` call, or a closing
// `} catch (e) {` that both closes and reopens on the same line).
function scanToDepth(
  lines: string[],
  startLine: number,
  startChar: number,
  startDepth: number,
  targetDepth: number,
): ScanPos | null {
  let depth = startDepth;
  for (let li = startLine; li < lines.length; li++) {
    const line = lines[li];
    const from = li === startLine ? startChar : 0;
    for (let ci = from; ci < line.length; ci++) {
      const ch = line[ci];
      if (ch === "{") {
        depth++;
        if (depth === targetDepth) return { line: li, char: ci + 1 };
      } else if (ch === "}") {
        depth--;
        if (depth === targetDepth) return { line: li, char: ci + 1 };
      }
    }
  }
  return null;
}

// depthAtLineStart[k] = brace depth immediately BEFORE line (handlerStart + k)
// is processed, with the handler's own body counted as depth 1 (i.e. depth
// right after the `serve(async (req) => {` line's own opening brace).
function computeDepthAtLineStart(lines: string[], handlerStart: number, handlerEnd: number): number[] {
  const out: number[] = [];
  let depth = 0;
  for (let li = handlerStart; li <= handlerEnd; li++) {
    out.push(depth);
    for (const ch of lines[li]) {
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
  }
  return out;
}

function findHandlerEnd(lines: string[], startIdx: number): number {
  const pos = scanToDepth(lines, startIdx, 0, 0, 0);
  return pos ? pos.line : lines.length - 1;
}

// Given a body-level (depth 1) `try {` at `tryLine`, walks its full
// try/catch/finally chain via real bracket matching and returns the
// chain's end line plus, if present, the line of its (last) `catch`
// clause. Returns null if the chain's structure can't be resolved (should
// not happen for syntactically valid input).
function resolveTryChain(lines: string[], tryLine: number): { endLine: number; catchLine: number | null } | null {
  // Depth right after the try line's own `{` is 2 (1 = handler body, the
  // try line itself doesn't add extra chars we need to scan past -- start
  // the scan at the try line's own open-brace position by scanning the
  // whole chain from char 0 of that line at depth 1, targeting 1 again to
  // land on the try body's own close).
  let cursor: ScanPos | null = { line: tryLine, char: 0 };
  let depth = 1;
  let catchLine: number | null = null;

  while (true) {
    const close = scanToDepth(lines, cursor.line, cursor.char, depth, 1);
    if (!close) return null;
    // Does a `catch` or `finally` immediately continue right where we just
    // closed? (Same codebase convention every time: `} catch (e) {` /
    // `} finally {` fully on one line.)
    const rest = lines[close.line].slice(close.char);
    const m = CLOSE_CONTINUATION_RE.test("}" + rest) ? rest.match(/^\s*(catch|finally)\b/) : null;
    if (!m) {
      // True end of the whole try/catch/finally statement.
      return { endLine: close.line, catchLine };
    }
    if (m[1] === "catch") catchLine = close.line;
    // Continue scanning from just after this clause's own opening `{`.
    const reopen = scanToDepth(lines, close.line, close.char, 1, 2);
    if (!reopen) return null;
    cursor = reopen;
    depth = 2; // back inside the clause body we just opened
  }
}

// Pure, file-system-free core: given a file's lines, returns one finding
// per handler that lacks a full-body safety net. Exported so
// check-handler-safety-net-guards.test.ts can exercise the heuristic
// directly against small fixtures instead of writing files to disk.
export function findHandlerFindings(lines: string[]): HandlerFinding[] {
  const out: HandlerFinding[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (!HANDLER_RE.test(lines[i])) continue;
    if (isIgnored(lines, i)) continue;

    const handlerStart = i;
    const handlerEnd = findHandlerEnd(lines, handlerStart);
    const span = handlerEnd - handlerStart;

    const depthAtStart = computeDepthAtLineStart(lines, handlerStart, handlerEnd);
    // The FIRST body-level (depth 1) `try {` is the candidate safety net --
    // in every compliant handler observed in this codebase, nothing
    // legitimate precedes it structurally.
    let tryLine: number | null = null;
    for (let j = handlerStart + 1; j < handlerEnd; j++) {
      if (depthAtStart[j - handlerStart] === 1 && TRY_RE.test(lines[j])) {
        tryLine = j;
        break;
      }
    }

    if (tryLine === null) {
      out.push({
        line: handlerStart + 1,
        reason: "no top-level try/catch found in this handler",
      });
      continue;
    }

    const chain = resolveTryChain(lines, tryLine);
    if (!chain) {
      out.push({
        line: handlerStart + 1,
        reason: "couldn't resolve the top-level try's structure (unbalanced braces?)",
      });
      continue;
    }
    if (chain.catchLine === null) {
      out.push({
        line: handlerStart + 1,
        reason: "top-level try has no catch clause (try/finally alone doesn't produce a Response on error)",
      });
      continue;
    }

    const wrappedSpan = chain.endLine - tryLine;
    if (span <= 0 || wrappedSpan / span < SPAN_RATIO_MIN) {
      out.push({
        line: handlerStart + 1,
        reason:
          `top-level try/catch only wraps ${wrappedSpan} of this handler's ~${span} lines ` +
          `(need >= ${Math.round(SPAN_RATIO_MIN * 100)}%) -- looks like it guards a narrow ` +
          `step (e.g. body parsing) rather than the whole handler`,
      });
      continue;
    }

    const catchBody = lines.slice(chain.catchLine, chain.endLine + 1).join("\n");
    if (!NEW_RESPONSE_RE.test(catchBody)) {
      out.push({
        line: handlerStart + 1,
        reason: "outer catch block doesn't return a new Response(...)",
      });
      continue;
    }
    if (!CORS_HEADERS_RE.test(catchBody)) {
      out.push({
        line: handlerStart + 1,
        reason: "outer catch block's response doesn't reference corsHeaders",
      });
      continue;
    }
  }

  return out;
}

async function collectTsFiles(dir: URL): Promise<URL[]> {
  const out: URL[] = [];
  for await (const entry of Deno.readDir(dir)) {
    if (entry.name.startsWith(".")) continue;
    const child = new URL(entry.name + (entry.isDirectory ? "/" : ""), dir);
    if (entry.isDirectory) {
      out.push(...await collectTsFiles(child));
    } else if (
      entry.isFile && entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".test.ts")
    ) {
      out.push(child);
    }
  }
  return out;
}

async function checkFile(url: URL): Promise<Array<HandlerFinding & { file: string }>> {
  const text = await Deno.readTextFile(url);
  const lines = text.split("\n");
  return findHandlerFindings(lines).map((f) => ({ ...f, file: url.pathname }));
}

async function main() {
  const files = await collectTsFiles(ROOT);
  const allFindings: Array<HandlerFinding & { file: string }> = [];

  for (const file of files) {
    allFindings.push(...await checkFile(file));
  }

  if (allFindings.length === 0) {
    console.log(
      `check-handler-safety-net-guards: OK -- every request handler across ${files.length} files carries a full-body try/catch that returns a corsHeaders-bearing Response on failure.`,
    );
    Deno.exit(0);
  }

  console.error(
    `check-handler-safety-net-guards: found ${allFindings.length} handler(s) missing a full-body safety net:\n`,
  );
  for (const f of allFindings) {
    const rel = f.file.replace(/^.*\/supabase\/functions\//, "supabase/functions/");
    console.error(`  ${rel}:${f.line}: ${f.reason}`);
  }
  console.error(
    `\nWrap the handler's body (right after the OPTIONS check) in try { ... } catch (err) { ` +
      `console.error(...); return new Response(JSON.stringify({ error: "Unexpected server error" }), ` +
      `{ status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }); } -- see ` +
      `analyze-novel/index.ts for the reference pattern -- or add ` +
      `"// safety-net-ignore: <reason>" above the handler line if it's genuinely safe without one.`,
  );
  Deno.exit(1);
}

// Only run when executed directly (`deno run .../check-handler-safety-net-guards.ts`),
// not when imported by check-handler-safety-net-guards.test.ts -- otherwise
// importing this module for its exports would also call Deno.exit() mid
// test run.
if (import.meta.main) {
  await main();
}
