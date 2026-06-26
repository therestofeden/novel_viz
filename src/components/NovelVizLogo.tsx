import { cn } from "@/lib/utils";

/**
 * NovelViz brand mark — "The Fan"
 *
 * A character-network fan: five nodes connected by arcs, radiating from an
 * anchor point. Uses currentColor so it adapts to any theme context.
 *
 * Usage:
 *   <NovelVizLogo className="text-[#5ba3d9]" size={32} />
 *   <NovelVizLogo className="text-foreground" size={24} />
 */
interface Props {
  size?: number;
  className?: string;
  "aria-hidden"?: boolean;
}

export function NovelVizLogo({ size = 24, className, "aria-hidden": ariaHidden = true }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={ariaHidden}
      focusable="false"
      className={cn("flex-shrink-0", className)}
    >
      {/* Page rays from anchor */}
      <line x1="9" y1="91" x2="16" y2="14" stroke="currentColor" strokeWidth="1.5" opacity="0.34" />
      <line x1="9" y1="91" x2="37" y2="19" stroke="currentColor" strokeWidth="1.5" opacity="0.34" />
      <line x1="9" y1="91" x2="56" y2="30" stroke="currentColor" strokeWidth="1.5" opacity="0.34" />
      <line x1="9" y1="91" x2="70" y2="44" stroke="currentColor" strokeWidth="1.5" opacity="0.34" />
      <line x1="9" y1="91" x2="80" y2="61" stroke="currentColor" strokeWidth="1.5" opacity="0.34" />
      {/* Outer arc */}
      <path d="M 16 14 A 77 77 0 0 1 80 61" stroke="currentColor" strokeWidth="1.9" />
      {/* Character connections */}
      <line x1="16" y1="14" x2="56" y2="30" stroke="currentColor" strokeWidth="1.3" />
      <line x1="37" y1="19" x2="70" y2="44" stroke="currentColor" strokeWidth="1.3" />
      <line x1="56" y1="30" x2="80" y2="61" stroke="currentColor" strokeWidth="1.3" />
      <line x1="16" y1="14" x2="80" y2="61" stroke="currentColor" strokeWidth="0.9" opacity="0.3" />
      {/* Nodes */}
      <circle cx="16" cy="14" r="4.5" fill="currentColor" />
      <circle cx="37" cy="19" r="4.5" fill="currentColor" />
      <circle cx="56" cy="30" r="4.5" fill="currentColor" />
      <circle cx="70" cy="44" r="4.5" fill="currentColor" />
      <circle cx="80" cy="61" r="4.5" fill="currentColor" />
      {/* Anchor node (larger) */}
      <circle cx="9" cy="91" r="5.8" fill="currentColor" />
    </svg>
  );
}
