import { cn } from "@/lib/utils";

/**
 * Placeholder shown while the recharts-backed <RatingDistribution> chunk
 * loads. Reserves the exact same box (ink-border card + h-40 plot area) so
 * the chart swapping in causes zero layout shift.
 */
export const RatingDistributionSkeleton = ({ className }: { className?: string }) => (
  <div className={cn("ink-border bg-card p-4", className)} aria-hidden>
    <div className="meta mb-3 flex items-center gap-3 text-muted-foreground">
      <span className="inline-block h-2 w-2 bg-primary/40" />
      <span className="inline-block h-2 w-24 bg-foreground/10" />
    </div>
    <div className="h-40 w-full animate-pulse bg-foreground/[0.04]" />
  </div>
);

export default RatingDistributionSkeleton;
