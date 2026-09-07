import { useMemo } from "react";

import {
  NovelAnalysis,
  DnaAxisId,
  DNA_AXIS_IDS,
  DNA_AXIS_META,
  NF_DNA_AXIS_IDS,
  NF_DNA_AXIS_META,
  isNonFiction,
} from "@/lib/novel-types";
import { cn } from "@/lib/utils";

/**
 * DnaSignature — the twelve-bar fingerprint.
 *
 * Design note (2026-09-07): the 12-axis DNA is the one thing in this app a
 * ratings-and-reviews site structurally cannot build, and until now it lived
 * behind tab `03`, below the fold — a first-time visitor could bounce without
 * ever learning it existed. This component exists so the signature can sit in
 * the book header, above the fold, at a glance: twelve bars read as a
 * fingerprint before anyone knows what the axes are, which is exactly the
 * invitation to look closer.
 *
 * It is deliberately NOT interactive here. The real strand (draggable markers,
 * per-axis evidence) is BookDNA; this is the index card that points at it.
 * Rendered as plain divs rather than SVG so it inherits the app's ink/primary
 * tokens with no fill bookkeeping, and so bar heights animate for free.
 */

const BAR_MIN_PCT = 4; // a 0-score axis still needs to be visible as a mark

export function DnaSignature({
  analysis,
  className,
  barWidth = 7,
  height = 34,
  onClick,
}: {
  analysis: NovelAnalysis;
  className?: string;
  /** px width of each of the twelve bars */
  barWidth?: number;
  /** px height of the tallest possible bar */
  height?: number;
  /** when given, the whole strip becomes a button (used to jump to the strand) */
  onClick?: () => void;
}) {
  const nf = isNonFiction(analysis);
  const AXIS_IDS = nf
    ? (NF_DNA_AXIS_IDS as unknown as readonly DnaAxisId[])
    : DNA_AXIS_IDS;
  const AXIS_META = nf
    ? (NF_DNA_AXIS_META as unknown as typeof DNA_AXIS_META)
    : DNA_AXIS_META;

  const scores = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of analysis.dna?.axes ?? []) {
      if (typeof a?.score === "number") m.set(a.id, a.score);
    }
    // Always emit twelve slots in canonical axis order, so the silhouette is
    // comparable between two books even if one analysis is missing an axis.
    return AXIS_IDS.map((id) => ({
      id,
      name: AXIS_META[id]?.name ?? id,
      score: m.has(id) ? Math.max(0, Math.min(100, m.get(id)!)) : null,
    }));
  }, [analysis.dna, AXIS_IDS, AXIS_META]);

  const present = scores.filter((s) => s.score !== null).length;
  if (present < 6) return null; // too sparse to read as a fingerprint

  const label = `DNA signature: ${scores
    .filter((s) => s.score !== null)
    .map((s) => `${s.name} ${s.score}`)
    .join(", ")}`;

  const strip = (
    <div className="flex items-end gap-[3px]" style={{ height }} aria-hidden="true">
      {scores.map(({ id, score }) => (
        <div
          key={id}
          className={cn(
            "block transition-[height] duration-300 ease-out",
            score === null ? "bg-foreground/15" : "bg-primary",
          )}
          style={{
            width: barWidth,
            height: score === null ? "100%" : `${Math.max(BAR_MIN_PCT, score)}%`,
          }}
        />
      ))}
    </div>
  );

  if (!onClick) {
    return (
      <div className={className} role="img" aria-label={label}>
        {strip}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}. Jump to the full strand.`}
      className={cn(
        "group block cursor-pointer border-b border-transparent pb-1 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {strip}
    </button>
  );
}

export default DnaSignature;
