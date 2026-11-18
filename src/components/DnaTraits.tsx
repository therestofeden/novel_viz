import { useMemo } from "react";

import {
  type NovelAnalysis,
  DNA_AXIS_META,
  NF_DNA_AXIS_META,
  isNonFiction,
} from "@/lib/novel-types";
import { bookInk, definingAxes } from "@/lib/dna-glyph";

/**
 * DnaTraits: the three axes that most define this book (furthest from the
 * middle), each with the evidence the analysis gave for it. The glyph shows
 * the shape; this says in words why it is that shape. Tiles on wide screens,
 * compact rows on a phone.
 */
export function DnaTraits({ analysis }: { analysis: NovelAnalysis }) {
  const traits = useMemo(() => definingAxes(analysis, 3), [analysis]);
  const ink = useMemo(() => bookInk(analysis), [analysis]);
  const meta = (isNonFiction(analysis) ? NF_DNA_AXIS_META : DNA_AXIS_META) as Record<
    string,
    { name: string; low: string; high: string }
  >;
  const evidence = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of analysis.dna?.axes ?? []) if (a?.evidence) m.set(a.id, a.evidence);
    return m;
  }, [analysis]);

  if (traits.length < 3) return null;

  return (
    <section aria-label="What makes this book this shape" className="border-b border-foreground">
      <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-8 md:py-10">
        <ul className="grid gap-px border border-foreground/20 bg-foreground/20 sm:grid-cols-3">
          {traits.map((t) => {
            const m = meta[t.id];
            const pole = m ? (t.score >= 50 ? m.high : m.low) : null;
            return (
              <li key={t.id} className="flex items-baseline gap-4 bg-card p-4 sm:flex-col sm:gap-2 sm:p-6">
                <span
                  className="w-12 shrink-0 font-serif text-4xl leading-[0.9] sm:w-auto sm:text-[3.5rem]"
                  style={{ color: ink.inkText }}
                >
                  {Math.round(t.score)}
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-base font-semibold leading-snug sm:text-lg">
                    {t.name}
                    {pole && <span className="font-normal text-muted-foreground"> · {pole}</span>}
                  </span>
                  {evidence.get(t.id) && (
                    <span className="font-serif text-[15px] leading-relaxed text-foreground/80 sm:text-base">
                      {evidence.get(t.id)}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export default DnaTraits;
