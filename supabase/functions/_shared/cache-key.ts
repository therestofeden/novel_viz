// 2026-11-14 (daily_backend): keyed hash for cache-table lookup keys that are
// derived from what a reader typed (e.g. search_cache.query_key).
//
// Defense in depth for the search_cache exposure (see
// migrations/20261027120000_private_server_caches.sql): even if a table is
// ever readable with the anon key, or a backup/log export leaks, the stored
// key no longer reveals the reader's query. The pepper is a server secret, so
// the hash can't be reversed with a dictionary of likely queries. Lookups stay
// O(1) equality on the same unique column; cost is one SHA-256 (~µs).
//
// If the pepper ever rotates, existing rows simply miss and age out via the
// 24h purge — no migration needed.

export async function hashCacheKey(
  namespace: string,
  key: string,
  pepper: string = Deno.env.get("CACHE_KEY_PEPPER") ??
    Deno.env.get("RATE_LIMIT_SALT") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    "",
): Promise<string> {
  const data = new TextEncoder().encode(`${namespace}\u0000${pepper}\u0000${key}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
