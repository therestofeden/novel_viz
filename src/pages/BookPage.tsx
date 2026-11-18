import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, Eye, EyeOff, Search } from "lucide-react";
import { NovelVizLogo } from "@/components/NovelVizLogo";

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
import { densifyRatingCounts } from "@/lib/rating-counts";
import { RatingDistributionSkeleton } from "@/components/RatingDistributionSkeleton";
// recharts + d3 is ~333 kB raw / 84 kB gzip and the chart sits below the
// fold. Statically importing it blocked BookPage from rendering at all
// until that chunk had downloaded and parsed; lazy() moves it off the
// critical path so the page paints first and the chart fills in.
const RatingDistribution = lazy(() => import("@/components/RatingDistribution"));
import { FeedbackButton } from "@/components/FeedbackButton";
import { BookHero } from "@/components/BookHero";
import { DnaTraits } from "@/components/DnaTraits";
import { fetchCoverUrl } from "@/lib/covers";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type LoadState = "loading" | "found" | "not-found";

/**
 * 2026-11-18 (Paper & ink redesign): one slim header for every state of the
 * page. Replaces the dateline ticker + double-ruled masthead header, the
 * "apparatus" the redesign set out to remove.
 */
function BookPageHeader() {
  return (
    <header className="border-b border-foreground bg-background">
      <div className="mx-auto flex max-w-[1280px] items-center gap-2 px-4 py-1.5 md:px-8">
        <Link to="/" className="flex min-h-[44px] items-center gap-2.5 text-foreground">
          <NovelVizLogo size={28} className="text-foreground" />
          <span className="font-serif text-xl font-medium tracking-[-0.01em]">NovelViz</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1">
          <Link to="/" className="flex min-h-[44px] items-center gap-2 px-3 text-sm font-medium hover:underline">
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Map another book</span>
          </Link>
          <Link to="/shelf" className="flex min-h-[44px] items-center px-3 text-sm font-medium hover:underline">
            Library
          </Link>
        </nav>
      </div>
    </header>
  );
}

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
      <div className={cn("h-3 animate-pulse bg-foreground/10", extra)} style={{ width: w }} />
    );
    return (
      <div className="min-h-screen">
        <BookPageHeader />
        <main>
          <section className="border-b border-foreground">
            <div className="mx-auto grid max-w-[1280px] grid-cols-[42%_minmax(0,1fr)] items-center gap-4 px-4 py-6 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:gap-10 md:px-8 md:py-12 lg:gap-14">
              <div className="mx-auto aspect-square w-full max-w-[460px] animate-pulse rounded-full bg-foreground/[0.06]" />
              <div className="flex min-w-0 flex-col gap-3">
                <div className="flex items-end gap-4">
                  <div className="hidden aspect-[2/3] w-[88px] animate-pulse bg-foreground/10 md:block" />
                  <div className="flex flex-1 flex-col gap-2">{bar("40%")}{bar("25%")}</div>
                </div>
                {bar("85%", "mt-2 h-8 md:h-10")}
                {bar("60%", "h-8 md:h-10")}
                {bar("70%", "mt-2 h-5")}
                {bar("95%", "mt-2 hidden md:block")}
                {bar("90%", "hidden md:block")}
              </div>
            </div>
          </section>
          <div className="flex items-center justify-center gap-2 px-4 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading the book…
          </div>
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
        <BookPageHeader />
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
      <BookPageHeader />

      <main>
        <BookHero analysis={analysis} cacheKey={cacheKey} coverUrl={coverUrl} slug={slug} />
        <DnaTraits analysis={analysis} />

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
          <section id="dna-anchor" className="scroll-mt-4 border-b border-foreground">
            <Suspense fallback={<TabFallback />}>
              <BookDNA analysis={analysis} cacheKey={cacheKey} />
            </Suspense>
          </section>
        ) : null}

        {ratingStats && (
          <section className="border-b border-foreground">
            <div className="mx-auto max-w-[1280px] px-4 py-8 md:px-8 md:py-12">
              <h2 className="mb-5 font-serif text-[1.75rem] font-normal leading-tight tracking-[-0.015em] md:text-[2.5rem]">
                What readers rated it
              </h2>
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

        {/* ===================== EXPLORE THE STORY =====================
            2026-09-19: the spoiler control, the view toggle and the active
            visualization used to be three separate top-level sections with
            no shared label — on mobile they read as three more undifferentiated
            rows in the same long list as everything else. Grouping them under
            one eyebrow says plainly "these three controls are one feature." */}
        <section className="mx-auto max-w-[1280px] border-b border-foreground md:border-x md:border-foreground/20">
          <div className="px-4 pb-4 pt-8 md:px-8 md:pt-12">
            <h2 className="font-serif text-[1.75rem] font-normal leading-tight tracking-[-0.015em] md:text-[2.5rem]">
              Inside the book
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isFiction(analysis) ? "Who is who, what happens when, and what to take away." : "The ideas, chapter by chapter, and what to take away."}
            </p>
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
                      ? "Network"
                      : v === "timeline"
                        ? "Timeline"
                        : "Takeaways"}
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
                      ? "Ideas"
                      : v === "chapters"
                        ? "Chapters"
                        : "Takeaways"}
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
        <section className="mx-auto max-w-[1280px] border-b border-foreground">
          <h2 className="px-4 pb-4 pt-8 font-serif text-[1.75rem] font-normal leading-tight tracking-[-0.015em] md:px-8 md:pt-12 md:text-[2.5rem]">
            Your notes
          </h2>
          <ReaderNotes cacheKey={cacheKey} bookTitle={analysis.title} bookAuthor={analysis.author} />
        </section>

        {/* ===================== THE READING =====================
            2026-09-19: renamed from "Essay" / "Reader's Notes" — the rail
            label used to say "Reader's Notes" here even though this is the
            AI-generated essay, not the reader's own notes (those are the
            My Notes section above). Same naming collision flagged in the
            09-07 and 09-10 design reviews; fixed here. Always the very last
            section on the page — the long-form read, after every feature. */}
        <section className="mx-auto grid max-w-[1280px] grid-cols-12 gap-0">
          <div className="col-span-12 px-4 pt-8 md:col-span-3 md:px-8 md:py-12">
            <h2 className="font-serif text-[1.75rem] font-normal leading-tight tracking-[-0.015em] md:text-[2.5rem]">
              The reading
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Written by AI · {isFiction(analysis) ? "a critical reading" : "a critical essay"}
            </p>
          </div>
          <div className="col-span-12 px-4 py-6 md:col-span-9 md:px-8 md:py-12">
            <div className="prose prose-sm max-w-3xl font-serif text-foreground prose-headings:font-sans prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-foreground prose-strong:text-foreground prose-a:text-primary prose-a:no-underline hover:prose-a:underline md:prose-base">
              <Suspense fallback={<MarkdownFallback />}>
                <ReactMarkdown>{analysis.explanation}</ReactMarkdown>
              </Suspense>
            </div>
          </div>
        </section>
      </main>
      <footer className="mx-auto flex max-w-[1280px] justify-end border-t border-foreground/20 px-4 py-3">
        <FeedbackButton page="book" slug={slug} />
      </footer>
    </div>
  );
};

export default BookPage;
