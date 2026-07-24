/**
 * Pure helper for rating histograms — deliberately kept OUT of
 * RatingDistribution.tsx.
 *
 * RatingDistribution imports recharts (~333 kB raw / 84 kB gzip once d3 is
 * pulled in). BookPage only needs this 8-line densifier at data-fetch time,
 * long before the chart is on screen. If it lived in the chart module, the
 * static import would drag the whole recharts tree onto BookPage's critical
 * path and defeat the lazy() boundary around the chart itself.
 */

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
