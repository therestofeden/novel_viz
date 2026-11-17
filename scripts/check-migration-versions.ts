// Migration-version guard (added 2026-11-17, daily_backend).
//
// Every file in supabase/migrations must be named <14-digit version>_<name>.sql
// and no two files may share a version. The Supabase CLI keys migrations on the
// version alone: a duplicate makes `supabase db reset` / `db push` fail with
// "duplicate key value violates unique constraint schema_migrations_pkey", so a
// fresh environment (local dev, a branch, disaster recovery) can't be rebuilt.
// Five such pairs had crept in (canon rounds and app migrations written by
// different agents on the same day with the same HH0000 timestamp).
//
// Run: deno run --allow-read scripts/check-migration-versions.ts

const NAME = /^(\d{14})_[A-Za-z0-9_-]+\.sql$/; // Lovable-era files use UUID names

export function findProblems(files: string[]): string[] {
  const problems: string[] = [];
  const seen = new Map<string, string>();
  for (const f of [...files].sort()) {
    const m = f.match(NAME);
    if (!m) {
      problems.push(`${f}: name must match <YYYYMMDDHHMMSS>_<name>.sql`);
      continue;
    }
    const prev = seen.get(m[1]);
    if (prev) problems.push(`${f}: version ${m[1]} already used by ${prev}`);
    else seen.set(m[1], f);
  }
  return problems;
}

if (import.meta.main) {
  const dir = Deno.args[0] ?? "supabase/migrations";
  const files: string[] = [];
  for await (const e of Deno.readDir(dir)) if (e.isFile && !e.name.startsWith(".")) files.push(e.name);
  const problems = findProblems(files);
  if (problems.length) {
    console.error(`Migration version problems (${problems.length}):\n  ` + problems.join("\n  "));
    console.error("Fix: bump the later file's timestamp by one second (e.g. ...120000 -> ...120001).");
    Deno.exit(1);
  }
  console.log(`OK: ${files.length} migrations, all versions unique.`);
}
