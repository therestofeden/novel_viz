// scripts/check-error-leak-guards.ts
//
// CI guard added 2026-09-27 (daily_backend audit), closing the same
// information-disclosure bug class the 2026-09-22 audit fixed by hand for
// search-books and popular-books ("was returning String(err) to the
// client... every sibling function already returns a fixed generic
// message") -- but that sweep only checked the plain top-level catches. It
// missed the SSE (streaming) catch blocks in analyze-novel and takeaways,
// plus a third non-streaming catch in takeaways around generateQuestions(),
// all three of which were still handing e.message (Postgres error text,
// Deno stack fragments, JSON.parse failures, etc.) straight to an
// authenticated caller. Fixed today in the same commit that adds this
// script; see each fix's own comment for the exact reasoning.
//
// The wrinkle this bug class has that the timeout-guard and body-limit
// classes didn't: some caught errors ARE safe, and even desirable, to
// return verbatim. The Gemini-call branches in analyze-novel/takeaways
// throw an Error tagged with a numeric `.status` whose `.message` is
// always one of describeGeminiFailure's fixed, curated strings (or the
// harmless "AI gateway error <code>" fallback) -- deliberately shown to
// the user ("add your own Gemini API key in settings", etc.). So this
// script isn't "never let a caught error's .message reach the client" --
// it's "don't let one reach the client without a `.status`-gated check
// nearby proving it's the curated shape, not an arbitrary exception."
//
// What this checks: for every `catch (X)` / `catch (X: any)` clause in
// `supabase/functions/**/*.ts`, any later line referencing `X.message` or
// `String(X)` is flagged, UNLESS:
//   - it's inside a (possibly multi-line) `console.error/log/warn/info(...)`
//     call, which never reaches the client; or
//   - a `.status` token appears within WINDOW lines of it -- this
//     codebase's "isCuratedFailure = typeof X?.status === ..." gate around
//     a curated, client-safe Gemini-failure message; or
//   - a known curated-error-class token (currently `PayloadTooLargeError`,
//     the one other established "safe to echo verbatim" exception class --
//     see _shared/body-limit.ts) appears within WINDOW lines of it.
//
// This is, like check-timeout-guards.ts, a fast window/keyword scan, not a
// type-aware analyzer or a real dataflow check -- it can't tell whether an
// unguarded `X.message` actually reaches a Response/send() call or is just
// being logged through a non-`console.*` helper, and a brand new curated-
// error class would need adding to CURATED_GUARD_TOKENS below by hand
// rather than being recognized automatically. A confirmed-safe case this
// script can't see is safe can be silenced with a
// `// error-leak-ignore: <reason>` comment on one of the lines immediately
// above.
//
// Run: deno run --allow-read scripts/check-error-leak-guards.ts
// Exits 1 (and prints every finding) if any unguarded, client-reachable
// use of a caught error's raw message is found; exits 0 otherwise. Wired
// into `edge-functions-test` in ci.yml alongside the other two guards.

const ROOT = new URL("../supabase/functions/", import.meta.url);

const WINDOW = 6;
const IGNORE_LOOKBACK = 8;
const CATCH_LOOKBACK = 40;
const STATEMENT_LOOKBACK = 10;

const CATCH_RE = /\bcatch\s*\(\s*([A-Za-z_$][\w$]*)\s*(?::\s*any)?\s*\)/;

// Tokens whose nearby presence marks a caught error's .message/String(...)
// as already-examined and safe to send to the client. ".status" catches
// this codebase's Gemini-failure gate (`typeof X?.status === "number"`);
// "PayloadTooLargeError" catches the body-limit rejection gate (`e
// instanceof PayloadTooLargeError`) -- see _shared/body-limit.ts. Add to
// this list, don't special-case call sites, if a new curated-safe
// exception shape shows up.
const CURATED_GUARD_TOKENS = [".status", "PayloadTooLargeError"];

function isCommentLine(line: string): boolean {
  return line.trim().startsWith("//") || line.trim().startsWith("*");
}

