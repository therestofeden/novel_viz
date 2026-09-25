// scripts/check-timeout-guards.ts
//
// CI guard added 2026-09-25 (daily_backend audit), acting on the
// recommendation closing the 2026-09-24 audit (which itself followed from
// the 2026-09-19 and 2026-09-23 audits fixing this bug class one file at a
// time -- most recently `takeaways/index.ts`, whose 4 unguarded blocking DB
// calls had silently gone untouched by every earlier "full sweep").
//
// What this checks: every `.from(`/`.rpc(` call site in
// `supabase/functions/**/*.ts` that is actually AWAITED (i.e. can block an
// edge function's response) must have one of this codebase's three
// established timeout-guard idioms -- `withTimeout(`, `raceRateLimitCount(`,
// `Promise.race(` -- somewhere in its immediate vicinity. A stalled Postgres
// connection on an unguarded awaited call hangs the request indefinitely
// instead of failing fast; every one of the fixes above is exactly that bug.
//
// What this deliberately does NOT flag: fire-and-forget calls (no `await`
// anywhere on the statement -- e.g. `supabase.from("rate_limit_events")
// .insert(...).then(() => {})`, or `EdgeRuntime.waitUntil(...)`). Those
// can't block a response by construction, so requiring a timeout guard on
// them would just be noise. `Array.from(...)` is also excluded -- it's a
// JS builtin, not a Supabase query.
//
// This is intentionally a fast, grep-adjacent heuristic -- a window/keyword
// scan, not a type-aware analyzer -- per the 2026-09-24 audit's own framing
// ("no need for a real type-aware analyzer"). It can both miss real gaps
// (a guard token more than WINDOW lines away) and over-flag rare shapes
// (an awaited call whose guard is unusually far from the call site). For a
// confirmed-safe call that this script can't see is safe, silence it with
// a `// timeout-guard-ignore: <reason>` comment on the line above the call
// site rather than special-casing the script.
//
// Run: deno run --allow-read scripts/check-timeout-guards.ts
// Exits 1 (and prints every finding) if any awaited, unguarded call site is
// found; exits 0 otherwise. Wired into `edge-functions-test` in ci.yml as a
// fast pre-test step, so a reintroduced gap fails CI the same day it lands
// instead of waiting for the next manual audit pass.

const ROOT = new URL("../supabase/functions/", import.meta.url);

const GUARD_TOKENS = [
  "withTimeout(",
  "withTimeoutOrSentinel(",
  "raceRateLimitCount(",
  "Promise.race(",
];

const FIRE_AND_FORGET_TOKENS = ["waitUntil(", ".then("];

const WINDOW_BEFORE = 15;
const WINDOW_AFTER = 12;
const AWAIT_LOOKBACK = 10;

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

// Looks up to IGNORE_LOOKBACK comment lines above the call site for the
// marker, not just the single line directly above -- this codebase's own
// explanatory comments routinely run several lines, and the marker line
// doesn't have to be the last one before the code.
const IGNORE_LOOKBACK = 8;
function isIgnored(lines: string[], idx: number): boolean {
  for (let i = idx - 1; i >= Math.max(0, idx - IGNORE_LOOKBACK); i--) {
    if (!isCommentLine(lines[i])) break;
    if (/timeout-guard-ignore/.test(lines[i])) return true;
  }
  return false;
}

function isCommentLine(line: string): boolean {
  return line.trim().startsWith("//") || line.trim().startsWith("*");
}

