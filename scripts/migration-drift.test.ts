import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { isDataOnly, parseMigrationFile, pendingMigrations, selectForApply } from "./migration-drift.ts";

const files = [
  "20261027120000_private_server_caches.sql",
  "20261028110000_canon_books_curation_round126_2026_10_28.sql",
  "20261118181806_membership.sql",
  "README.md",
].map(parseMigrationFile).filter((m) => m !== null);

Deno.test("parses only timestamped .sql files", () => {
  assertEquals(files.length, 3);
  assertEquals(files[0].name, "private_server_caches");
});

Deno.test("matches by name, not version (agents apply with their own timestamps)", () => {
  const pending = pendingMigrations(files, ["membership", "canon_books_curation_round126_2026_10_28"]);
  assertEquals(pending.map((m) => m.name), ["private_server_caches"]);
});

Deno.test("canon data files are tolerated, schema files are not", () => {
  assertEquals(isDataOnly("canon_books_gap_fill_2026_11_19"), true);
  assertEquals(isDataOnly("private_server_caches"), false);
});

Deno.test("apply accepts bare name, full stem or .sql, in file order", () => {
  const pending = pendingMigrations(files, []);
  const sel = selectForApply(pending, ["20261118181806_membership.sql", " private_server_caches "]);
  assertEquals(sel.map((m) => m.name), ["private_server_caches", "membership"]);
});

Deno.test("apply refuses names that are applied or unknown, and empty lists", () => {
  const pending = pendingMigrations(files, ["membership"]);
  assertThrows(() => selectForApply(pending, ["membership"]));
  assertThrows(() => selectForApply(pending, ["drop_everything"]));
  assertThrows(() => selectForApply(pending, [""]));
});

Deno.test("renamed history rows and Lovable uuid files are not drift", () => {
  const local = [
    "20260429032315_db333ea3-e2a8-459d-bf7c-35f56ca3fc54.sql",
    "20260605000000_book_takeaways.sql",
  ].map(parseMigrationFile).filter((m) => m !== null);
  assertEquals(local.length, 1);
  assertEquals(pendingMigrations(local, ["006_book_takeaways"]).length, 0);
});
