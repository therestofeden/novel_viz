import { useMemo } from "react";
import { Area, Bar, CartesianGrid, ComposedChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

export interface RatingDistributionProps {
  /** counts[n] = number of ratings equal to n, for n in 0..10 (length 11). */
  counts: number[];
  total: number;
  avg?: number | null;
  /** e.g. "Your ratings" or "Reader ratings" */
  label: string;
  className?: string;
}

/**
 * Fills a sparse {rating: count} map (as stored in book_rating_stats'
 * jsonb, which only keys ratings that actually occurred) into a dense
 * 0..10 array for charting.
 */
export function densifyRatingCounts(counts: Record<string, number> | null | undefined): number[] {
  const out = new Array<number>(11).fill(0);
  if (!counts) return out;
  for (const [k, v] of Object.entries(counts)) {
    const n = Number(k);
    if (Number.isInteger(n) && n >= 0 && n <= 10) out[n] = v;
  }
  return out;
}

// Triangular-kernel smoothing over the 11 discrete rating bins, rescaled to
// the same peak height as the raw counts — reads as a density envelope
// drawn over the histogram rather than a second, independently-scaled
// series (which would either dwarf or vanish next to the bars).
function smoothedDensity(counts: number[]): number[] {
  const n = counts.length;
  const raw = counts.map((c, i) => {
    const prev = i > 0 ? counts[i - 1] : c;
    const next = i < n - 1 ? counts[i + 1] : c;
    return (prev + c * 2 + next) / 4;
  });
  const rawMax = Math.max(...raw, 0);
  const countMax = Math.max(...counts, 0);
  if (rawMax === 0 || countMax === 0) return raw;
  const scale = countMax / rawMax;
  return raw.map((v) => v * scale);
}

const RatingTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number }>;
  label?: number;
}) => {
  if (!active || !payload?.length) return null;
  const count = payload.find((p) => p.dataKey === "count")?.value ?? 0;
  return (
    <div className="ink-border bg-card px-2 py-1 shadow-none">
      <span className="meta text-foreground">
        <span className="display-num">{label}</span>/10 — {count} {count === 1 ? "rating" : "ratings"}
      </span>
    </div>
  );
};

/**
 * Editorial histogram of 0–10 ratings with a smoothed density curve
 * overlaid at partial opacity. Used for both a reader's own shelf-wide
 * ratings (computed client-side) and a single book's cross-reader
 * aggregate (from the cached book_rating_stats table — see
 * 20260715120000 migration).
 */
export const RatingDistribution = ({ counts, total, avg, label, className }: RatingDistributionProps) => {
  const data = useMemo(() => {
    const density = smoothedDensity(counts);
    return counts.map((count, rating) => ({ rating, count, density: density[rating] }));
  }, [counts]);

  if (total === 0) return null;

  return (
    <div className={cn("ink-border bg-card p-4", className)}>
      <div className="meta mb-3 flex flex-wrap items-baseline gap-3 text-muted-foreground">
        <span className="inline-block h-2 w-2 bg-primary" />
        {label}
        <span className="inline-block h-px w-8 bg-foreground/40" />
        <span className="text-foreground">
          {total} {total === 1 ? "rating" : "ratings"}
        </span>
        {avg != null && (
          <>
            <span className="text-foreground/30">·</span>
            <span className="display-num text-foreground">{avg.toFixed(1)}</span>
            <span>avg</span>
          </>
        )}
      </div>
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--foreground) / 0.08)" />
            <XAxis
              dataKey="rating"
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--foreground))" }}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              interval={0}
            />
            <YAxis hide allowDecimals={false} />
            <Tooltip content={<RatingTooltip />} cursor={{ fill: "hsl(var(--foreground) / 0.06)" }} />
            <Bar dataKey="count" fill="hsl(var(--foreground) / 0.15)" stroke="hsl(var(--foreground))" strokeWidth={1} radius={0} />
            <Area
              type="monotone"
              dataKey="density"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="hsl(var(--primary))"
              fillOpacity={0.28}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
