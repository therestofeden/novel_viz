import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";

import {
  DnaAxisId,
  DNA_AXIS_META,
  NF_DNA_AXIS_META,
} from "@/lib/novel-types";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { GlyphPlate } from "@/components/GlyphPlate";
import { glyphSource } from "@/lib/dna-glyph";

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

const COLLAPSED_ROWS = 3; // plus the judged pick = one row of four on desktop

// Widened to `string` on purpose: supabase-js's typed select parser recurses
// too deeply on a JSON-path alias and trips TS2589.
const DNA_SELECT: string = "slug, dna:analysis->dna";

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
  lead,
  subtitle,
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
  /** rendered first in the poster row (BookDNA passes the judged pick) */
  lead?: ReactNode;
  /** replaces the default line beside the heading */
  subtitle?: string;
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

  // Each neighbour's own DNA, so its poster can carry its glyph and ink.
  // One small public read per result set (slug-keyed, validated rows only).
  const [dnaBySlug, setDnaBySlug] = useState<Record<string, Array<{ id: string; score: number }>>>({});
  const slugKey = rows?.map((r) => r.slug).join("|") ?? "";
  useEffect(() => {
    const slugs = rows?.map((r) => r.slug).filter((s) => s && !dnaBySlug[s]) ?? [];
    if (slugs.length === 0) return;
    let cancelled = false;
    supabase
      .from("novel_analyses")
      .select(DNA_SELECT)
      .in("slug", slugs)
      .eq("is_validated", true)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const next: Record<string, Array<{ id: string; score: number }>> = {};
        for (const row of data as unknown as Array<{ slug: string; dna: { axes?: Array<{ id: string; score: number }> } | null }>) {
          if (row.slug && row.dna?.axes) next[row.slug] = row.dna.axes;
        }
        setDnaBySlug((m) => ({ ...m, ...next }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugKey]);

  // Nothing to say if the corpus has no neighbours for this book yet: better
  // silence than an empty rail (the review's "never render an empty slot").
  // The lead (the judged pick) still renders on its own.
  const visible = rows === null ? [] : showAll ? rows : rows.slice(0, COLLAPSED_ROWS);

  if (rows !== null && rows.length === 0 && !lead) return null;

  return (
    <section className={cn("mx-auto max-w-[1280px] px-4 py-8 md:px-8 md:py-12", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-serif text-[1.75rem] font-normal leading-tight tracking-[-0.015em] md:text-[2.5rem]">
          If you loved this shape
        </h2>
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          {subtitle ?? (isPerturbed ? "Re-ranked for your take" : "Measured across twelve axes")}
        </span>
      </div>

      <ol className="-mx-4 mt-5 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:mt-7 md:grid md:grid-cols-4 md:gap-x-5 md:gap-y-8 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
        {lead}
        {rows === null
          ? Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="w-[148px] shrink-0 md:w-auto">
                <div className="aspect-[2/3] w-full animate-pulse border border-foreground/20 bg-foreground/[0.06]" />
              </li>
            ))
          : visible.map((n) => {
              const axes = dnaBySlug[n.slug];
              return (
                <BookPoster
                  key={n.cache_key}
                  to={`/book/${n.slug}`}
                  title={n.title}
                  author={n.author}
                  plate={
                    axes ? (
                      <GlyphPlate
                        analysis={glyphSource(n.title, bookType, axes)}
                        label={`${n.match_pct}% match`}
                        titleClassName="text-[15px] md:text-xl"
                      />
                    ) : (
                      <div className="h-full w-full animate-pulse bg-foreground/[0.06]" />
                    )
                  }
                  caption={
                    n.shared_axes?.length
                      ? `Closest on ${n.shared_axes
                          .slice(0, 3)
                          .map((id) => (AXIS_META[id as DnaAxisId]?.name ?? id).toLowerCase())
                          .join(", ")}`
                      : undefined
                  }
                />
              );
            })}
      </ol>

      {rows !== null && rows.length > COLLAPSED_ROWS && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="mt-4 min-h-[44px] text-sm text-[hsl(var(--primary-dark))] underline-offset-4 hover:underline"
        >
          {showAll ? "Show fewer" : `Show all ${rows.length} neighbours`}
        </button>
      )}
    </section>
  );
}

/**
 * One book drawn as a poster: a 2:3 plate (its glyph, in its ink) with the
 * title on it, then author and a one-line reason underneath. The plate and
 * title are the link; anything in `footer` sits outside it.
 */
export function BookPoster({
  to,
  title,
  author,
  plate,
  caption,
  footer,
}: {
  to: string;
  title: string;
  author?: string | null;
  plate: ReactNode;
  caption?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <li className="flex w-[148px] shrink-0 snap-start flex-col gap-2 md:w-auto">
      <Link
        to={to}
        className="group flex flex-col gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="aspect-[2/3] w-full overflow-hidden border border-foreground transition-transform duration-200 group-hover:-translate-y-0.5">
          {plate}
        </div>
        <span className="sr-only">{title}</span>
        {author && <span className="text-sm font-medium leading-snug">{author}</span>}
      </Link>
      {caption && <span className="text-[13px] leading-snug text-muted-foreground">{caption}</span>}
      {footer}
    </li>
  );
}

export default DnaNeighbourhood;
