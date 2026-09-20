import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CLASSIC } from "@/lib/classic";
import { MUST_READ } from "@/lib/must-read";
import { normalizeForSearch } from "@/lib/utils";

// ── Why this test exists ────────────────────────────────────────────────
//
// classic.ts / must-read.ts drive `ClassicBadge.tsx`'s cosmetic stamp on a
// book already found some other way. `canon_books` is the separate DB
// table `search-books`' `search_canon` RPC actually reads from — it's what
// makes a curated title *findable* (typo tolerance, the "Author - Title"
// splitter, CANON_BONUS ranking), not just badge-able once found some other
// way.
//
// Every curation round historically got a same-day `canon_books` migration
// pairing it — by convention only, nothing enforced it. That pairing
// silently lapsed for classic.ts rounds 85-92 (8 rounds, 20 titles) before
// being caught and backfilled on 2026-09-19 (see that migration and the
// 2026-09-19 backend_audit for the full story). Both that day's audit and
// its `daily_backend` companion session independently recommended the same
// fix: an automated cross-reference so a curated title without a matching
// canon_books row fails loudly instead of silently, whatever session or
// prompt adds the next round.
//
// Matching key is TITLE ONLY, not (title, author): `search_canon`
// (20260908082734_search_canon_unaccent_diacritic_fold.sql) matches the
// query against `cb.title` and `cb.author` as independent OR'd trigram
// comparisons, not a combined pair — so a canon_books row is enough to make
// a title canon-findable even when its stored author string is a
// transliteration variant of classic.ts's own spelling (e.g. canon_books
// has "Tao Te Ching" / "Lao Tzu" while must-read.ts spells the author
// "Laozi" — confirmed by an earlier, stricter version of this test that
// flagged 70 false positives, nearly all bare author-spelling variants like
// this one, before being narrowed to title-only matching).
//
// This is a best-effort static check, matching the verification style
// every recent backend/curation audit in this repo has used in the absence
// of a Supabase MCP / live DB connection in this sandbox (see standing
// open items in backend_audit_*.md): it regex-parses the `.sql` migration
// files for canon_books titles rather than querying the table itself, so it
// can't see live-DB-only drift (manual dashboard edits, migrations that
// failed to apply). It CAN catch exactly the class of bug that caused the
// rounds-85-92 gap: a classic.ts/must-read.ts entry that was never given a
// canon_books migration in the first place.

const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../supabase/migrations",
);

/** Un-escapes SQL's `''` doubled-quote convention inside a quoted literal. */
function unescapeSqlString(s: string): string {
  return s.replace(/''/g, "'");
}

/**
 * Extracts every canon_books title from `insert into [public.]canon_books
 * (title, author, ...)` statements across all migrations — both the
 * `values ('T', 'A', 'source'), (...)` list form and the
 * `select 'T', 'A', 'source' where not exists (...)` single-row form.
 *
 * Approach: isolate each `insert into canon_books ... ;` statement (case-
 * insensitive, `--` comments stripped first so prose apostrophes can't be
 * mistaken for SQL string literals), then within that statement match
 * adjacent `'...', '...'` quoted-string pairs and keep the first (title).
 * Because every real row is `('Title', 'Author', 'source_tag')` or
 * `SELECT 'Title', 'Author', 'source_tag'`, the first quoted pair found
 * scanning left-to-right within a row is always (title, author) — the
 * source string never sits immediately before the next title with only a
 * comma between them (it's followed by `)` or `;`, and the next title
 * starts a fresh set of parens or the next `SELECT`), and the `WHERE NOT
 * EXISTS (... lower(title) = lower('T') AND lower(author) = lower('A')
 * ...)` guard clauses some migrations add can't match either, since `AND
 * lower(author) = lower(` sits between the two literals, not a bare comma.
 */
function extractCanonBooksTitles(): Set<string> {
  const titles = new Set<string>();
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));

  for (const file of files) {
    const raw = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    const stripped = raw
      .split("\n")
      .map((line) => line.replace(/--.*$/, ""))
      .join("\n");

    // insert into [public.]canon_books ... ; (9 of 66 migrations schema-qualify).
    const stmtRe = /insert\s+into\s+(?:public\.)?canon_books[\s\S]*?;/gi;
    let stmtMatch: RegExpExecArray | null;
    while ((stmtMatch = stmtRe.exec(stripped)) !== null) {
      const stmt = stmtMatch[0];
      const pairRe = /'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'/g;
      let pairMatch: RegExpExecArray | null;
      while ((pairMatch = pairRe.exec(stmt)) !== null) {
        titles.add(normalizeForSearch(unescapeSqlString(pairMatch[1])));
      }
    }
  }
  return titles;
}

/** All title strings (canonical + aka) an entry should be findable under. */
function titlesOf(entry: { title: string; aka?: string[] }): string[] {
  return [entry.title, ...(entry.aka ?? [])];
}

describe("canon_books coverage (classic.ts / must-read.ts vs. migrations)", () => {
  const canonTitles = extractCanonBooksTitles();

  it("found a non-trivial number of canon_books titles in migrations (sanity check on the parser itself)", () => {
    // As of 2026-09-20 there were 66+ canon_books-touching migration files
    // and several hundred rows; a near-empty result means the parser broke,
    // not that the repo suddenly lost its migrations.
    expect(canonTitles.size).toBeGreaterThan(300);
  });

  it("every CLASSIC entry has a matching canon_books title", () => {
    const missing = CLASSIC.filter(
      (entry) => !titlesOf(entry).some((t) => canonTitles.has(normalizeForSearch(t))),
    ).map((entry) => `${entry.title} — ${entry.author}`);

    expect(
      missing,
      `${missing.length} classic.ts entr${missing.length === 1 ? "y" : "ies"} with no canon_books row under ` +
        `any of their title/aka spellings (searchable-but-unbadged is fine; this is the opposite gap — ` +
        `curated-but-not-canon-findable). Fix with a canon_books backfill migration, same pattern as ` +
        `20260919090000_canon_books_backfill_classic_rounds85_92.sql:\n` +
        missing.join("\n"),
    ).toEqual([]);
  });

  it("every MUST_READ entry has a matching canon_books title", () => {
    const missing = MUST_READ.filter(
      (entry) => !titlesOf(entry).some((t) => canonTitles.has(normalizeForSearch(t))),
    ).map((entry) => `${entry.title} — ${entry.author}`);

    expect(
      missing,
      `${missing.length} must-read.ts entr${missing.length === 1 ? "y" : "ies"} with no canon_books row under ` +
        `any of their title/aka spellings:\n` +
        missing.join("\n"),
    ).toEqual([]);
  });
});
