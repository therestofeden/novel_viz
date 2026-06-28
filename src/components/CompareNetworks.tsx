import { useMemo } from "react";
import { CharacterNetwork } from "@/components/CharacterNetwork";
import type { Character, FictionAnalysis, NovelAnalysis } from "@/lib/novel-types";
import { isFiction } from "@/lib/novel-types";
import { cn } from "@/lib/utils";

interface Loaded {
  cache_key: string;
  title: string;
  author: string;
  analysis: NovelAnalysis;
}

interface Props {
  a: Loaded;
  b: Loaded;
}

const ROLE_TIER: Record<string, number> = {
  protagonist: 5,
  narrator: 4,
  deuteragonist: 4,
  antagonist: 4,
  supporting: 2,
  minor: 1,
};

interface ArchMatch {
  fromA: Character;
  fromB: Character;
  why: string;
}

function archetypeMatches(a: NovelAnalysis, b: NovelAnalysis): ArchMatch[] {
  // Only available for fiction books with character data
  if (!isFiction(a) || !isFiction(b)) return [];
  const topA = (a.characters ?? []).filter((c) => (ROLE_TIER[c.role] ?? 0) >= 4);
  const topB = (b.characters ?? []).filter((c) => (ROLE_TIER[c.role] ?? 0) >= 4);
  if (topA.length === 0 || topB.length === 0) return [];

  const matches: ArchMatch[] = [];
  const usedB = new Set<string>();

  // Greedy match: same role first, otherwise tier ≥ 4
  for (const ca of topA) {
    let best: { c: Character; score: number; why: string } | null = null;
    for (const cb of topB) {
      if (usedB.has(cb.id)) continue;
      let score = 0;
      const reasons: string[] = [];
      if (ca.role === cb.role) {
        score += 3;
        reasons.push(`both ${ca.role}s`);
      } else if ((ROLE_TIER[ca.role] ?? 0) >= 4 && (ROLE_TIER[cb.role] ?? 0) >= 4) {
        score += 1;
        reasons.push(`${ca.role} ↔ ${cb.role}`);
      }
      // Confidence bump
      if (ca.confidence === "high" && cb.confidence === "high") score += 0.5;
      if (score > (best?.score ?? -1)) {
        best = { c: cb, score, why: reasons.join(" · ") };
      }
    }
    if (best && best.score >= 1) {
      matches.push({ fromA: ca, fromB: best.c, why: best.why });
      usedB.add(best.c.id);
    }
    if (matches.length >= 4) break;
  }
  return matches;
}

export const CompareNetworks = ({ a, b }: Props) => {
  const matches = useMemo(() => archetypeMatches(a.analysis, b.analysis), [a, b]);

  return (
    <div className="ink-border bg-card">
      <div className="border-b border-foreground bg-foreground px-4 py-2 text-background">
        <div className="meta">Networks · side by side</div>
      </div>

      {isFiction(a.analysis) && isFiction(b.analysis) ? (
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className={cn("border-foreground", "md:border-r")}>
            <div className="border-b border-foreground/30 px-4 py-2">
              <div className="meta text-muted-foreground">A</div>
              <div className="font-serif text-base italic">{a.title}</div>
            </div>
            <div className="[&_h3]:hidden [&_button[aria-label='Zoom_in']]:hidden">
              <CharacterNetwork analysis={a.analysis} cacheKey={a.cache_key} />
            </div>
          </div>
          <div className="border-t border-foreground md:border-l-0 md:border-t-0">
            <div className="border-b border-foreground/30 px-4 py-2">
              <div className="meta text-muted-foreground">B</div>
              <div className="font-serif text-base italic">{b.title}</div>
            </div>
            <div>
              <CharacterNetwork analysis={b.analysis} cacheKey={b.cache_key} />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
          {[{ slot: "A", loaded: a }, { slot: "B", loaded: b }].map(({ slot, loaded }) => (
            <div key={slot} className={cn("px-4 py-5", slot === "B" && "border-t border-foreground/30 md:border-l md:border-t-0")}>
              <div className="meta text-muted-foreground">{slot} · {loaded.title}</div>
              <div className="meta mt-2 text-muted-foreground italic">
                {isFiction(loaded.analysis) ? "Fiction — character network not shown in side-by-side" : "Non-fiction — no character network"}
              </div>
            </div>
          ))}
        </div>
      )}

      {matches.length > 0 && (
        <div className="border-t border-foreground px-4 py-4">
          <div className="meta mb-3 flex items-center gap-2 text-primary">
            <span className="inline-block h-2 w-2 bg-primary" />
            Shared archetypes · {matches.length}
          </div>
          <ul className="space-y-2">
            {matches.map((m, i) => (
              <li
                key={i}
                className="grid grid-cols-12 items-baseline gap-2 border-t border-foreground/20 pt-2 first:border-t-0 first:pt-0"
              >
                <div className="col-span-5 font-serif italic">{m.fromA.name}</div>
                <div className="meta col-span-2 text-center text-primary">↔</div>
                <div className="col-span-5 font-serif italic">{m.fromB.name}</div>
                <div className="meta col-span-12 text-muted-foreground">{m.why}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
