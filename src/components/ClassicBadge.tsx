import { useEffect, useState } from "react";
import type { ClassicEntry } from "@/lib/classic";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  author?: string | null;
  /** "sm" = inline marker (lists/chips) · "md" = masthead stamp with the why-line */
  size?: "sm" | "md";
  className?: string;
}

/**
 * Editorial CLASSIC marker — NovelViz's second-tier canon (see lib/classic.ts).
 * One rung below the Must Read gold seal: a pewter/silver fill (--classic)
 * so it reads as a distinct, deliberate second tier rather than a lesser
 * version of the same color — gold seal, silver marker. Border stays ink
 * per house style. Renders nothing when the book isn't on the list, or
 * when it's already a Must Read (the two stamps are mutually exclusive).
 *
 * `lib/classic.ts` is a hand-curated, daily-growing data file (3100+ lines,
 * ~260KB pre-minify as of 2026-09-07) — it was being statically imported
 * here, which pulled the whole thing into the eager entry bundle (this
 * component is used on Index.tsx, the home/search page that ships on
 * every single visit). Loading it via dynamic import() instead means
 * Rollup splits it into its own chunk that's only fetched the first time a
 * badge actually needs to render (after a real search result exists), not
 * on cold page load. The module is cached after the first fetch, so every
 * subsequent badge on the page (or a later page) resolves instantly.
 */
export const ClassicBadge = ({ title, author, size = "sm", className }: Props) => {
  const [entry, setEntry] = useState<ClassicEntry | null>(null);

  useEffect(() => {
    let active = true;
    import("@/lib/classic").then(({ getClassic }) => {
      if (active) setEntry(getClassic(title, author));
    });
    return () => {
      active = false;
    };
  }, [title, author]);

  if (!entry) return null;

  if (size === "sm") {
    return (
      <span
        title={entry.why}
        className={cn(
          "meta inline-flex flex-shrink-0 items-center gap-1 border border-foreground bg-classic px-1.5 py-0.5 text-classic-foreground",
          className,
        )}
      >
        ◆ Classic
      </span>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-3 gap-y-1", className)}>
      <span className="meta inline-flex flex-shrink-0 items-center gap-1.5 border border-foreground bg-classic px-2 py-1 text-classic-foreground">
        ◆ NovelViz Classic
      </span>
      <span className="font-serif text-sm italic text-muted-foreground">{entry.why}</span>
    </div>
  );
};
