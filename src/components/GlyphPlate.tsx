import { useMemo } from "react";

import { DnaGlyph } from "@/components/DnaGlyph";
import type { NovelAnalysis } from "@/lib/novel-types";
import { bookInk } from "@/lib/dna-glyph";
import { cn } from "@/lib/utils";

/**
 * GlyphPlate: a book's "jacket" drawn from its DNA, in its own ink.
 * Used where there is no cover art (CoverPlate fallback) and for the
 * "If you loved this shape" posters. Fills its parent; the parent sets the
 * 2:3 frame and border.
 */
export function GlyphPlate({
  analysis,
  label,
  showTitle = true,
  titleClassName,
  className,
}: {
  analysis: NovelAnalysis;
  /** small text in the top corner, e.g. "84% match" */
  label?: string;
  showTitle?: boolean;
  titleClassName?: string;
  className?: string;
}) {
  const ink = useMemo(() => bookInk(analysis), [analysis]);
  return (
    <div
      className={cn("flex h-full w-full flex-col justify-between p-[9%]", className)}
      style={{ backgroundColor: ink.ink, color: ink.onInk }}
    >
      <span className="font-mono text-[11px] leading-none tracking-tight">{label ?? " "}</span>
      <span className="flex flex-1 items-center justify-center py-[6%]" aria-hidden="true">
        <DnaGlyph analysis={analysis} variant="plate" size={140} className="h-auto w-[72%]" />
      </span>
      {showTitle ? (
        <span className={cn("line-clamp-4 break-words font-serif italic leading-[1.05]", titleClassName)} title={analysis.title}>
          {analysis.title}
        </span>
      ) : (
        <span aria-hidden="true">{" "}</span>
      )}
    </div>
  );
}

export default GlyphPlate;
