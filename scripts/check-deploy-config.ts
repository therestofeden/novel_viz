// Deploy-config guard (added 2026-10-21, daily_backend).
//
// Every edge function under supabase/functions/<name>/index.ts must have a
// `[functions.<name>]` block in supabase/config.toml with `verify_jwt = false`.
//
// Why: the Supabase CLI defaults verify_jwt to TRUE. All live functions run
// with it off (they do their own auth: per-IP rate limits, or a shared secret).
// A new function, or a deploy without --no-verify-jwt, would otherwise go live
// with JWT verification on and reject the app's / GitHub Actions' requests.
// The deploy-functions workflow deploys every function from config, so this
// file is the single source of truth.
//
// Run: deno run --allow-read scripts/check-deploy-config.ts

export interface FunctionConfig {
  verifyJwt: boolean | undefined;
}

/** Parses only the `[functions.<name>]` tables and their `verify_jwt` key. */
export function parseFunctionConfigs(toml: string): Map<string, FunctionConfig> {
  const out = new Map<string, FunctionConfig>();
  let current: string | null = null;
  for (const raw of toml.split("\n")) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const table = line.match(/^\[\s*([^\]]+?)\s*\]$/);
    if (table) {
      const m = table[1].match(/^functions\.("?)([A-Za-z0-9_-]+)\1$/);
      current = m ? m[2] : null;
      if (current && !out.has(current)) out.set(current, { verifyJwt: undefined });
      continue;
    }
    if (!current) continue;
    const kv = line.match(/^verify_jwt\s*=\s*(true|false)$/);
    if (kv) out.get(current)!.verifyJwt = kv[1] === "true";
  }
  return out;
}

export function findProblems(functionNames: string[], configs: Map<string, FunctionConfig>): string[] {
  const problems: string[] = [];
  for (const name of [...functionNames].sort()) {
    const c = configs.get(name);
    if (!c) problems.push(`${name}: no [functions.${name}] block in supabase/config.toml`);
    else if (c.verifyJwt !== false) problems.push(`${name}: verify_jwt must be explicitly false (got ${c.verifyJwt})`);
  }
  for (const name of configs.keys()) {
    if (!functionNames.includes(name)) problems.push(`${name}: configured in supabase/config.toml but supabase/functions/${name}/index.ts does not exist`);
  }
  return problems;
}

async function listFunctions(root: string): Promise<string[]> {
  const names: string[] = [];
  for await (const e of Deno.readDir(root)) {
    if (!e.isDirectory || e.name.startsWith("_") || e.name.startsWith(".")) continue;
    try {
      await Deno.stat(`${root}/${e.name}/index.ts`);
      names.push(e.name);
    } catch { /* not a function dir */ }
  }
  return names;
}

async function main() {
  const fns = await listFunctions("supabase/functions");
  const configs = parseFunctionConfigs(await Deno.readTextFile("supabase/config.toml"));
  const problems = findProblems(fns, configs);
  if (problems.length) {
    console.error("Deploy-config guard failed:\n  " + problems.join("\n  "));
    Deno.exit(1);
  }
  console.log(`Deploy-config guard OK: ${fns.length} functions, all verify_jwt = false.`);
}

if (import.meta.main) {
  await main();
}
