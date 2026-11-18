import { supabase } from "@/integrations/supabase/client";

/**
 * Map a book in the background (2026-11-18).
 *
 * Most AI picks ("Our pick" in "If you loved this shape") name a book that
 * has no NovelViz map yet: 149 of 184 book pages on 2026-11-18. Their poster
 * was an empty dashed shape with a "Map this book" link that sent the reader
 * away to the home page. Now, when that poster scrolls into view, the book is
 * mapped right there: analyze-novel in prefetch mode (cached forever, so each
 * pick is mapped once for everyone, rate-limited per visitor) and the poster
 * fills in with its real shape when it lands.
 *
 * Resolves to the new page's slug once the analysis is cached ("" when it
 * was cached but has no page), or null on any failure. One attempt per title
 * per page load.
 */

const MAP_TIMEOUT_MS = 120_000;
const attempts = new Map<string, Promise<string | null>>();

export function mapBookInBackground(title: string, author?: string | null): Promise<string | null> {
  const query = author && author !== "Unknown" ? `${title} by ${author}` : title;
  const key = query.trim().toLowerCase();
  const existing = attempts.get(key);
  if (existing) return existing;

  const run = (async (): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const geminiKey = (session?.user?.user_metadata?.gemini_key as string | undefined) || undefined;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-novel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ title: query, prefetch: true, ...(geminiKey ? { gemini_key: geminiKey } : {}) }),
        signal: AbortSignal.timeout(MAP_TIMEOUT_MS),
      });
      if (!res.ok || !res.body) return null;
      // Read the event stream frame by frame until the analysis (or an error).
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return null;
        buf += decoder.decode(value, { stream: true });
        let cut: number;
        while ((cut = buf.indexOf("\n\n")) !== -1) {
          const frame = buf.slice(0, cut);
          buf = buf.slice(cut + 2);
          const event = /^event:\s*(.+)$/m.exec(frame)?.[1]?.trim();
          if (event === "error") {
            reader.cancel().catch(() => {});
            return null;
          }
          if (event === "analysis") {
            reader.cancel().catch(() => {});
            const data = /^data:\s*(.*)$/m.exec(frame)?.[1];
            try {
              const parsed = data ? JSON.parse(data) : null;
              return typeof parsed?.slug === "string" ? parsed.slug : "";
            } catch {
              return "";
            }
          }
        }
      }
    } catch {
      return null;
    }
  })();

  attempts.set(key, run);
  run.then((slug) => { if (slug === null) attempts.delete(key); });
  return run;
}