function hasCallSite(line: string): boolean {
  if (isCommentLine(line)) return false;
  if (!/\.(from|rpc)\(/.test(line)) return false;
  if (/Array\.from\(/.test(line)) {
    const stripped = line.replace(/Array\.from\(/g, "");
    return /\.(from|rpc)\(/.test(stripped);
  }
  return true;
}

// Guard tokens matched as identifiers, not literal "name(" substrings --
// generic type args (`withTimeout<Foo>(...)`) sit between the name and the
// paren, so a plain substring check on "withTimeout(" misses them.
const GUARD_REGEXES = GUARD_TOKENS.map((t) => {
  const name = t.replace(/\($/, "");
  if (name === "Promise.race") {
    return /Promise\.race\s*\(/;
  }
  return new RegExp(`\\b${name}\\s*(<[^>]*>)?\\s*\\(`);
});

function findGuardInWindow(lines: string[], idx: number): boolean {
  const start = Math.max(0, idx - WINDOW_BEFORE);
  const end = Math.min(lines.length, idx + WINDOW_AFTER + 1);
  const window = lines.slice(start, end)
    .filter((l) => !isCommentLine(l))
    .join("\n");
  return GUARD_REGEXES.some((re) => re.test(window));
}

// Finds where the statement containing `idx` most likely begins, by
// walking backward until a prior line completes a previous statement or
// block (ends with `;`, `{`, or `}`, or is blank) — bounded by
// AWAIT_LOOKBACK so a single mis-detected boundary can't scan the whole
// file. This keeps an unrelated PRIOR statement's `await` (e.g. `const data
// = await res.json();` two lines above a fire-and-forget
// `.from(...).then(...)` chain) from being misread as belonging to the
// call site being checked — exactly the false positive this codebase's
// `admin.from("dna_recommendation_cache").upsert(...).then(...)` pattern
// would otherwise trigger.
function statementSpan(lines: string[], idx: number): string[] {
  let start = idx;
  const floor = Math.max(0, idx - AWAIT_LOOKBACK);
  for (let i = idx - 1; i >= floor; i--) {
    if (isCommentLine(lines[i])) {
      start = i;
      continue;
    }
    const trimmed = lines[i].trim();
    if (trimmed === "" || /[;{}]$/.test(trimmed)) {
      start = i + 1;
      break;
    }
    start = i;
  }
  return lines.slice(start, idx + 1).filter((l) => !isCommentLine(l));
}

function isAwaited(lines: string[], idx: number): boolean {
  return /\bawait\b/.test(statementSpan(lines, idx).join("\n"));
}

function isFireAndForget(lines: string[], idx: number): boolean {
  if (isAwaited(lines, idx)) return false;
  const end = Math.min(lines.length, idx + WINDOW_AFTER + 1);
  const window = lines.slice(idx, end)
    .filter((l) => !isCommentLine(l))
    .join("\n");
  return FIRE_AND_FORGET_TOKENS.some((t) => window.includes(t));
}

// Pure, file-system-free core: given a file's lines, returns the 0-indexed
// line numbers of unguarded awaited call sites. Exported so
// check-timeout-guards.test.ts can exercise the heuristic directly against
// small fixtures instead of writing files to disk.
export function findViolationLines(lines: string[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!hasCallSite(line)) continue;
    if (isIgnored(lines, i)) continue;
    if (findGuardInWindow(lines, i)) continue;
    if (!isAwaited(lines, i)) continue;
    if (isFireAndForget(lines, i)) continue;
    out.push(i);
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
      `check-timeout-guards: OK -- every awaited .from()/.rpc() call site across ${files.length} files is guarded.`,
    );
    Deno.exit(0);
  }

  console.error(
    `check-timeout-guards: found ${allFindings.length} awaited DB call site(s) with no timeout guard within range:\n`,
  );
  for (const f of allFindings) {
    const rel = f.file.replace(/^.*\/supabase\/functions\//, "supabase/functions/");
    console.error(`  ${rel}:${f.line}: ${f.text}`);
  }
  console.error(
    `\nGuard with withTimeout(...) / raceRateLimitCount(...) / Promise.race([...]) nearby, or add ` +
      `"// timeout-guard-ignore: <reason>" on the line above if this call is genuinely safe unguarded.`,
  );
  Deno.exit(1);
}

// Only run when executed directly (`deno run .../check-timeout-guards.ts`),
// not when imported by check-timeout-guards.test.ts -- otherwise importing
// this module for its exports would also call Deno.exit() mid test run.
if (import.meta.main) {
  await main();
}
