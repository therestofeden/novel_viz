// Discovery guardrails (2026-11-18).
//
// Some books stay searchable and keep their analysis page, but NovelViz never
// suggests them: no AI pick, no "If you loved this shape" neighbour, no home
// page slot, no autocomplete suggestion, no shop link. The list lives in the
// public.discovery_blocklist table and is matched by the SQL function
// public.is_discovery_blocked(title, author). Database triggers already mark
// stored recommendations ({..., hidden: true}) and flag novel_analyses rows
// (discovery_blocked), so anything read back from the database is safe. This
// module covers what an edge function hands to the client straight from
// Gemini, before it has been written anywhere, and gives every prompt the
// same instruction.
//
// The SQL list is the source of truth. CORE_PATTERNS below is only a
// zero-latency backstop for the most obvious titles, used when the database
// check times out, so a slow database can never let one of them through.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const GUARD_TIMEOUT_MS = 1500;

/** Appended to every Gemini prompt that can name a book to read next. */
export const DISCOVERY_GUARDRAIL_PROMPT =
  "Never recommend hate propaganda, extremist or terrorist manifestos, or texts written to promote " +
  "genocide or racial hatred (for example Mein Kampf, The Protocols of the Elders of Zion, " +
  "The Turner Diaries, Industrial Society and Its Future). If the closest match is one of those, " +
  "recommend the best serious critical or historical work about the same subject instead.";

const CORE_PATTERNS: RegExp[] = [
  /\bmein\s+kampf\b/i,
  /\bprotocols\s+of\s+the\s+(learned\s+)?elders\s+of\s+zion\b/i,
  /\bturner\s+diaries\b/i,
  /\bindustrial\s+society\s+and\s+its\s+future\b/i,
];

/** Static, no-network check against the core patterns only. */
export function matchesCorePattern(title: unknown): boolean {
  if (typeof title !== "string" || !title) return false;
  return CORE_PATTERNS.some((re) => re.test(title));
}

type Book = { title?: unknown; author?: unknown };

/**
 * 0-based positions of blocked books in `books`. One RPC for the whole list.
 * On RPC error or timeout falls back to the core patterns (fail closed for
 * the obvious titles, open for the rest).
 */
export async function blockedPositions(admin: SupabaseClient, books: Book[]): Promise<Set<number>> {
  const out = new Set<number>();
  if (!books.length) return out;
  books.forEach((b, i) => { if (matchesCorePattern(b?.title)) out.add(i); });

  const titles = books.map((b) => (typeof b?.title === "string" ? b.title : ""));
  const authors = books.map((b) => (typeof b?.author === "string" ? b.author : ""));
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const res = await Promise.race([
      Promise.resolve(admin.rpc("discovery_blocked_positions", { p_titles: titles, p_authors: authors })),
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), GUARD_TIMEOUT_MS); }),
    ]);
    const data = (res as { data?: unknown } | null)?.data;
    if (Array.isArray(data)) for (const p of data) if (typeof p === "number") out.add(p - 1);
  } catch (e) {
    console.error(JSON.stringify({ guardrails: "blocked_positions_failed", error: String((e as Error)?.message ?? e).slice(0, 200) }));
  } finally {
    if (timer) clearTimeout(timer);
  }
  return out;
}

/** Same shape back, with `hidden: true` when the pick is a blocked book. */
export async function guardRecommendation<T extends Book>(admin: SupabaseClient, rec: T | null | undefined): Promise<T | null | undefined> {
  if (!rec || typeof rec !== "object") return rec;
  const blocked = await blockedPositions(admin, [rec]);
  if (blocked.has(0)) return { ...rec, hidden: true };
  return rec;
}

/** Drops blocked entries from a list of books. */
export async function filterBlocked<T extends Book>(admin: SupabaseClient, list: T[]): Promise<T[]> {
  if (!Array.isArray(list) || !list.length) return list;
  const blocked = await blockedPositions(admin, list);
  return blocked.size ? list.filter((_, i) => !blocked.has(i)) : list;
}
