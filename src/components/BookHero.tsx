import { type ReactNode, useMemo } from "react";

import { BuyButton } from "@/components/BuyButton";
import { ClassicBadge } from "@/components/ClassicBadge";
import { CoverPlate } from "@/components/CoverPlate";
import { DnaGlyph } from "@/components/DnaGlyph";
import { GlyphPlate } from "@/components/GlyphPlate";
import { MustReadBadge } from "@/components/MustReadBadge";
import { ShareButton } from "@/components/ShareButton";
import { ShelfChip } from "@/components/ShelfChip";
import { type NovelAnalysis, type NonFictionAnalysis, isNonFiction } from "@/lib/novel-types";
import { bookInk, glyphAxes, hasEnoughDna, openDnaStrand } from "@/lib/dna-glyph";

/**
 * BookHero: the top of every book view, shared by the /book/:slug route
 * (BookPage) and the inline result on the home page (Index), which used to
 * carry two hand-kept copies of the same masthead (see the 2026-10-04 audit).
 *
 * Layout is the "Reading room" composition in "Paper & ink" colours, chosen
 * on 2026-11-18: the book's DNA glyph on the left, the book on the right
 * (small cover, title, its signature in the book's own ink, summary,
 * actions). The orientation holds on phones too; see the layout note below.
 */
export function BookHero({
  analysis,
  cacheKey,
  coverUrl,
  slug,
  extraActions,
}: {
  analysis: NovelAnalysis;
  cacheKey: string | null;
  coverUrl: string | null;
  slug?: string;
  /** appended to the action row (e.g. the home page's "Refined" chip) */
  extraActions?: ReactNode;
}) {
  const ink = useMemo(() => bookInk(analysis), [analysis]);
  const showGlyph = useMemo(() => hasEnoughDna(glyphAxes(analysis)), [analysis]);
  const nf = isNonFiction(analysis);
  const author = analysis.author && analysis.author !== "Unknown" ? analysis.author : null;
  const thesis = nf ? (analysis as NonFictionAnalysis).thesis : null;
  const signature = analysis.dna?.signature?.trim();
  // Right-hand column on md+; full width when there is no glyph to sit beside.
  const right = showGlyph ? "md:col-span-1 md:col-start-2" : "md:col-span-2 md:col-start-1";

  return (
    <section id="analysis-anchor" className="scroll-mt-20 border-b border-foreground">
      {/* 2026-11-18, round 2: the Reading-room orientation (glyph left, the
          book on the right) holds at EVERY width, phones included. The first
          cut only went side by side from lg (1024px) and stacked glyph-over-
          title below that, which is not what was approved. A grid with
          explicit placement keeps one instance of each stateful control
          (ShelfChip, ShareButton) while the layout changes per breakpoint:
            phone:  [glyph | badges, author, title]  then signature, summary,
                    actions full width underneath;
            md+:    glyph spans the left column, everything else stacks on
                    the right, vertically centred against it. */}
      <div
        className={
          "mx-auto grid max-w-[1280px] grid-cols-[42%_minmax(0,1fr)] items-center gap-x-4 gap-y-4 px-4 py-6 " +
          "md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:grid-rows-[1fr_auto_auto_auto_auto_1fr] md:gap-x-10 md:gap-y-4 md:px-8 md:py-12 lg:gap-x-14"
        }
      >
        {showGlyph && (
          <div className="col-start-1 row-start-1 flex flex-col items-center self-center md:row-span-6 md:mx-auto md:w-full md:max-w-[540px]">
            <button
              type="button"
              onClick={openDnaStrand}
              className="block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <DnaGlyph analysis={analysis} labels size={540} className="hidden h-auto w-full md:block" />
              <DnaGlyph analysis={analysis} size={200} className="h-auto w-full md:hidden" />
            </button>
            <button
              type="button"
              onClick={openDnaStrand}
              className="min-h-[44px] px-1 text-center text-xs text-[hsl(var(--primary-dark))] underline-offset-4 hover:underline md:text-sm"
            >
              <span className="md:hidden">Tap for all twelve</span>
              <span className="hidden md:inline">Tap to see why, or drag a bar to register your take</span>
            </button>
          </div>
        )}

        <div
          className={
            (showGlyph ? "col-start-2 " : "col-span-2 ") +
            right +
            " row-start-1 flex min-w-0 flex-col gap-2 self-center md:row-start-2 md:gap-4 md:self-end"
          }
        >
          <div className="flex items-end gap-4">
            <CoverPlate
              coverUrl={coverUrl}
              title={analysis.title}
              author={analysis.author}
              className="hidden w-[88px] md:flex"
              fallback={<GlyphPlate analysis={analysis} titleClassName="text-[11px]" />}
            />
            <div className="flex min-w-0 flex-col gap-1 md:gap-1.5">
              <div className="flex flex-wrap items-center gap-2 empty:hidden">
                <MustReadBadge title={analysis.title} author={analysis.author} size="md" />
                <ClassicBadge title={analysis.title} author={analysis.author} size="md" />
              </div>
              {author && <span className="text-sm font-semibold leading-snug md:text-base">{author}</span>}
              <span className="hidden text-sm text-muted-foreground md:inline">{nf ? "Non-fiction" : "Fiction"}</span>
            </div>
          </div>
          <h1 className="font-serif text-[1.65rem] font-normal leading-[1.02] tracking-[-0.02em] text-balance md:text-5xl lg:text-6xl">
            {analysis.title}
          </h1>
        </div>

        {signature && (
          <p
            className={`col-span-2 row-start-2 font-serif text-xl italic leading-snug md:row-start-3 md:text-2xl ${right}`}
            style={{ color: ink.inkText }}
          >
            {signature.replace(/\.$/, "")}.
          </p>
        )}

        <div className={`col-span-2 row-start-3 flex flex-col gap-3 md:row-start-4 ${right}`}>
          {thesis && (
            <p className="font-serif text-lg leading-snug text-foreground/85">&ldquo;{thesis}&rdquo;</p>
          )}
          {analysis.summary && (
            <p className="max-w-[62ch] text-base leading-relaxed text-foreground/80">{analysis.summary}</p>
          )}
          {analysis.confidence === "unknown_work" && (
            <p className="max-w-[62ch] border-l-2 border-[hsl(var(--destructive))] pl-3 text-sm text-foreground/80">
              We couldn&rsquo;t confirm this book exists as titled, so treat the details below with care.
            </p>
          )}
        </div>

        <div className={`col-span-2 row-start-4 flex flex-wrap items-center gap-3 md:row-start-5 md:self-start ${right}`}>
          <ShelfChip analysis={analysis} cacheKey={cacheKey} />
          <ShareButton
            title={analysis.title}
            author={analysis.author || ""}
            signature={analysis.dna?.signature}
            analysis={analysis}
            slug={slug}
          />
          <BuyButton title={analysis.title} author={analysis.author || ""} variant="ghost" size="sm" />
          {extraActions}
        </div>
      </div>
    </section>
  );
}

export default BookHero;
