/**
 * ChapterBreakdown — horizontal argument-flow view for non-fiction books.
 * Each chapter is a card on a timeline, colour-coded by argumentType.
 * Clicking a chapter shows its summary and the concepts it covers.
 */
import { useState } from "react";
import { NfChapter, NfChapterType, NfConcept, NonFictionAnalysis } from "@/lib/novel-types";
import { cn } from "@/lib/utils";

// ─── Colour and label system ──────────────────────────────────────────────────

const CHAPTER_TYPE_META: Record<
  NfChapterType,
  { label: string; colorVar: string; short: string }
> = {
  introduction:    { label: "Introduction",    colorVar: "--lane-1",  short: "INTRO" },
  setup:           { label: "Setup",           colorVar: "--lane-2",  short: "SETUP" },
  evidence:        { label: "Evidence",        colorVar: "--lane-4",  short: "EVID" },
  case_study:      { label: "Case Study",      colorVar: "--lane-6",  short: "CASE" },
  counterargument: { label: "Counterargument", colorVar: "--lane-8",  short: "COUNTER" },
  synthesis:       { label: "Synthesis",       colorVar: "--lane-10", short: "SYNTH" },
  conclusion:      { label: "Conclusion",      colorVar: "--lane-12", short: "CONCL" },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  analysis: NonFictionAnalysis;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ChapterBreakdown({ analysis }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const chapters = [...(analysis.chapters ?? [])].sort((a, b) => a.position - b.position);
  const concepts = analysis.concepts ?? [];

  const selectedChapter = selectedId
    ? chapters.find((c) => c.id === selectedId)
    : null;

  const chapterConcepts = selectedChapter
    ? selectedChapter.keyConceptIds
        .map((cid) => concepts.find((c) => c.id === cid))
        .filter(Boolean) as NfConcept[]
    : [];

  if (chapters.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        No chapters available.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Thesis callout */}
      {analysis.thesis && (
        <div className="ink-border-b bg-foreground px-6 py-5 md:px-8">
          <p className="meta text-xs text-background/60">Central Thesis</p>
          <p className="mt-2 font-serif text-base italic text-background/90 md:text-lg">
            {analysis.thesis}
          </p>
        </div>
      )}

      {/* Timeline scroll area */}
      <div className="ink-border-b overflow-x-auto px-4 py-8 md:px-8">
        {/* Spine line */}
        <div className="relative mb-8 h-px w-full bg-foreground/15">
          {chapters.map((ch) => (
            <div
              key={ch.id}
              className="absolute -top-1.5 h-3 w-px bg-foreground/30"
              style={{ left: `${ch.position}%` }}
            />
          ))}
        </div>

        {/* Chapter cards — scrollable row */}
        <div
          className="flex gap-4"
          style={{ minWidth: `${Math.max(chapters.length * 200, 700)}px` }}
        >
          {chapters.map((ch) => {
            const meta = CHAPTER_TYPE_META[ch.argumentType] ?? CHAPTER_TYPE_META.setup;
            const isSelected = selectedId === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => setSelectedId(isSelected ? null : ch.id)}
                className={cn(
                  "relative flex min-w-[180px] flex-col gap-2 border p-4 text-left transition-colors",
                  isSelected
                    ? "border-foreground bg-foreground text-background"
                    : "border-foreground/25 bg-card hover:border-foreground/60",
                )}
                style={{ flex: "0 0 auto" }}
              >
                {/* Type badge */}
                <span
                  className="meta inline-block px-1.5 py-0.5 text-[10px]"
                  style={{
                    background: isSelected
                      ? "hsl(var(--background) / 0.15)"
                      : `hsl(var(${meta.colorVar}) / 0.2)`,
                    color: isSelected
                      ? "hsl(var(--background))"
                      : `hsl(var(${meta.colorVar}))`,
                  }}
                >
                  {meta.label}
                </span>

                {/* Chapter number */}
                <p
                  className={cn(
                    "meta text-[10px]",
                    isSelected ? "text-background/60" : "text-muted-foreground",
                  )}
                >
                  Chapter {ch.number}
                </p>

                {/* Title */}
                <p
                  className={cn(
                    "font-sans text-sm font-semibold leading-snug",
                    isSelected ? "text-background" : "text-foreground",
                  )}
                >
                  {ch.title}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail panel */}
      {selectedChapter ? (
        <div className="ink-border-b grid grid-cols-12 gap-0">
          <div className="col-span-12 border-foreground px-6 py-7 md:col-span-3 md:border-r md:px-8 md:py-10">
            <p className="meta text-xs text-muted-foreground">Chapter {selectedChapter.number}</p>
            <p className="mt-2 font-sans text-lg font-bold leading-snug">{selectedChapter.title}</p>
            <span
              className="meta mt-3 inline-block px-1.5 py-0.5 text-[10px]"
              style={{
                background: `hsl(var(${CHAPTER_TYPE_META[selectedChapter.argumentType]?.colorVar ?? "--lane-1"}) / 0.2)`,
                color: `hsl(var(${CHAPTER_TYPE_META[selectedChapter.argumentType]?.colorVar ?? "--lane-1"}))`,
              }}
            >
              {CHAPTER_TYPE_META[selectedChapter.argumentType]?.label ?? selectedChapter.argumentType}
            </span>
            {chapterConcepts.length > 0 && (
              <div className="mt-5">
                <p className="meta text-xs text-muted-foreground">Key Concepts</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {chapterConcepts.map((c) => (
                    <span
                      key={c.id}
                      className="meta border border-foreground/20 px-2 py-1 text-xs text-foreground/70"
                    >
                      {c.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="col-span-12 px-6 py-7 md:col-span-9 md:px-10 md:py-10">
            <p className="font-serif text-base leading-relaxed text-foreground/85">
              {selectedChapter.summary}
            </p>
          </div>
        </div>
      ) : (
        <div className="px-6 py-8 md:px-8">
          <p className="font-serif text-sm italic text-muted-foreground">
            Select a chapter above to see its summary and key concepts.
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 px-4 py-3 md:px-6">
        {(Object.entries(CHAPTER_TYPE_META) as [NfChapterType, typeof CHAPTER_TYPE_META[NfChapterType]][]).map(
          ([type, meta]) =>
            chapters.some((c) => c.argumentType === type) ? (
              <div key={type} className="meta flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="block h-2.5 w-2.5 rounded-sm"
                  style={{ background: `hsl(var(${meta.colorVar}))` }}
                />
                {meta.label}
              </div>
            ) : null,
        )}
      </div>
    </div>
  );
}
