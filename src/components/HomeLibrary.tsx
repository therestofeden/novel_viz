import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { GlyphPlate } from "@/components/GlyphPlate";
import { LibraryPortrait } from "@/components/LibraryPortrait";
import { petalPath, readingShape, type ReadingShape } from "@/lib/dna-glyph";
import { DNA_AXIS_IDS, type NovelAnalysis } from "@/lib/novel-types";

/** A finished book with just enough analysis to draw its glyph. */
export interface LibraryBook {
  cacheKey: string;
  slug: string | null;
  title: string;
  author: string;
  rating: number | null;
  /** slim, glyph-only analysis (see glyphSource); null when never analysed */
  glyph: NovelAnalysis | null;
  fiction: boolean;
}

export interface ContinueBookView {
  title: string;
  author: string;
  startedAt: string | null;
  slug: string | null;
  glyph: NovelAnalysis | null;
}

type OpenBook = { title: string; author?: string; slug?: string | null };

function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function Stat({ value, label, to }: { value: ReactNode; label: string; to?: string }) {
  const inner = (
    <>
      <span className="font-serif text-5xl leading-none">{value}</span>
      <span className="text-sm text-foreground/80">{label}</span>
    </>
  );
  const cls = "flex flex-col gap-1 py-4 pl-4 first:pl-0 [&:not(:first-child)]:border-l [&:not(:first-child)]:border-foreground/25";
  return to ? (
    <Link to={to} className={`${cls} hover:underline`}>{inner}</Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/**
 * The signed-in home, from the approved "your library" canvas: a greeting,
 * the book in hand, three numbers, the reader's reading shape, and the shelf
 * of finished books drawn as glyph plates. Presentational; Index owns the
 * data (all of it plain reads of the reader's own rows, never a live model
 * call) and the search form, which arrives as a slot.
 */
export function HomeLibrary({
  name,
  search,
  continueBook,
  shelf,
  finishedThisYear,
  notesCount,
  recommendation,
  books,
  onOpen,
}: {
  name: string | null;
  search: ReactNode;
  continueBook: ContinueBookView | null;
  shelf: { total: number; reading: number; finished: number } | null;
  finishedThisYear: number | null;
  notesCount: number;
  recommendation: { title: string; author: string; why: string } | null;
  books: LibraryBook[];
  onOpen: (b: OpenBook) => void;
}) {
  const fiction = books.filter((b) => b.fiction && b.glyph);
  const scores = fiction.map((b) => {
    const m = new Map<string, number>((b.glyph?.dna?.axes ?? []).map((a) => [a.id as string, a.score]));
    return {
      title: b.title,
      scores: DNA_AXIS_IDS.map((id) => (m.has(id) ? (m.get(id) as number) : null)),
    };
  });
  const shape: ReadingShape | null = readingShape(scores);
  const outlines = scores.map((s) => petalPath(s.scores));

  return (
    <div className="flex flex-col gap-10 md:gap-11">
      <div className="flex flex-col gap-5">
        <h1 className="font-serif text-[2.5rem] font-normal leading-none tracking-[-0.02em] md:text-6xl">
          {greeting(new Date())}
          {name ? `, ${name}` : ""}.
        </h1>
        <div className="max-w-xl">{search}</div>
      </div>

      <section className="flex flex-wrap items-stretch gap-7">
        <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-7">
          {continueBook ? (
            <button
              type="button"
              onClick={() => onOpen(continueBook)}
              className="flex flex-wrap gap-6 border border-foreground bg-card p-5 text-left text-foreground md:p-6"
            >
              <span className="block aspect-[2/3] w-[110px] flex-none border border-foreground md:w-[150px]">
                {continueBook.glyph ? (
                  <GlyphPlate analysis={continueBook.glyph} titleClassName="text-sm md:text-[17px]" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-foreground font-serif text-4xl italic text-background">
                    {continueBook.title.charAt(0).toUpperCase()}
                  </span>
                )}
              </span>
              <span className="flex min-w-0 flex-[1_1_220px] flex-col gap-3">
                <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Continue reading
                </span>
                <span className="font-serif text-[1.75rem] leading-[1.05] md:text-[2.125rem]">{continueBook.title}</span>
                <span className="text-[15px] text-foreground/80">
                  {continueBook.author || "Unknown author"}
                  {continueBook.startedAt
                    ? ` · started ${new Date(continueBook.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                    : ""}
                </span>
                <span className="mt-auto inline-flex w-fit bg-foreground px-5 py-3 text-[15px] font-medium text-background">
                  Pick up where you left off
                </span>
              </span>
            </button>
          ) : (
            <Link
              to="/shelf"
              className="flex flex-col gap-2 border border-foreground bg-card p-6 text-foreground hover:bg-foreground/[0.04]"
            >
              <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Continue reading
              </span>
              <span className="font-serif text-2xl">Nothing in progress yet.</span>
              <span className="text-[15px] text-foreground/80 underline">Pick a book from your shelf</span>
            </Link>
          )}

          <div className="grid grid-cols-3 border-y border-foreground">
            <Stat value={finishedThisYear ?? "—"} label="finished this year" />
            <Stat value={shelf ? shelf.reading : "—"} label="reading now" to="/shelf" />
            <Stat value={notesCount >= 3 ? "3+" : notesCount} label="takeaways to finish" />
          </div>

          {recommendation && (
            <button
              type="button"
              onClick={() => onOpen(recommendation)}
              className="flex flex-col gap-1 border border-foreground/40 p-4 text-left hover:bg-foreground/[0.04]"
            >
              <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Matched to your DNA
              </span>
              <span className="font-serif text-xl italic">{recommendation.title}</span>
              {(recommendation.why || recommendation.author) && (
                <span className="line-clamp-2 text-[15px] text-foreground/80">{recommendation.why || recommendation.author}</span>
              )}
            </button>
          )}
        </div>

        <LibraryPortrait className="min-w-0 flex-[1_1_440px]" shape={shape} outlines={outlines} count={fiction.length} />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-serif text-[2rem] font-normal leading-tight">Finished</h2>
          <Link to="/shelf" className="text-sm text-primary underline">Your whole library</Link>
        </div>
        {books.length === 0 ? (
          <p className="max-w-prose font-serif text-lg text-foreground/80">
            Mark a book finished on its page and it lands here, drawn as its own shape.
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-3.5 sm:grid-cols-4 md:grid-cols-[repeat(auto-fill,minmax(118px,1fr))]">
            {books.map((b) => (
              <li key={b.cacheKey + b.title}>
                <button
                  type="button"
                  onClick={() => onOpen(b)}
                  className="group flex w-full flex-col gap-2 text-left"
                  aria-label={`${b.title}${b.rating !== null ? `, rated ${b.rating} out of 10` : ""}`}
                >
                  <span className="block aspect-[2/3] w-full border border-foreground group-hover:-translate-y-0.5 transition-transform">
                    {b.glyph ? (
                      <GlyphPlate analysis={b.glyph} titleClassName="text-[13px]" />
                    ) : (
                      <span className="flex h-full w-full flex-col justify-end bg-foreground p-2 font-serif text-sm italic leading-tight text-background">
                        {b.title}
                      </span>
                    )}
                  </span>
                  <span className="text-[13px] text-foreground/80">{b.rating !== null ? `${b.rating} / 10` : " "}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default HomeLibrary;
