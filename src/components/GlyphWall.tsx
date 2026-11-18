import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { GlyphPlate } from "@/components/GlyphPlate";
import { glyphAxes, glyphSource, hasEnoughDna } from "@/lib/dna-glyph";
import { supabase } from "@/integrations/supabase/client";

// Widened to `string` on purpose: supabase-js's typed select parser recurses
// too deeply on a JSON-path alias and trips TS2589.
const WALL_SELECT: string = "slug, title, kind:analysis->>bookType, dna:analysis->dna";
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
    let cancelled = false;
    supabase
      .from("novel_analyses")
      .select(WALL_SELECT)
      .eq("is_validated", true)
      .not("slug", "is", null)
      .limit(80)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setBooks([]);
          return;
        }
        const usable = (data as unknown as WallBook[]).filter(
          (b) => b.slug && b.title && hasEnoughDna(glyphAxes(glyphSource(b.title, b.kind, b.dna?.axes))),
        );
        setBooks(sample(usable, WALL_SIZE));
      });
    return () => {
      cancelled = true;
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
