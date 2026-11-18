import { useMemo } from "react";

import type { NovelAnalysis } from "@/lib/novel-types";
import {
  GLYPH_BOX,
  LABELLED_VIEWBOX,
  NAVY,
  R_MAX,
  bookInk,
  describeGlyph,
  glyphAxes,
  hasEnoughDna,
  labelPositions,
  petalPath,
  spokePath,
} from "@/lib/dna-glyph";
import { cn } from "@/lib/utils";

/**
 * DnaGlyph: the book's DNA drawn as twelve petals in the book's own ink.
 * Geometry and colour rules live in src/lib/dna-glyph.ts.
 *
 * Variants:
 * - "page"  : ink petals on paper, with the dashed 100-ring and guide spokes.
 *             The hero on the book page; `labels` adds the axis names.
 * - "plate" : petals in the on-ink colour, for drawing ON an ink background
 *             (cover-plate fallback, neighbour posters, share card).
 * - "mark"  : bare petals, no ring; small sizes (headers, lists, autocomplete).
 *
 * Presentational only. Pinning an axis's evidence and dragging to register a
 * reader's take stay in BookDNA, which owns that state.
 */
export function DnaGlyph({
  analysis,
  size = 240,
  variant = "page",
  labels = false,
  className,
}: {
  analysis: NovelAnalysis;
  /** rendered width in px; height follows the viewBox */
  size?: number;
  variant?: "page" | "plate" | "mark";
  /** axis names around the ring (page variant only) */
  labels?: boolean;
  className?: string;
}) {
  const axes = useMemo(() => glyphAxes(analysis), [analysis]);
  const ink = useMemo(() => bookInk(analysis), [analysis]);
  const d = useMemo(() => petalPath(axes.map((a) => a.score)), [axes]);

  if (!hasEnoughDna(axes)) return null;

  const showLabels = labels && variant === "page";
  const vb = showLabels ? LABELLED_VIEWBOX : { x: 0, y: 0, w: GLYPH_BOX, h: GLYPH_BOX };
  const fill = variant === "plate" ? ink.onInk : ink.ink;
  const outline = variant !== "plate" && ink.outline;

  return (
    <svg
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      width={size}
      height={Math.round((size * vb.h) / vb.w)}
      role="img"
      aria-label={describeGlyph(axes)}
      className={cn("block", className)}
    >
      {variant === "page" && (
        <>
          <circle
            cx={100}
            cy={100}
            r={R_MAX}
            fill="none"
            stroke={NAVY}
            strokeOpacity={0.3}
            strokeWidth={0.5}
            strokeDasharray="1.5 2.5"
          />
          <path d={spokePath()} fill="none" stroke={NAVY} strokeOpacity={0.12} strokeWidth={0.5} />
        </>
      )}
      <path
        d={d}
        fill={fill}
        stroke={outline ? NAVY : undefined}
        strokeWidth={outline ? 0.6 : undefined}
        strokeLinejoin="miter"
      />
      {variant !== "plate" && <circle cx={100} cy={100} r={variant === "mark" ? 5 : 3} fill={NAVY} />}
      {showLabels &&
        labelPositions().map((p, i) => (
          <text
            key={axes[i].id}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            className="fill-foreground/80 font-sans"
            style={{ fontSize: 7 }}
            aria-hidden="true"
          >
            {axes[i].short}
          </text>
        ))}
    </svg>
  );
}

export default DnaGlyph;
