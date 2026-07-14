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
import { TimelineView } from "@/components/TimelineView";
import { CharacterNetwork } from "@/components/CharacterNetwork";
import { BookDNA } from "@/components/BookDNA";
import { ConceptMap } from "@/components/ConceptMap";
import { IdeasTab } from "@/components/IdeasTab";
import { ChapterBreakdown } from "@/components/ChapterBreakdown";
import { TakeawaysTab } from "@/components/TakeawaysTab";
import { ReaderNotes } from "@/components/ReaderNotes";
import { ShelfChip } from "@/components/ShelfChip";
import { MustReadBadge } from "@/components/MustReadBadge";
import { ClassicBadge } from "@/components/ClassicBadge";
import { BuyButton } from "@/components/BuyButton";
import { ShareButton } from "@/components/ShareButton";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// ── Cover image fetching (same as Index) ─────────────────────────────────────
const coverCache = new Map<string, string | null>();

async function fetchCoverUrl(title: string, author: string): Promise<string | null> {
  const key = `${title.toLowerCase()}|${(author ?? "").toLowerCase()}`;
  if (coverCache.has(key)) return coverCache.get(key)!;
  try {
    const q = author && author !== "Unknown"
      ? `intitle:${encodeURIComponent(title)}+inauthor:${encodeURIComponent(author)}`
      : `intitle:${encodeURIComponent(title)}`;
    const r = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1&printType=books`,
    );
    if (!r.ok) { coverCache.set(key, null); return null; }
    const json = await r.json();
    const raw = json?.items?.[0]?.volumeInfo?.imageLinks?.thumbnail as string | undefined;
    const url = raw
      ? raw.replace("http://", "https://").replace("&edge=curl", "") + "&fife=w300"
      : null;
    coverCache.set(key, url);
    return url;
  } catch {
    coverCache.set(key, null);
    return null;
  }
}
// ─────────────────────────────────────────────────────────────────────────────

type LoadState = "loading" | "found" | "not-found";

const BookPage = () => {
  const { slug } = useParams<{ slug: string }>();

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [analysis, setAnalysis] = useState<NovelAnalysis | null>(null);
  const [cacheKey, setCacheKey] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  // View / spoiler state (mirrors Index)
  const [view, setView] = useState<"timeline" | "network" | "dna" | "concepts" | "ideas" | "chapters" | "takeaways">("timeline");
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
        setView(normalized.bookType === "nonfiction" ? "ideas" : "timeline");
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
              className="group flex items-center gap-3 border-r border-foreground px-4 py-5 transition-colors hover:bg-foreground hover:text-background"
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
              className="group flex items-center gap-3 border-r border-foreground px-4 py-5 transition-colors hover:bg-foreground hover:text-background"
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
                className="meta inline-flex items-center gap-2 border border-foreground bg-primary px-5 py-3 text-primary-foreground transition-colors hover:bg-ink-blue hover:text-background"
              >
                → Analyze "{titleHint}"
              </Link>
            ) : null}
            <Link
              to="/"
              className="meta inline-flex items-center gap-2 border border-foreground bg-card px-5 py-3 transition-colors hover:bg-foreground hover:text-background"
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
              className="group flex items-center gap-3 border-r border-foreground px-4 py-5 transition-colors hover:bg-foreground hover:text-background"
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
              className="meta hover-invert flex items-center gap-2 border-l border-foreground px-5 py-5"
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
              {coverUrl && (
                <img
                  src={coverUrl}
                  alt={`${analysis.title} cover`}
                  className="w-14 flex-shrink-0 rounded shadow-lg ring-1 ring-foreground/10 md:mb-4 md:w-full md:max-w-[108px]"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
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
                {isFiction(analysis) ? "Lanes" : "Type"}
              </div>
              <div className="display-num mt-1 text-3xl md:text-4xl">
                {isFiction(analysis)
                  ? String(analysis.lanes?.length ?? 0).padStart(2, "0")
                  : <span className="font-sans text-sm font-semibold uppercase">Nonfiction</span>}
              </div>
            </div>
            <div className="border-t border-foreground p-4">
              <div className="meta text-muted-foreground">Mode</div>
              <div className="mt-1 font-sans text-sm font-semibold capitalize">{view}</div>
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

        {/* ===================== SPOILER STRIP — fiction only ===================== */}
        {isFiction(analysis) && (
          <section className="ink-border-b grid grid-cols-12 items-stretch">
            <div className="col-span-12 flex items-center gap-3 border-foreground px-4 py-3 md:col-span-3 md:border-r">
              <button
                onClick={() => setShowSpoilers((s) => !s)}
                className={cn(
                  "meta inline-flex items-center gap-2 border border-foreground px-3 py-2 transition-colors",
                  showSpoilers
                    ? "bg-card hover:bg-foreground hover:text-background"
                    : "bg-foreground text-background",
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
                      ? "bg-foreground text-background"
                      : "bg-card hover:bg-foreground hover:text-background",
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
                (["timeline", "network", "dna", "takeaways"] as const).map((v, i) => (
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
                    {v === "timeline"
                      ? "01 · Timeline"
                      : v === "network"
                        ? "02 · Network"
                        : v === "dna"
                          ? "03 · DNA"
                          : "04 · Takeaways"}
                  </button>
                ))
              ) : (
                (["ideas", "chapters", "dna", "takeaways"] as const).map((v, i) => (
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
                        : v === "dna"
                          ? "03 · DNA"
                          : "04 · Takeaways"}
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
            <TimelineView
              analysis={analysis as FictionAnalysis}
              progress={effectiveProgress}
              selectedEventId={selectedEventId}
              onSelectEvent={handleSelectEvent}
              selectedCharacterId={selectedCharacterId}
              onSelectCharacter={setSelectedCharacterId}
            />
          )}
          {view === "network" && isFiction(analysis) && (
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
          )}
          {/* Non-fiction views */}
          {view === "ideas" && isNonFiction(analysis) && (
            <IdeasTab
              analysis={analysis as NonFictionAnalysis}
              cacheKey={cacheKey}
              onReanalyze={() => {
                // BookPage is read-only — re-analyze is not available here.
                // Redirect user to the home page with the book pre-filled.
                window.location.href = `/?book=${encodeURIComponent(analysis.title)}`;
              }}
            />
          )}
          {view === "concepts" && isNonFiction(analysis) && (
            <ConceptMap analysis={analysis as NonFictionAnalysis} />
          )}
          {view === "chapters" && isNonFiction(analysis) && (
            <ChapterBreakdown analysis={analysis as NonFictionAnalysis} />
          )}
          {/* Shared views */}
          {view === "dna" && (
            <BookDNA analysis={analysis} cacheKey={cacheKey} />
          )}
          {view === "takeaways" && (
            <TakeawaysTab analysis={analysis} cacheKey={cacheKey} />
          )}
        </section>

        {/* ===================== READING NOTES ===================== */}
        <ReaderNotes cacheKey={cacheKey} bookTitle={analysis.title} bookAuthor={analysis.author} />

        {/* ===================== ESSAY ===================== */}
        <section className="grid grid-cols-12 gap-0">
          <div className="col-span-12 border-foreground px-4 py-6 md:col-span-2 md:border-r md:py-10">
            <div className="meta text-muted-foreground">Essay</div>
            <div className="display-num mt-2 text-4xl md:text-6xl">02</div>
            <div className="meta mt-2 text-muted-foreground">
              {isFiction(analysis) ? "Reader's Notes" : "Critical Essay"}
            </div>
            <div className="mt-1 font-serif text-xs italic text-muted-foreground">An essay</div>
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
