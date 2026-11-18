import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Discovery guardrails (2026-11-18). Some books (Mein Kampf, terrorist
 * manifestos: the list is public.discovery_blocklist) stay searchable and
 * keep their page, but NovelViz never suggests them and never links to a shop
 * for them. The server flags them (novel_analyses.discovery_blocked) and
 * marks AI picks that name one ({hidden: true}); this file is the client's
 * read of those flags.
 */

const cache = new Map<string, boolean>();

/** Is the book behind this cache key on the do-not-recommend list? */
export function useDiscoveryBlocked(cacheKey: string | null | undefined): boolean {
  const [blocked, setBlocked] = useState<boolean>(() => (cacheKey ? cache.get(cacheKey) ?? false : false));
  useEffect(() => {
    if (!cacheKey) { setBlocked(false); return; }
    const hit = cache.get(cacheKey);
    if (hit !== undefined) { setBlocked(hit); return; }
    let cancelled = false;
    supabase
      .from("novel_analyses")
      .select("discovery_blocked")
      .eq("cache_key", cacheKey)
      .maybeSingle()
      .then(({ data }) => {
        const value = data?.discovery_blocked === true;
        cache.set(cacheKey, value);
        if (!cancelled) setBlocked(value);
      });
    return () => { cancelled = true; };
  }, [cacheKey]);
  return blocked;
}

/** An AI pick the server marked as pointing at a blocked book. */
export function isHiddenPick(rec: unknown): boolean {
  return !!rec && typeof rec === "object" && (rec as { hidden?: unknown }).hidden === true;
}
