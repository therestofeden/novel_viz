import { useEffect, useState } from "react";
import type { MustReadEntry } from "@/lib/must-read";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  author?: string | null;
  /** "sm" = inline marker (lists/chips) · "md" = masthead stamp with the why-line */
  size?: "sm" | "md";
  className?: string;
}

/**
 * Editorial MUST READ stamp — NovelViz's curated verdict (see lib/must-read.ts).
 * Renders nothing when the book isn't on the list, so it can be dropped
 * anywhere a title/author pair exists.
 *
 * Loaded via dynamic import() rather than a static one for the same reason
 * as ClassicBadge (see that file's comment) — this component is used on
 * Index.tsx, so a static import of the data file pulls it into the eager
 * entry bundle on every visit instead of only when a badge actually renders.
 */
export const MustReadBadge = ({ title, author, size = "sm", className }: Props) => {
  const [entry, setEntry] = useState<MustReadEntry | null>(null);

  useEffect(() => {
    let active = true;
    import("@/lib/must-read").then(({ getMustRead }) => {
      if (active) setEntry(getMustRead(title, author));
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
          "meta inline-flex flex-shrink-0 items-center gap-1 border border-foreground bg-seal px-1.5 py-0.5 text-seal-foreground",
          className,
        )}
      >
        ✦ Must read
      </span>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-3 gap-y-1", className)}>
      <span className="meta inline-flex flex-shrink-0 items-center gap-1.5 border border-foreground bg-seal px-2 py-1 text-seal-foreground">
        ✦ NovelViz Must Read
      </span>
      <span className="font-serif text-sm italic text-muted-foreground">{entry.why}</span>
    </div>
  );
};
