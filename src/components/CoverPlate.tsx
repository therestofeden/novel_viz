import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * CoverPlate — the book-cover "plate" used in every masthead.
 *
 * Real art renders as a hard-edged, zero-radius, no-shadow plate (the
 * "plate" language and 2:3, hard-border treatment are from the
 * 2026-09-07 Goodreads-gap review, finding 01) — replacing the old
 * `rounded shadow-lg ring-1` styling, which was the one place in the app
 * that didn't match its own zero-radius/no-shadow design system.
 *
 * Coverage will never be 100% on any cover source (see src/lib/covers.ts),
 * so a missing or failed cover doesn't collapse to an empty gap or a
 * broken-image icon — it falls back to a small typeset plate: a dropcap
 * off the title in the same Fraunces italic used for the "signature"
 * language elsewhere, echoing the kinetic-spine motif in BookDNA. Reads as
 * "this book, no art yet," not as an error.
 */
export function CoverPlate({
  coverUrl,
  title,
  author,
  className,
}: {
  coverUrl: string | null | undefined;
  title: string;
  author?: string | null;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);

  // A new coverUrl (different book) deserves a fresh chance to load, not
  // the previous book's error state.
  useEffect(() => {
    setErrored(false);
  }, [coverUrl]);

  const showImage = !!coverUrl && !errored;
  const initial = title.trim().charAt(0).toUpperCase() || "?";
  const surname = author && author !== "Unknown" ? author.trim().split(/\s+/).slice(-1)[0] : null;

  return (
    <div
      className={cn(
        "flex aspect-[2/3] flex-shrink-0 items-center justify-center overflow-hidden border border-foreground bg-foreground",
        className,
      )}
    >
      {showImage ? (
        <img
          src={coverUrl!}
          alt={`${title} cover`}
          className="h-full w-full object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-1 text-center text-background">
          <div className="font-serif text-3xl italic leading-none md:text-4xl" aria-hidden="true">
            {initial}
          </div>
          <div className="h-px w-4 bg-background/30" aria-hidden="true" />
          {surname && <div className="meta w-full truncate text-background/60">{surname}</div>}
        </div>
      )}
    </div>
  );
}

export default CoverPlate;
