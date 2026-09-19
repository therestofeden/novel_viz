import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { NovelVizLogo } from "@/components/NovelVizLogo";
import { Reveal, motion, ease } from "@/lib/motion";

const ReactMarkdown = lazy(() => import("react-markdown"));
const MarkdownFallback = () => <span className="meta text-muted-foreground">…</span>;

import {
  FictionAnalysis,
  NovelAnalysis,
  NonFictionAnalysis,
  PlotEvent,
  isFiction,
  isNonFiction,
  normalizeAnalysis,
} from "@/lib/novel-types";
// The 7 tab views below are the actual "visualize any book" feature, but only
// ONE of them is ever visible at a time (gated by `view === ...` — the default
// is set the instant an analysis loads, see setView() in loadAnalysis below).
// All 7 were previously statically imported, so all ~4,700 lines of their
// combined code shipped in BookPage's critical-path bundle on every visit —
// six-sevenths of it guaranteed dead weight on first paint. Same fix already
// applied to RatingDistribution/ReactMarkdown below: lazy() + Suspense per
// tab, so only the one tab the reader actually lands on is fetched/parsed
// before the page can render, and switching tabs fetches the rest on demand.
const TimelineView = lazy(() => import("@/components/TimelineView").then((m) => ({ default: m.TimelineView })));
const CharacterNetwork = lazy(() => import("@/components/CharacterNetwork").then((m) => ({ default: m.CharacterNetwork })));
const BookDNA = lazy(() => import("@/components/BookDNA").then((m) => ({ default: m.BookDNA })));
const ConceptMap = lazy(() => import("@/components/ConceptMap").then((m) => ({ default: m.ConceptMap })));
const IdeasTab = lazy(() => import("@/components/IdeasTab").then((m) => ({ default: m.IdeasTab })));
const ChapterBreakdown = lazy(() => import("@/components/ChapterBreakdown").then((m) => ({ default: m.ChapterBreakdown })));
const TakeawaysTab = lazy(() => import("@/components/TakeawaysTab").then((m) => ({ default: m.TakeawaysTab })));
// Lightweight, generic fallback — shown only for the split-second a tab
// chunk is fetching (instant on repeat visits/tab-switches, since the chunk
// is cached after first load). Intentionally minimal, not a full skeleton,
// since this is now off the critical path rather than blocking first paint.
const TabFallback = () => (
  <div className="flex min-h-[240px] items-center justify-center">
    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
  </div>
);
import { ReaderNotes } from "@/components/ReaderNotes";
import { DnaSignature } from "@/components/DnaSignature";
import { ShelfChip } from "@/components/ShelfChip";
import { MustReadBadge } from "@/components/MustReadBadge";
import { ClassicBadge } from "@/components/ClassicBadge";
import { densifyRatingCounts } from "@/lib/rating-counts";
import { RatingDistributionSkeleton } from "@/components/RatingDistributionSkeleton";
// recharts + d3 is ~333 kB raw / 84 kB gzip and the chart sits below the
// fold. Statically importing it blocked BookPage from rendering at all
// until that chunk had downloaded and parsed; lazy() moves it off the
// critical path so the page paints first and the chart fills in.
const RatingDistribution = lazy(() => import("@/components/RatingDistribution"));
import { BuyButton } from "@/components/BuyButton";
import { ShareButton } from "@/components/ShareButton";
import { CoverPlate } from "@/components/CoverPlate";
import { fetchCoverUrl } from "@/lib/covers";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type LoadState = "loading" | "found" | "not-found";

