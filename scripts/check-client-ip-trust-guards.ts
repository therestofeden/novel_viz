// scripts/check-client-ip-trust-guards.ts
//
// CI guard added 2026-10-03 (daily_backend audit), closing the IP-spoofing
// rate-limit/budget bypass fixed by hand the same day: 6 of 7 call sites
// that key a per-IP rate limit or Gemini-spend budget on the caller's
// address parsed ONLY the leftmost entry of `x-forwarded-for` -- the one
// entry a client always controls, since X-Forwarded-For is additive (each
// hop appends, never overwrites the front of the list). See
// supabase/functions/_shared/client-ip.ts's own header comment for the
// full writeup and why `cf-connecting-ip` is the one trustworthy signal on
// this project's (Cloudflare-fronted) domain.
//
// What this checks: every `supabase/functions/**/*.ts` file (excluding
// `_shared/client-ip.ts` itself and `*.test.ts` files) that references the
// literal header name `x-forwarded-for` or `x-real-ip` outside of a
// `// client-ip-trust-ignore: <reason>`-guarded line is flagged -- the only
// sanctioned way to read either header is through the shared
// `getClientIp()` helper, which every rate-limited/budget-gated function
// should import instead of re-deriving the client IP locally.
//
// This is a blunt, file-content scan, not a type-aware analyzer: it can't
// tell a legitimate new use from a reintroduced copy of the old bug, which
// is exactly the point -- any direct header read outside the shared helper
// should be looked at by hand and either routed through getClientIp() or
// explicitly justified with the ignore comment.
//
// Run: deno run --allow-read scripts/check-client-ip-trust-guards.ts
// Exits 1 (and prints every finding) if any disallowed direct read of
// these headers is found outside _shared/client-ip.ts; exits 0 otherwise.
// Wired into `edge-functions-test` in ci.yml alongside the other guards.

const ROOT = new URL("../supabase/functions/", import.meta.url);

const FLAGGED_HEADERS = ["x-forwarded-for", "x-real-ip"];
const ALLOWED_FILENAME = "client-ip.ts";
const IGNORE_LOOKBACK = 4;

function isCommentLine(line: string): boolean {
  return line.trim().startsWith("//") || line.trim().startsWith("*");
}

function isIgnored(lines: string[], idx: number): boolean {
  for (let i = idx; i >= Math.max(0, idx - IGNORE_LOOKBACK); i--) {
    if (/client-ip-trust-ignore/.test(lines[i])) return true;
    if (i !== idx && !isCommentLine(lines[i])) break;
  }
  return false;
}

// Pure, file-system-free core: given a file's lines, returns the 0-indexed
// line numbers of disallowed direct header reads. Exported so this
// script's own test file can exercise the heuristic against small
// fixtures instead of writing files to disk.
export function findViolationLines(lines: string[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentLine(line)) continue;
    const lower = line.toLowerCase();
    const hit = FLAGGED_HEADERS.some((h) => lower.includes(`"${h}"`) || lower.includes(`'${h}'`));
    if (!hit) continue;
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

async function collectTsFiles(dir: URL): Promise<URL[]> {
  const out: URL[] = [];
  for await (const entry of Deno.readDir(dir)) {
    if (entry.name.startsWith(".")) continue;
    const child = new URL(entry.name + (entry.isDirectory ? "/" : ""), dir);
    if (entry.isDirectory) {
      out.push(...await collectTsFiles(child));
    } else if (
      entry.isFile && entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".test.ts") &&
      entry.name !== ALLOWED_FILENAME
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
      `check-client-ip-trust-guards: OK -- no file outside _shared/client-ip.ts reads x-forwarded-for/x-real-ip directly across ${files.length} files.`,
    );
    Deno.exit(0);
  }

  console.error(
    `check-client-ip-trust-guards: found ${allFindings.length} direct read(s) of a spoofable IP header outside the shared helper:\n`,
  );
  for (const f of allFindings) {
    const rel = f.file.replace(/^.*\/supabase\/functions\//, "supabase/functions/");
    console.error(`  ${rel}:${f.line}: ${f.text}`);
  }
  console.error(
    `\nRoute this through getClientIp() from _shared/client-ip.ts instead of reading the header directly, or add ` +
      `"// client-ip-trust-ignore: <reason>" on the line above if this is a confirmed-safe exception.`,
  );
  Deno.exit(1);
}

if (import.meta.main) {
  await main();
}