// Walks backward from idx to find where the current statement/call likely
// began, then checks whether that span opens a console.error/log/warn/info
// call -- so a call split across several lines (an object literal argument
// on its own line, as analyze-novel's pre-stream catch does) is still
// recognized as console-only, not just a single-line `console.error(...)`.
// Only a blank line or a line ending in `;` counts as a statement boundary
// here -- unlike check-timeout-guards.ts's similar statementSpan, this
// deliberately does NOT stop on a trailing `{`/`}`, because a multi-line
// call's own object-literal argument routinely ends a line with `{` (e.g.
// `console.error(JSON.stringify({`) without that being a real statement
// break.
function isWithinConsoleCall(lines: string[], idx: number): boolean {
  let start = idx;
  const floor = Math.max(0, idx - STATEMENT_LOOKBACK);
  for (let i = idx - 1; i >= floor; i--) {
    const trimmed = lines[i].trim();
    if (trimmed === "" || trimmed.endsWith(";")) {
      start = i + 1;
      break;
    }
    start = i;
  }
  const span = lines.slice(start, idx + 1).join("\n");
  return /\bconsole\.(error|log|warn|info)\s*\(/.test(span);
}

function isIgnored(lines: string[], idx: number): boolean {
  for (let i = idx - 1; i >= Math.max(0, idx - IGNORE_LOOKBACK); i--) {
    if (!isCommentLine(lines[i])) break;
    if (/error-leak-ignore/.test(lines[i])) return true;
  }
  return false;
}

// Finds the identifier bound by the nearest `catch (X)` / `catch (X: any)`
// clause at or above line idx, within CATCH_LOOKBACK lines. Deliberately
// does NOT match `.catch((x) => ...)` promise handlers -- those have a
// second `(` immediately after `catch(`'s own open paren where this regex
// expects an identifier, so the match fails there by construction.
function enclosingCatchVar(lines: string[], idx: number): string | null {
  for (let i = idx; i >= Math.max(0, idx - CATCH_LOOKBACK); i--) {
    const m = CATCH_RE.exec(lines[i]);
    if (m) return m[1];
  }
  return null;
}

function hasCuratedGuardNearby(lines: string[], idx: number): boolean {
  const start = Math.max(0, idx - WINDOW);
  const end = Math.min(lines.length, idx + WINDOW + 1);
  const window = lines.slice(start, end);
  return CURATED_GUARD_TOKENS.some((tok) => window.some((l) => l.includes(tok)));
}

// Pure, file-system-free core: given a file's lines, returns the 0-indexed
// line numbers of unguarded, client-reachable raw-error-message uses.
// Exported so check-error-leak-guards.test.ts can exercise the heuristic
// directly against small fixtures instead of writing files to disk.
export function findViolationLines(lines: string[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentLine(line)) continue;

    const catchVar = enclosingCatchVar(lines, i);
    if (!catchVar) continue;

    const messageRe = new RegExp(`\\b${catchVar}\\.message\\b`);
    const stringRe = new RegExp(`\\bString\\(\\s*${catchVar}\\s*\\)`);
    if (!messageRe.test(line) && !stringRe.test(line)) continue;

    if (isWithinConsoleCall(lines, i)) continue;
    if (isIgnored(lines, i)) continue;
    if (hasCuratedGuardNearby(lines, i)) continue;
    out.push(i);
  }
  return out;
}

interface Finding {
  file: string;
  line: number;
  text: string;
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
  const files = await collectTsFiles(ROOT);
  const allFindings: Finding[] = [];

  for (const file of files) {
    allFindings.push(...await checkFile(file));
  }

  if (allFindings.length === 0) {
    console.log(
      `check-error-leak-guards: OK -- every caught-error message use across ${files.length} files is either server-side-only or gated behind a curated-failure (.status) check.`,
    );
    Deno.exit(0);
  }

  console.error(
    `check-error-leak-guards: found ${allFindings.length} unguarded, client-reachable raw error message use(s):\n`,
  );
  for (const f of allFindings) {
    const rel = f.file.replace(/^.*\/supabase\/functions\//, "supabase/functions/");
    console.error(`  ${rel}:${f.line}: ${f.text}`);
  }
  console.error(
    `\nEither gate this behind a "typeof X?.status === \"number\"" curated-failure check (see analyze-novel's/takeaways' 2026-09-27 fixes) before returning it to the client, log it via console.error/log/warn/info instead, or add ` +
      `"// error-leak-ignore: <reason>" on a line above if this is genuinely already safe.`,
  );
  Deno.exit(1);
}

if (import.meta.main) {
  await main();
}
