import { getMustRead } from "@/lib/must-read";
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
 */
export const MustReadBadge = ({ title, author, size = "sm", className }: Props) => {
  const entry = getMustRead(title, author);
  if (!entry) return null;

  if (size === "sm") {
    return (
      <span
        title={entry.why}
        className={cn(
          "meta inline-flex flex-shrink-0 items-center gap-1 border border-foreground bg-foreground px-1.5 py-0.5 text-background",
          className,
        )}
      >
        ✦ Must read
      </span>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-3 gap-y-1", className)}>
      <span className="meta inline-flex flex-shrink-0 items-center gap-1.5 border border-foreground bg-foreground px-2 py-1 text-background">
        ✦ NovelViz Must Read
      </span>
      <span className="font-serif text-sm italic text-muted-foreground">{entry.why}</span>
    </div>
  );
};
