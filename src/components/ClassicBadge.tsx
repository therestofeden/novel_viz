import { getClassic } from "@/lib/classic";
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
 * One rung below the Must Read seal, styled a rung quieter to match: an ink
 * outline rather than a solid fill, so the visual weight itself signals the
 * tier. Renders nothing when the book isn't on the list, or when it's
 * already a Must Read (the two stamps are mutually exclusive).
 */
export const ClassicBadge = ({ title, author, size = "sm", className }: Props) => {
  const entry = getClassic(title, author);
  if (!entry) return null;

  if (size === "sm") {
    return (
      <span
        title={entry.why}
        className={cn(
          "meta inline-flex flex-shrink-0 items-center gap-1 border border-foreground/40 px-1.5 py-0.5 text-foreground/70",
          className,
        )}
      >
        ◆ Classic
      </span>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-3 gap-y-1", className)}>
      <span className="meta inline-flex flex-shrink-0 items-center gap-1.5 border border-foreground/40 px-2 py-1 text-foreground/70">
        ◆ NovelViz Classic
      </span>
      <span className="font-serif text-sm italic text-muted-foreground">{entry.why}</span>
    </div>
  );
};
