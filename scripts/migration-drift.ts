// Migration drift check / one-click apply (added 2026-11-21, daily_backend).
//
// Why: edge functions deploy on every merge (deploy-functions.yml), but SQL
// migrations only ever reached production when an agent's apply_migration call
// got approved live. Scheduled agents run with nobody there to approve, so
// security fixes sat unapplied: 20261027120000_private_server_caches (anon can
// read every reader's search history in search_cache) has been on main since
// 27 Oct and was still not live on 21 Nov. Nothing told anyone.
//
// This script compares supabase/migrations/*.sql with the production history
// (Management API, GET /v1/projects/{ref}/database/migrations) by NAME (the part
// after the timestamp; agents apply with their own timestamps, so versions
// differ). It never applies anything on its own:
//
//   check (default):  lists pending migrations. Exit 1 if any pending
//                     migration is a schema/security change, so the scheduled
//                     workflow fails and GitHub emails the repo owner.
//                     Pending data-only canon_books_* files are reported but
//                     tolerated: several were applied via execute_sql, which
//                     does not record history.
//   --apply a,b,c:    applies exactly the named pending migrations, in file
//                     order, via POST /v1/projects/{ref}/database/migrations.
//                     Only reachable from workflow_dispatch, i.e. a human
//                     clicking "Run workflow" and typing the names.
//
// Env: SUPABASE_ACCESS_TOKEN, PROJECT_REF.
// Run: deno run --allow-read --allow-net --allow-env scripts/migration-drift.ts [--apply names]

export interface LocalMigration {
  file: string;
  version: string;
  name: string;
}

/**
 * Files whose production history row has a different name (applied by hand
 * before agents used the file name). Checked against the live history on
 * 2026-11-21.
 */
export const APPLIED_AS: Record<string, string> = {
  book_takeaways: "006_book_takeaways",
  profiles_select_own_only: "profiles_select_own_only_alter",
};

// The 14 Lovable-era files are named <timestamp>_<uuid>.sql (hyphens) and were
// recorded as 001_..005_ in production; the name pattern below skips them.
export function parseMigrationFile(file: string): LocalMigration | null {
  const m = file.match(/^(\d{14})_([A-Za-z0-9_]+)\.sql$/);
  return m ? { file, version: m[1], name: m[2] } : null;
}

/** Data-only canon curation files; tolerated when unrecorded. */
export function isDataOnly(name: string): boolean {
  return name.startsWith("canon_books_");
}

export function pendingMigrations(
  local: LocalMigration[],
  appliedNames: Iterable<string>,
): LocalMigration[] {
  const applied = new Set(appliedNames);
  return local
    .filter((m) => !applied.has(m.name) && !applied.has(APPLIED_AS[m.name] ?? ""))
    .sort((a, b) => a.file.localeCompare(b.file));
}

/** Resolves the --apply list against pending; throws on unknown/applied names. */
export function selectForApply(pending: LocalMigration[], requested: string[]): LocalMigration[] {
  const wanted = new Set(requested.map((s) => s.trim().replace(/\.sql$/, "")).filter(Boolean));
  if (wanted.size === 0) throw new Error("--apply needs at least one migration name");
  const byKey = new Map<string, LocalMigration>();
  for (const m of pending) {
    byKey.set(m.name, m);
    byKey.set(`${m.version}_${m.name}`, m);
  }
  const out = new Set<LocalMigration>();
  for (const w of wanted) {
    const m = byKey.get(w);
    if (!m) throw new Error(`"${w}" is not a pending migration (already applied, or no such file)`);
    out.add(m);
  }
  return [...out].sort((a, b) => a.file.localeCompare(b.file));
}

const API = "https://api.supabase.com/v1/projects";

async function api(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${API}/${path}`, {
    ...init,
    signal: AbortSignal.timeout(60_000),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 500);
    throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status}: ${body}`);
  }
  return res;
}

async function main() {
  const token = Deno.env.get("SUPABASE_ACCESS_TOKEN");
  const ref = Deno.env.get("PROJECT_REF");
  if (!token || !ref) {
    console.log("::error::SUPABASE_ACCESS_TOKEN and PROJECT_REF are required");
    Deno.exit(1);
  }
  const applyIdx = Deno.args.indexOf("--apply");
  const applyList = applyIdx >= 0 ? (Deno.args[applyIdx + 1] ?? "").split(",") : null;

  const local: LocalMigration[] = [];
  for (const e of Deno.readDirSync("supabase/migrations")) {
    const m = e.isFile ? parseMigrationFile(e.name) : null;
    if (m) local.push(m);
  }
  const history = (await (await api(`${ref}/database/migrations`, token)).json()) as
    { version: string; name?: string | null }[];
  const pending = pendingMigrations(local, history.map((h) => h.name ?? ""));

  if (applyList) {
    const chosen = selectForApply(pending, applyList);
    for (const m of chosen) {
      const query = Deno.readTextFileSync(`supabase/migrations/${m.file}`);
      console.log(`::group::apply ${m.file}`);
      await api(`${ref}/database/migrations`, token, {
        method: "POST",
        headers: { "Idempotency-Key": `novel-viz-${m.version}-${m.name}` },
        body: JSON.stringify({ name: m.name, query }),
      });
      console.log("applied");
      console.log("::endgroup::");
    }
    console.log(`Applied ${chosen.length} migration(s).`);
    return;
  }

  const schema = pending.filter((m) => !isDataOnly(m.name));
  const data = pending.filter((m) => isDataOnly(m.name));
  console.log(`${local.length} local migrations, ${history.length} in production history.`);
  if (data.length) {
    console.log(`Data-only canon files not in history (tolerated): ${data.map((m) => m.file).join(", ")}`);
  }
  if (schema.length) {
    for (const m of schema) {
      console.log(`::error file=supabase/migrations/${m.file}::not applied to production`);
    }
    console.log(
      `\n${schema.length} schema/security migration(s) are on main but NOT live. To apply: Actions -> ` +
        `"DB migrations" -> Run workflow -> apply = ${schema.map((m) => m.name).join(",")}`,
    );
    Deno.exit(1);
  }
  console.log("No schema drift.");
}

if (import.meta.main) await main();
