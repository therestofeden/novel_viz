import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { GlyphPlate } from "@/components/GlyphPlate";
import { glyphAxes, glyphSource, hasEnoughDna } from "@/lib/dna-glyph";

// PostgREST select with JSON-path aliases (title, book type, DNA only).
const WALL_QUERY =
  "select=slug,title,kind:analysis->>bookType,dna:analysis->dna&is_validated=eq.true&slug=not.is.null&limit=80";
const WALL_SIZE = 12;

type WallBook = {
  slug: string;
  title: string;
  kind: string | null;
  dna: { axes?: Array<{ id: string; score: number }> } | null;
};

/** Fisher-Yates over a copy; Math.random is fine for a decorative sample. */
function sample<T>(list: T[], n: number): T[] {
  const pool = [...list];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

/**
 * A wall of real books, each drawn as its DNA glyph on its own ink: the
 * signed-out home's proof that "every book gets a face". Reads already-cached,
 * validated analyses (public, slug-keyed) so it costs nothing and every plate
 * links to a page that exists. If the read fails or returns too little it
 * renders nothing rather than faking a wall.
 */
export function GlyphWall({ className }: { className?: string }) {
  const [books, setBooks] = useState<WallBook[] | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    let timedOut = false;
    // Plain setTimeout+abort (not AbortSignal.any/timeout) for older Safari.
    const timer = window.setTimeout(() => {
      timedOut = true;
      ctrl.abort();
    }, 8000);
    // A plain fetch to the public REST endpoint, not supabase-js: the client
    // queues every call behind the auth-session lock, which on a cold home
    // load can hold reads back for ~5s, and a signed-out visitor needs no
    // session for a public, validated-rows-only read.
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    fetch(`${url}/rest/v1/novel_analyses?${WALL_QUERY}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? (r.json() as Promise<WallBook[]>) : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        const usable = data.filter(
          (b) => b.slug && b.title && hasEnoughDna(glyphAxes(glyphSource(b.title, b.kind, b.dna?.axes))),
        );
        setBooks(sample(usable, WALL_SIZE));
      })
      .catch(() => {
        if (timedOut || !ctrl.signal.aborted) setBooks([]);
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, []);

  if (books !== null && books.length < 6) return null;

  return (
    <ul
      className={
        className ??
        "grid grid-cols-3 gap-3 pb-6 sm:grid-cols-4 md:grid-cols-3 md:gap-3.5 lg:grid-cols-4"
      }
      aria-label="Books drawn as their DNA"
    >
      {(books ?? Array.from({ length: WALL_SIZE }, () => null)).map((b, i) => (
        <li key={b?.slug ?? i} className={i % 2 === 1 ? "translate-y-5 md:translate-y-7" : undefined}>
          {b ? (
            <Link
              to={`/book/${b.slug}`}
              className="block aspect-[2/3] border border-foreground transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <GlyphPlate
                analysis={glyphSource(b.title, b.kind, b.dna?.axes)}
                titleClassName="text-[13px] md:text-sm"
              />
            </Link>
          ) : (
            <div className="aspect-[2/3] animate-pulse border border-foreground/20 bg-foreground/[0.06]" />
          )}
        </li>
      ))}
    </ul>
  );
}

export default GlyphWall;
