import { petalPath, type ReadingShape } from "@/lib/dna-glyph";
import { cn } from "@/lib/utils";

const MIN_BOOKS = 3;

/**
 * "Your reading shape": the average glyph of the reader's finished fiction in
 * sky blue, with every finished book's outline faintly behind it. Sits on a
 * navy panel, so it uses cream strokes. Fiction only: fiction and non-fiction
 * DNA use different twelve axes, so a mixed average would mean nothing.
 */
export function LibraryPortrait({
  shape,
  outlines,
  count,
  className,
}: {
  shape: ReadingShape | null;
  /** one petal path per finished fiction book */
  outlines: string[];
  /** how many finished fiction books fed the shape */
  count: number;
  className?: string;
}) {
  const ready = shape !== null && count >= MIN_BOOKS;
  return (
    <section
      className={cn("flex flex-wrap items-center gap-6 bg-foreground p-6 text-background md:p-7", className)}
      aria-label="Your reading shape"
    >
      <svg
        viewBox="0 0 200 200"
        className="mx-auto h-auto w-full max-w-[250px] flex-none sm:mx-0 sm:w-[220px] md:w-[250px]"
        role="img"
        aria-label={
          ready
            ? `Your reading shape, the average of ${count} finished books. Long on ${shape.longest}. Short on ${shape.shortest}.`
            : "Your reading shape appears here once you have finished a few fiction books."
        }
      >
        <circle cx={100} cy={100} r={94} fill="none" stroke="hsl(var(--background))" strokeOpacity={0.3} strokeWidth={0.6} strokeDasharray="1.5 2.5" />
        {ready &&
          outlines.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="hsl(var(--background))" strokeOpacity={0.28} strokeWidth={0.6} />
          ))}
        {ready && <path d={petalPath(shape.avg)} fill="#5BA3D9" />}
        <circle cx={100} cy={100} r={3.4} fill="hsl(var(--background))" />
      </svg>
      <div className="flex min-w-[180px] flex-1 flex-col gap-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-background/75">Your reading shape</h2>
        {ready ? (
          <>
            <p className="font-serif text-[1.75rem] leading-[1.15]">Long on {shape.longest}.</p>
            <p className="text-[15px] leading-relaxed text-background/80">
              Short on {shape.shortest}.
              {shape.nearest && (
                <>
                  {" "}The book closest to your average is{" "}
                  <em className="font-serif text-background">{shape.nearest}</em>.
                </>
              )}
            </p>
            <p className="text-[13px] text-background/65">
              The average of {count} finished fiction {count === 1 ? "book" : "books"}.
            </p>
          </>
        ) : (
          <>
            <p className="font-serif text-[1.5rem] leading-[1.2]">Your shape appears after three books.</p>
            <p className="text-[15px] leading-relaxed text-background/80">
              Finish {Math.max(1, MIN_BOOKS - count)} more fiction {MIN_BOOKS - count === 1 ? "book" : "books"} and
              this fills in with the average of everything you have read.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
export default LibraryPortrait;