const BookPage = () => {
  const { slug } = useParams<{ slug: string }>();

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [analysis, setAnalysis] = useState<NovelAnalysis | null>(null);
  const [cacheKey, setCacheKey] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [ratingStats, setRatingStats] = useState<{ counts: number[]; total: number; avg: number | null } | null>(null);

  // View / spoiler state (mirrors Index)
  const [view, setView] = useState<"timeline" | "network" | "dna" | "concepts" | "ideas" | "chapters" | "takeaways">("network");
  const [showSpoilers, setShowSpoilers] = useState(true);
  const [progress, setProgress] = useState(100);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);

  // Reset view state when analysis changes
  useEffect(() => {
    setSelectedEventId(null);
    setSelectedCharacterId(null);
  }, [analysis?.title]);

  // Cover art
  useEffect(() => {
    if (!analysis) { setCoverUrl(null); return; }
    fetchCoverUrl(analysis.title, analysis.author ?? "").then(setCoverUrl);
  }, [analysis?.title]);

  // Load from Supabase by slug
  useEffect(() => {
    if (!slug) { setLoadState("not-found"); return; }

    setLoadState("loading");
    setAnalysis(null);

    supabase
      .from("novel_analyses")
      .select("analysis, title, author, cache_key, id, hit_count")
      .eq("slug", slug)
      .eq("is_validated", true)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error("BookPage load error:", error);
          setLoadState("not-found");
          return;
        }
        if (!data?.analysis) {
          setLoadState("not-found");
          return;
        }

        const normalized = normalizeAnalysis(data.analysis as Record<string, unknown>);
        setAnalysis(normalized);
        setCacheKey(data.cache_key ?? null);
        setView(normalized.bookType === "nonfiction" ? "ideas" : "network");
        setLoadState("found");

        // Bump hit_count + last_accessed_at asynchronously — never block render.
        supabase
          .from("novel_analyses")
          .update({
            hit_count: (data.hit_count ?? 0) + 1,
            last_accessed_at: new Date().toISOString(),
          })
          .eq("id", (data as any).id)
          .then(() => {})
          .catch((e: unknown) => console.error("hit bump error:", e));
      });
  }, [slug]);

  // Cross-reader rating distribution — read-only public aggregate maintained
  // server-side (shelf_books is per-user RLS'd, see 20260715120000
  // migration). Only shown once a book has enough signal to be meaningful
  // (5+ ratings, per product call — an earlier reveal on 1-2 ratings would
  // just show a single spike and read as noise, not a distribution).
  const RATING_STATS_MIN = 5;
  useEffect(() => {
    setRatingStats(null);
    if (!cacheKey) return;
    let cancelled = false;
    supabase
      .from("book_rating_stats")
      .select("rating_counts, total_ratings, avg_rating")
      .eq("cache_key", cacheKey)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error || !data || data.total_ratings < RATING_STATS_MIN) return;
        setRatingStats({
          counts: densifyRatingCounts(data.rating_counts as Record<string, number>),
          total: data.total_ratings,
          avg: data.avg_rating,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [cacheKey]);

  const effectiveProgress = showSpoilers ? 100 : progress;

  const highlightedCharacterIds = useMemo(() => {
    if (!analysis || !selectedEventId || !isFiction(analysis)) return [];
    return (analysis as FictionAnalysis).events.find((e) => e.id === selectedEventId)?.characterIds ?? [];
  }, [analysis, selectedEventId]);

  const handleSelectEvent = (e: PlotEvent | null) => {
    setSelectedEventId(e?.id ?? null);
    if (e && !showSpoilers && e.position > progress) {
      setProgress(Math.min(100, e.position));
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  // Renders the same masthead SHAPE the real content will occupy (grid,
  // column widths, stat boxes) instead of collapsing to a blank centered
  // spinner. This is the entry point for every shared/saved-book link, so
  // it's often a visitor's first-ever impression of the app — a skeleton
  // that already looks like "a book page" reads as fast even while the one
  // Supabase round trip is still in flight, instead of reading as broken.
  if (loadState === "loading") {
    const bar = (w: string, extra = "") => (
      <div className={cn("h-3 animate-pulse rounded bg-muted-foreground/20", extra)} style={{ width: w }} />
    );
    return (
      <div className="min-h-screen">
        <div className="dateline-strip">
          <span>NovelViz</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>Visualize any book</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>Est. 2024</span>
        </div>
        <Reveal as="header" duration={0.7} y={12} className="rule-double-b bg-background">
          <div className="container mx-auto flex items-stretch justify-between">
            <Link
              to="/"
              className="group flex items-center gap-3 border-r border-foreground px-4 py-5 transition-colors hover:bg-foreground/10"
            >
              <NovelVizLogo size={56} className="text-foreground transition-colors group-hover:text-[#5ba3d9]" />
              <div className="leading-none">
                <div className="font-sans text-2xl font-bold tracking-[-0.03em]">NovelViz</div>
                <div className="meta mt-1.5 text-muted-foreground">Visualize any book</div>
              </div>
            </Link>
          </div>
        </Reveal>

        <main className="container mx-auto px-0">
          <section className="grid grid-cols-12 gap-0 ink-border-b">
            <div className="col-span-12 border-foreground px-4 py-6 md:col-span-2 md:border-r md:py-8">
              <div className="meta text-muted-foreground">Subject</div>
              {bar("2.5rem", "mt-3 h-8")}
              {bar("60%", "mt-2")}
            </div>
            <div className="col-span-12 px-4 py-6 md:col-span-7 md:px-8 md:py-8">
              {bar("30%")}
              {bar("70%", "mt-3 h-9")}
              {bar("95%", "mt-4")}
              {bar("85%", "mt-2")}
              {bar("40%", "mt-2")}
              <div className="mt-4 flex flex-wrap gap-3">
                {bar("5rem", "h-8")}
                {bar("6rem", "h-8")}
                {bar("4rem", "h-8")}
              </div>
            </div>
            <div className="col-span-12 grid grid-cols-2 border-foreground md:col-span-3 md:border-l">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "border-foreground p-4",
                    i < 2 && "md:border-b",
                    i % 2 === 1 && "border-l",
                    i >= 2 && "border-t",
                  )}
                >
                  <div className="meta text-muted-foreground">&nbsp;</div>
                  {bar("2rem", "mt-2 h-7")}
                </div>
              ))}
            </div>
          </section>
          <section className="ink-border-b flex items-center justify-center px-4 py-3 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <span className="meta">Loading…</span>
          </section>
        </main>
      </div>
    );
  }

  // ── Not found state ────────────────────────────────────────────────────────
  if (loadState === "not-found" || !analysis) {
    const titleHint = slug
      ? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : "";
    return (
      <div className="flex min-h-screen flex-col">
        <div className="dateline-strip">
          <span>NovelViz</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>Visualize any book</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>Est. 2024</span>
        </div>
        <Reveal as="header" duration={0.7} y={12} className="rule-double-b bg-background">
          <div className="container mx-auto flex items-stretch justify-between">
            <Link
              to="/"
              className="group flex items-center gap-3 border-r border-foreground px-4 py-5 transition-colors hover:bg-foreground/10"
            >
              <NovelVizLogo size={56} className="text-foreground transition-colors group-hover:text-[#5ba3d9]" />
              <div className="leading-none">
                <div className="font-sans text-2xl font-bold tracking-[-0.03em]">NovelViz</div>
                <div className="meta mt-1.5 text-muted-foreground">Visualize any book</div>
              </div>
            </Link>
          </div>
        </Reveal>
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="display-num mb-4 text-6xl text-muted-foreground/30">404</div>
          <h1 className="font-sans text-3xl font-bold tracking-tight">
            {titleHint ? `"${titleHint}" isn't cached yet` : "Book not found"}
          </h1>
          <p className="mt-4 max-w-md mx-auto font-serif text-base leading-relaxed text-muted-foreground">
            This URL only shows books that have already been analyzed and cached.
            Search for the book on the home page to generate its visualization.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {titleHint ? (
              <Link
                to={`/?book=${encodeURIComponent(titleHint)}`}
                className="meta inline-flex items-center gap-2 border border-foreground bg-primary px-5 py-3 text-primary-foreground transition-colors hover:bg-primary-dark hover:text-white"
              >
                → Analyze "{titleHint}"
              </Link>
            ) : null}
            <Link
              to="/"
              className="meta inline-flex items-center gap-2 border border-foreground bg-card px-5 py-3 transition-colors hover:bg-foreground/10"
            >
              ← Search another book
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Full analysis display ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen">
      {/* ===================== DATELINE STRIP ===================== */}
      <div className="dateline-strip">
        <span>NovelViz</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>Visualize any book</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>Est. 2024</span>
      </div>
      {/* ===================== HEADER ===================== */}
      <Reveal as="header" duration={0.7} y={12} className="rule-double-b bg-background">
        <div className="container mx-auto flex items-stretch justify-between">
          <div className="flex items-stretch">
            <Link
              to="/"
              className="group flex items-center gap-3 border-r border-foreground px-4 py-5 transition-colors hover:bg-foreground/10"
            >
              <NovelVizLogo size={56} className="text-foreground transition-colors group-hover:text-[#5ba3d9]" />
              <div className="leading-none">
                <div className="font-sans text-2xl font-bold tracking-[-0.03em]">NovelViz</div>
                <div className="meta mt-1.5 text-muted-foreground">Visualize any book</div>
              </div>
            </Link>
          </div>
          <div className="flex items-stretch">
            <Link
              to="/"
              className="meta flex items-center gap-2 border-l border-foreground px-5 py-5 transition-colors hover:bg-foreground/10"
            >
              ← Search another book
            </Link>
          </div>
        </div>
      </Reveal>

      <main className="container mx-auto px-0">
        {/* ===================== ANALYSIS MASTHEAD ===================== */}
        <section id="analysis-anchor" className="grid grid-cols-12 gap-0 ink-border-b scroll-mt-20">
          <div className="col-span-12 border-foreground px-4 py-6 md:col-span-2 md:border-r md:py-8">
            <div className="flex items-start gap-4 md:flex-col md:gap-0">
              <CoverPlate
                coverUrl={coverUrl}
                title={analysis.title}
                author={analysis.author}
                className="w-14 md:mb-4 md:w-full md:max-w-[108px]"
              />
              <div>
                <div className="meta text-muted-foreground">Subject</div>
                <div className="display-num mt-2 text-4xl md:text-6xl">
                  {isFiction(analysis)
                    ? String(analysis.events?.length ?? 0).padStart(2, "0")
                    : String((analysis as NonFictionAnalysis).concepts?.length ?? 0).padStart(2, "0")}
                </div>
                <div className="meta mt-2 text-muted-foreground">
                  {isFiction(analysis) ? "Events Mapped" : "Concepts"}
                </div>
              </div>
            </div>
          </div>
          <div className="col-span-12 px-4 py-6 md:col-span-7 md:px-8 md:py-8">
            <div className={analysis.author && analysis.author !== "Unknown" ? "font-serif italic text-lg text-muted-foreground" : "meta text-muted-foreground"}>
              {analysis.author && analysis.author !== "Unknown"
                ? `By ${analysis.author}`
                : "Visualization"}
            </div>
            <h1 className="mt-2 font-sans text-3xl font-extrabold leading-[1] tracking-tight md:text-6xl">
              {analysis.title}
            </h1>
            <MustReadBadge title={analysis.title} author={analysis.author} size="md" className="mt-3" />
            <ClassicBadge title={analysis.title} author={analysis.author} size="md" className="mt-3" />
            {isNonFiction(analysis) && (analysis as NonFictionAnalysis).thesis && (
              <p className="mt-2 font-sans text-sm font-medium text-primary/80 italic">
                "{(analysis as NonFictionAnalysis).thesis}"
              </p>
            )}
            {/* 2026-09-07: the DNA signature moves above the fold. It is the
                one thing here a ratings-and-reviews site structurally cannot
                produce, and it used to live behind tab 03 where a bouncing
                visitor never saw it. Twelve bars read as a fingerprint before
                anyone knows what the axes are — which is the invitation to
                look. `dna.signature` was likewise generated for every book and
                rendered nowhere a first-time reader would find it. */}
            {analysis.dna?.axes?.length ? (
              <button
                type="button"
                onClick={() =>
                  document
                    .getElementById("dna-anchor")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                className="group mt-4 flex flex-wrap items-end gap-x-4 gap-y-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <DnaSignature analysis={analysis} height={38} barWidth={8} />
                <span className="flex flex-col gap-0.5">
                  <span className="meta text-muted-foreground">DNA signature</span>
                  {analysis.dna?.signature && (
                    <span className="font-serif text-sm italic leading-snug group-hover:underline md:text-base">
                      {analysis.dna.signature}
                    </span>
                  )}
                </span>
              </button>
            ) : null}
            <p className="mt-3 max-w-3xl font-serif text-sm leading-relaxed text-muted-foreground md:text-base">
              {analysis.summary}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <ShelfChip analysis={analysis} cacheKey={cacheKey} />
              <BuyButton title={analysis.title} author={analysis.author || ""} variant="primary" size="md" />
              <ShareButton
                title={analysis.title}
                author={analysis.author || ""}
                signature={analysis.dna?.signature}
                slug={slug}
              />
            </div>
          </div>
          <div className="col-span-12 grid grid-cols-2 border-foreground md:col-span-3 md:border-l">
            <div className="border-foreground p-4 md:border-b">
              <div className="meta text-muted-foreground">
                {isFiction(analysis) ? "Characters" : "Chapters"}
              </div>
              <div className="display-num mt-1 text-3xl md:text-4xl">
                {isFiction(analysis)
                  ? String(analysis.characters?.length ?? 0).padStart(2, "0")
                  : String((analysis as NonFictionAnalysis).chapters?.length ?? 0).padStart(2, "0")}
              </div>
            </div>
            <div className="border-l border-foreground p-4 md:border-b">
              <div className="meta text-muted-foreground">
                {isFiction(analysis) ? "Threads" : "Type"}
              </div>
              <div className="display-num mt-1 text-3xl md:text-4xl">
                {isFiction(analysis)
                  ? String(analysis.lanes?.length ?? 0).padStart(2, "0")
                  : <span className="font-sans text-sm font-semibold uppercase">Nonfiction</span>}
              </div>
            </div>
            <div className="border-t border-foreground p-4">
              <div className="meta text-muted-foreground">Confidence</div>
              <div className="mt-1 font-sans text-sm font-semibold capitalize">
                {analysis.confidence === "unknown_work"
                  ? "Unverified"
                  : analysis.confidence ?? "—"}
              </div>
            </div>
            <div className="border-l border-t border-foreground p-4">
              <div className="meta text-muted-foreground">
                {isFiction(analysis) ? "Progress" : "DNA"}
              </div>
              <div className="mt-1 font-sans text-sm font-semibold">
                {isFiction(analysis)
                  ? `${Math.round(effectiveProgress)}%`
                  : analysis.dna?.signature ?? "—"}
              </div>
            </div>
          </div>
        </section>

        {ratingStats && (
          <section className="ink-border-b">
            <div className="meta bg-foreground px-4 py-2 text-background shadow-[0_3px_0_-1px_hsl(var(--primary))] md:px-8">
              02 · Reader Ratings
            </div>
            <div className="px-4 py-6 md:px-8">
              <Suspense fallback={<RatingDistributionSkeleton />}>
                <RatingDistribution
                  counts={ratingStats.counts}
                  total={ratingStats.total}
                  avg={ratingStats.avg}
                  label="Reader ratings"
                />
              </Suspense>
            </div>
          </section>
        )}

        {/* ===================== DNA — no longer a tab =====================
            Lifted out of the tab strip on 2026-09-07. DNA is the book's
            identity; Timeline/Network/Chapters are views of its content, so
            making them compete for one slot buried the only genuinely
            un-copyable thing on the page. It now runs full width directly
            under the header, carrying both halves of the recommendation.
            2026-09-19: gets its own chapter-divider header instead of the
            same thin ink-border-b every other section uses — it's the one
            thing here a ratings-and-reviews site structurally cannot build,
            so it should read as the star of the page, not one more item in
            an undifferentiated list of sections. */}
        {analysis.dna?.axes?.length ? (
          <section id="dna-anchor" className="ink-border-b scroll-mt-20 bg-card">
            <div className="bg-foreground px-4 py-5 text-background shadow-[0_3px_0_-1px_hsl(var(--primary))] md:px-8 md:py-6">
              <div className="meta text-primary">Feature 01</div>
              <div className="mt-1 font-sans text-2xl font-bold md:text-3xl">Book DNA</div>
              <div className="mt-1 max-w-md font-serif text-sm italic text-background/70">
                Twelve axes, measured. Tap any bar — drag to make it yours.
              </div>
            </div>
            <Suspense fallback={<TabFallback />}>
              <BookDNA analysis={analysis} cacheKey={cacheKey} />
            </Suspense>
          </section>
        ) : null}

        {/* ===================== EXPLORE THE STORY =====================
            2026-09-19: the spoiler control, the view toggle and the active
            visualization used to be three separate top-level sections with
            no shared label — on mobile they read as three more undifferentiated
            rows in the same long list as everything else. Grouping them under
            one eyebrow says plainly "these three controls are one feature." */}
        <section className="ink-border-b bg-card">
          <div className="meta bg-foreground px-4 py-2 text-background shadow-[0_3px_0_-1px_hsl(var(--primary))] md:px-8">
            03 · Explore the Story
          </div>

        {/* ===================== SPOILER STRIP — fiction only ===================== */}
        {isFiction(analysis) && (
          <section className="ink-border-b grid grid-cols-12 items-stretch">
            <div className="col-span-12 flex items-center gap-3 border-foreground px-4 py-3 md:col-span-3 md:border-r">
              <button
                onClick={() => setShowSpoilers((s) => !s)}
                className={cn(
                  "meta inline-flex items-center gap-2 border border-foreground px-3 py-2 transition-colors",
                  showSpoilers
                    ? "bg-card hover:bg-foreground/10"
                    : "bg-primary text-primary-foreground",
                )}
              >
                {showSpoilers ? (
                  <><Eye className="h-3 w-3" /> Spoilers · ON</>
                ) : (
                  <><EyeOff className="h-3 w-3" /> Spoiler-Safe</>
                )}
              </button>
            </div>
            <div className="col-span-12 px-4 py-3 md:col-span-6">
              {showSpoilers ? (
                <div className="meta flex h-full items-center text-muted-foreground">
                  Showing the entire book
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <span className="meta text-muted-foreground">Reading at</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={progress}
                    onChange={(e) => setProgress(Number(e.target.value))}
                    className="h-1 flex-1 accent-[hsl(var(--primary))]"
                    aria-label="Reading progress"
                  />
                  <span className="display-num w-14 text-right text-lg">
                    {Math.round(progress)}%
                  </span>
                </div>
              )}
            </div>
            <div className="col-span-12 flex items-center gap-1 border-foreground px-4 py-3 md:col-span-3 md:border-l">
              {[10, 25, 50, 75, 100].map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setShowSpoilers(false);
                    setProgress(p);
                  }}
                  className={cn(
                    "meta flex-1 border border-foreground px-2 py-1.5 transition-colors",
                    !showSpoilers && Math.round(progress) === p
                      ? "bg-primary text-primary-foreground"
                      : "bg-card hover:bg-foreground/10",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ===================== VIEW TOGGLE ===================== */}
        <section className="ink-border-b flex items-center justify-between px-4 py-3">
          <div className="min-w-0 flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max items-stretch border border-foreground">
              {isFiction(analysis) ? (
                (["network", "timeline", "takeaways"] as const).map((v, i) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={cn(
                      "meta whitespace-nowrap px-4 py-2.5 transition-colors",
                      i > 0 && "border-l border-foreground",
                      view === v
                        ? "bg-primary text-primary-foreground"
                        : "bg-card hover:bg-primary/10",
                    )}
                  >
                    {v === "network"
                      ? "01 · Network"
                      : v === "timeline"
                        ? "02 · Timeline"
                        : "03 · Takeaways"}
                  </button>
                ))
              ) : (
                (["ideas", "chapters", "takeaways"] as const).map((v, i) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={cn(
                      "meta whitespace-nowrap px-4 py-2.5 transition-colors",
                      i > 0 && "border-l border-foreground",
                      view === v
                        ? "bg-primary text-primary-foreground"
                        : "bg-card hover:bg-primary/10",
                    )}
                  >
                    {v === "ideas"
                      ? "01 · Ideas"
                      : v === "chapters"
                        ? "02 · Chapters"
                        : "03 · Takeaways"}
                  </button>
                ))
              )}
            </div>
          </div>
        </section>

        {/* ===================== VIZ ===================== */}
        <section
          className={cn(
            "ink-border-b bg-card",
            view !== "takeaways" && "px-4 py-6 md:px-8 md:py-10",
          )}
        >
          {/* Fiction views */}
          {view === "timeline" && isFiction(analysis) && (
            <Suspense fallback={<TabFallback />}>
              <TimelineView
                analysis={analysis as FictionAnalysis}
                progress={effectiveProgress}
                selectedEventId={selectedEventId}
                onSelectEvent={handleSelectEvent}
                selectedCharacterId={selectedCharacterId}
                onSelectCharacter={setSelectedCharacterId}
              />
            </Suspense>
          )}
          {view === "network" && isFiction(analysis) && (
            <Suspense fallback={<TabFallback />}>
              <CharacterNetwork
                analysis={analysis as FictionAnalysis}
                progress={effectiveProgress}
                onProgressChange={(next) => {
                  setShowSpoilers(false);
                  setProgress(next);
                }}
                cacheKey={cacheKey}
                selectedCharacterId={selectedCharacterId}
                onSelectCharacter={(id) => {
                  setSelectedCharacterId(id);
                  if (id) setView("network");
                }}
                highlightedCharacterIds={highlightedCharacterIds}
                onSelectEventId={(eventId) => {
                  setSelectedEventId(eventId);
                  setView("timeline");
                }}
              />
            </Suspense>
          )}
          {/* Non-fiction views */}
          {view === "ideas" && isNonFiction(analysis) && (
            <Suspense fallback={<TabFallback />}>
              <IdeasTab
                analysis={analysis as NonFictionAnalysis}
                cacheKey={cacheKey}
                onReanalyze={() => {
                  // BookPage is read-only — re-analyze is not available here.
                  // Redirect user to the home page with the book pre-filled.
                  window.location.href = `/?book=${encodeURIComponent(analysis.title)}`;
                }}
              />
            </Suspense>
          )}
          {view === "concepts" && isNonFiction(analysis) && (
            <Suspense fallback={<TabFallback />}>
              <ConceptMap analysis={analysis as NonFictionAnalysis} />
            </Suspense>
          )}
          {view === "chapters" && isNonFiction(analysis) && (
            <Suspense fallback={<TabFallback />}>
              <ChapterBreakdown analysis={analysis as NonFictionAnalysis} />
            </Suspense>
          )}
          {/* Shared views */}
          {view === "takeaways" && (
            <Suspense fallback={<TabFallback />}>
              <TakeawaysTab analysis={analysis} cacheKey={cacheKey} />
            </Suspense>
          )}
        </section>
        </section>

        {/* ===================== MY NOTES ===================== */}
        <section className="ink-border-b">
          <div className="meta bg-foreground px-4 py-2 text-background shadow-[0_3px_0_-1px_hsl(var(--primary))] md:px-8">
            04 · My Notes
          </div>
          <ReaderNotes cacheKey={cacheKey} bookTitle={analysis.title} bookAuthor={analysis.author} />
        </section>

        {/* ===================== THE READING =====================
            2026-09-19: renamed from "Essay" / "Reader's Notes" — the rail
            label used to say "Reader's Notes" here even though this is the
            AI-generated essay, not the reader's own notes (those are the
            My Notes section above). Same naming collision flagged in the
            09-07 and 09-10 design reviews; fixed here. Always the very last
            section on the page — the long-form read, after every feature. */}
        <section className="grid grid-cols-12 gap-0">
          <div className="col-span-12 border-foreground px-4 py-6 md:col-span-2 md:border-r md:py-10">
            <div className="meta text-muted-foreground">05 · The Reading</div>
            <div className="display-num mt-2 text-4xl md:text-6xl">05</div>
            <div className="meta mt-2 text-primary">AI Read</div>
            <div className="mt-1 font-serif text-xs italic text-muted-foreground">
              {isFiction(analysis) ? "A critical reading" : "A critical essay"}
            </div>
          </div>
          <div className="col-span-12 px-4 py-6 md:col-span-10 md:px-10 md:py-10">
            <div className="prose prose-sm max-w-3xl font-serif text-foreground prose-headings:font-sans prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-foreground prose-strong:text-foreground prose-a:text-primary prose-a:no-underline hover:prose-a:underline md:prose-base">
              <Suspense fallback={<MarkdownFallback />}>
                <ReactMarkdown>{analysis.explanation}</ReactMarkdown>
              </Suspense>
            </div>
          </div>
        </section>
      </main>

    </div>
  );
};

export default BookPage;
