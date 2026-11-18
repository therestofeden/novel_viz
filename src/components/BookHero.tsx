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
 * on 2026-11-18: the book's DNA glyph leads, with a small cover, the title,
 * its signature in the book's own ink, the summary and the actions beside it.
 * Below lg it stacks, glyph first, so the phone's first screen is the glyph,
 * the title and Save.
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

  return (
    <section id="analysis-anchor" className="scroll-mt-20 border-b border-foreground">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-6 md:px-8 md:py-12 lg:flex-row lg:items-center lg:gap-14">
        {showGlyph && (
          <div className="mx-auto flex w-full max-w-[400px] flex-col items-center md:max-w-[460px] lg:mx-0 lg:max-w-[540px] lg:flex-[1_1_480px]">
            <button
              type="button"
              onClick={openDnaStrand}
              className="block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <DnaGlyph analysis={analysis} labels size={540} className="h-auto w-full" />
            </button>
            <button
              type="button"
              onClick={openDnaStrand}
              className="min-h-[44px] px-2 text-sm text-[hsl(var(--primary-dark))] underline-offset-4 hover:underline"
            >
              Tap to see why, or drag a bar to register your take
            </button>
          </div>
        )}

        <div className="flex min-w-0 flex-col gap-4 lg:flex-[1_1_440px]">
          <div className="flex items-end gap-4">
            <CoverPlate
              coverUrl={coverUrl}
              title={analysis.title}
              author={analysis.author}
              className="w-[64px] md:w-[88px]"
              fallback={<GlyphPlate analysis={analysis} titleClassName="text-[9px] md:text-[11px]" />}
            />
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2 empty:hidden">
                <MustReadBadge title={analysis.title} author={analysis.author} size="md" />
                <ClassicBadge title={analysis.title} author={analysis.author} size="md" />
              </div>
              {author && <span className="text-base font-semibold leading-snug">{author}</span>}
              <span className="text-sm text-muted-foreground">{nf ? "Non-fiction" : "Fiction"}</span>
            </div>
          </div>

          <h1 className="font-serif text-[2.35rem] font-normal leading-[1] tracking-[-0.025em] text-balance md:text-6xl">
            {analysis.title}
          </h1>

          {signature && (
            <p className="font-serif text-xl italic leading-snug md:text-2xl" style={{ color: ink.inkText }}>
              {signature.replace(/\.$/, "")}.
            </p>
          )}
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

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <ShelfChip analysis={analysis} cacheKey={cacheKey} />
            <ShareButton
              title={analysis.title}
              author={analysis.author || ""}
              signature={analysis.dna?.signature}
              slug={slug}
            />
            <BuyButton title={analysis.title} author={analysis.author || ""} variant="ghost" size="sm" />
            {extraActions}
          </div>
        </div>
      </div>
    </section>
  );
}

export default BookHero;
