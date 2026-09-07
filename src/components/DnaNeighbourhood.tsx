import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";

import {
  DnaAxisId,
  DNA_AXIS_META,
  NF_DNA_AXIS_META,
} from "@/lib/novel-types";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/**
 * DnaNeighbourhood — the books nearest this one in 12-axis DNA space.
 *
 * Why this exists (2026-09-07): `analysis.recommendation` is a single title
 * Gemini invents, and an audit found only 26% of them name a book that
 * actually has a NovelViz page — which is why the recommendation panel's only
 * action was a shop link. This is the other half of the answer: neighbours
 * computed straight from DNA vectors we already store, filtered to books with
 * a slug, so every row is guaranteed to link back into the app.
 *
 * The two are deliberately different KINDS of thing and the copy says so —
 * the Gemini pick is a judgement (with reasons), this is a measurement (with
 * distances). Presenting them as one undifferentiated list would be dishonest
 * about where each came from.
 *
 * Match percentages are shown small and secondary on purpose: the real spread
 * across a typical top eight is only ~74-84%, so leading with the number would
 * imply a precision the metric doesn't have. Rank and shared axes carry the
 * meaning; the number is a footnote.
 */

const COLLAPSED_ROWS = 3;

export interface DnaNeighbour {
  cache_key: string;
  title: string;
  author: string;
  slug: string;
  distance: number;
  match_pct: number;
  shared_axes: string[];
}

export function DnaNeighbourhood({
  cacheKey,
  bookType,
  axes,
  isPerturbed,
  nonFiction,
  limit = 6,
  className,
}: {
  cacheKey?: string | null;
  bookType: string;
  /** the reader's *effective* axes, so dragging a slider re-ranks the list */
  axes: Array<{ id: string; score: number }>;
  /** true once the reader has moved anything away from the book's own DNA */
  isPerturbed: boolean;
  nonFiction: boolean;
  limit?: number;
  className?: string;
}) {
  const [rows, setRows] = useState<DnaNeighbour[] | null>(null);
  const [loading, setLoading] = useState(false);
  // Fetch the full set but show a short list: six rows is a screen on its own,
  // and this sits directly under an already-dense DNA band.
  const [showAll, setShowAll] = useState(false);
  const reqId = useRef(0);

  const AXIS_META = nonFiction
    ? (NF_DNA_AXIS_META as unknown as typeof DNA_AXIS_META)
    : DNA_AXIS_META;

  // Quantise to the nearest 5 before using axes as an effect dependency, so a
  // drag produces a handful of queries rather than one per pixel. Same coarse-
  // ness recommend-by-dna already uses for its own cache key.
  const axesSig = useMemo(
    () =>
      axes
        .map((a) => `${a.id}:${Math.round(a.score / 5) * 5}`)
        .sort()
        .join("|"),
    [axes],
  );

  useEffect(() => {
    if (!cacheKey) return;
    const id = ++reqId.current;
    let cancelled = false;

    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc("get_dna_neighbours", {
          p_cache_key: cacheKey,
          p_book_type: bookType === "nonfiction" ? "nonfiction" : "fiction",
          // only send a vector once the reader has actually moved something;
          // NULL lets the function use the book's own stored axes
          p_axes: isPerturbed ? axes.map((a) => ({ id: a.id, score: a.score })) : null,
          p_limit: limit,
        });
        // a slower earlier request must never overwrite a newer result
        if (cancelled || id !== reqId.current) return;
        if (error) {
          console.error("get_dna_neighbours error", error);
          setRows([]);
        } else {
          setRows((data ?? []) as DnaNeighbour[]);
        }
      } finally {
        if (!cancelled && id === reqId.current) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, bookType, limit, isPerturbed, axesSig]);

  // Nothing to say if the corpus has no neighbours for this book yet — better
  // silence than an empty rail (the review's "never render an empty slot").
  if (rows !== null && rows.length === 0) return null;

  return (
    <section className={cn("ink-border-t", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-foreground/20 px-4 py-3 md:px-8">
        <div className="meta flex items-center gap-2 text-muted-foreground">
          {loading && <Loader2 className="h-3 w-3 animate-spin" />}
          <span>
            {isPerturbed ? "Nearest to your DNA" : "Nearest in DNA space"}
          </span>
        </div>
        <div className="meta text-muted-foreground/70">
          Measured across {nonFiction ? "12 non-fiction" : "12"} axes · every title has a map
        </div>
      </div>

      {rows === null ? (
        <div className="grid gap-px">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 md:px-8">
              <div className="h-4 w-6 animate-pulse bg-foreground/10" />
              <div className="h-4 w-48 animate-pulse bg-foreground/10" />
            </div>
          ))}
        </div>
      ) : (
        <ol className="grid">
          {(showAll ? rows : rows.slice(0, COLLAPSED_ROWS)).map((n, i) => (
            <li key={n.cache_key} className="border-b border-foreground/20 last:border-b-0">
              <Link
                to={`/book/${n.slug}`}
                className="group flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:px-8"
              >
                <span className="meta w-6 shrink-0 tabular-nums text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>

                <span className="min-w-0 font-serif text-base italic leading-snug group-hover:underline md:text-lg">
                  {n.title}
                </span>

                <span className="meta shrink-0 text-muted-foreground">{n.author}</span>

                {n.shared_axes?.length > 0 && (
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="meta text-muted-foreground/70">Closest on</span>
                    {n.shared_axes.map((id) => (
                      <span
                        key={id}
                        className="meta border border-foreground/20 px-1.5 py-0.5 text-muted-foreground"
                      >
                        {AXIS_META[id as DnaAxisId]?.name ?? id}
                      </span>
                    ))}
                  </span>
                )}

                <span className="meta ml-auto shrink-0 tabular-nums text-muted-foreground/70">
                  {n.match_pct}%
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}

      {rows !== null && rows.length > COLLAPSED_ROWS && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="meta flex w-full items-center justify-between border-t border-foreground/20 px-4 py-3 text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:px-8"
        >
          <span>
            {showAll
              ? "Show fewer"
              : `Show all ${rows.length} neighbours`}
          </span>
          <span aria-hidden="true">{showAll ? "\u2191" : "\u2193"}</span>
        </button>
      )}
    </section>
  );
}

export default DnaNeighbourhood;
