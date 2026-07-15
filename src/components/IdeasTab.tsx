/**
 * IdeasTab — Phase 1 non-fiction idea architecture
 *
 * Two views toggled by a header control:
 *   Outline — hierarchical collapsible tree: thesis → pillars → evidence/implication
 *   Cards   — idea cards with tag, full-sentence claim, evidence, per-idea note, star
 *
 * Stars and notes are persisted to localStorage keyed by cacheKey.
 * Phase 2 will migrate persistence to Supabase shelf_books.idea_annotations.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Star, StickyNote } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import {
  ArgumentPillar,
  IdeaCard,
  IdeaCardTag,
  NonFictionAnalysis,
} from "@/lib/novel-types";
import { cn } from "@/lib/utils";

// ─── Tag meta ─────────────────────────────────────────────────────────────────

const TAG_META: Record<IdeaCardTag, { label: string; bg: string; text: string }> = {
  // core_thesis: inverted (foreground bg) — highest emphasis, always legible in any theme
  core_thesis:        { label: "Core thesis",  bg: "hsl(var(--foreground))",          text: "hsl(var(--background))" },
  // supporting_argument: lane-4 is a dark medium-blue → needs light text
  supporting_argument:{ label: "Argument",     bg: "hsl(var(--lane-4))",              text: "hsl(var(--background))" },
  // evidence / implication: lighter lanes (60 / 56 % lightness) → dark foreground text readable
  evidence:           { label: "Evidence",     bg: "hsl(var(--lane-7))",              text: "hsl(var(--foreground))" },
  implication:        { label: "Implication",  bg: "hsl(var(--lane-10))",             text: "hsl(var(--foreground))" },
  // counterpoint: destructive token already ships with a paired foreground
  counterpoint:       { label: "Counterpoint", bg: "hsl(var(--destructive))",         text: "hsl(var(--destructive-foreground))" },
};

// ─── Persistence helpers (localStorage Phase 1) ───────────────────────────────

function storageKey(cacheKey: string) {
  return `nviz_ideas_${cacheKey}`;
}

interface StoredData {
  stars: string[];
  notes: Record<string, string>;
}

function loadStored(cacheKey: string): StoredData {
  try {
    const raw = localStorage.getItem(storageKey(cacheKey));
    if (raw) return JSON.parse(raw) as StoredData;
  } catch { /* ignore */ }
  return { stars: [], notes: {} };
}

function saveStored(cacheKey: string, data: StoredData) {
  try {
    localStorage.setItem(storageKey(cacheKey), JSON.stringify(data));
  } catch { /* ignore */ }
}

// ─── Outline view ─────────────────────────────────────────────────────────────

interface OutlineProps {
  analysis: NonFictionAnalysis;
  ideaById: Map<string, IdeaCard>;
  stars: Set<string>;
  onStar: (id: string) => void;
}

function PillarRow({
  pillar,
  index,
  ideaById,
  stars,
  onStar,
}: {
  pillar: ArgumentPillar;
  index: number;
  ideaById: Map<string, IdeaCard>;
  stars: Set<string>;
  onStar: (id: string) => void;
}) {
  const [open, setOpen] = useState(index === 0);
  const linkedCards = pillar.ideaIds
    .map((id) => ideaById.get(id))
    .filter(Boolean) as IdeaCard[];

  return (
    <div className="ink-border-b">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/40"
      >
        <span className="meta mt-0.5 w-5 shrink-0 text-muted-foreground">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-sans text-sm font-semibold leading-snug">{pillar.claim}</p>
        </div>
        <ChevronDown
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="grid gap-0 border-t border-foreground/10 md:grid-cols-2">
              {/* Evidence */}
              <div className="border-b border-foreground/10 px-5 py-4 md:border-b-0 md:border-r">
                <div className="meta mb-2 text-muted-foreground">Evidence</div>
                <p className="font-serif text-sm leading-relaxed text-foreground/90">
                  {pillar.evidence}
                </p>
              </div>
              {/* Implication */}
              <div className="px-5 py-4">
                <div className="meta mb-2 text-muted-foreground">Implication</div>
                <p className="font-serif text-sm leading-relaxed text-foreground/90 italic">
                  {pillar.implication}
                </p>
              </div>
            </div>

            {/* Linked idea cards */}
            {linkedCards.length > 0 && (
              <div className="border-t border-foreground/10 px-5 py-3">
                <div className="meta mb-2.5 text-muted-foreground">Related ideas</div>
                <div className="flex flex-col gap-2">
                  {linkedCards.map((card) => {
                    const tm = TAG_META[card.tag] ?? TAG_META.supporting_argument;
                    const starred = stars.has(card.id);
                    return (
                      <div key={card.id} className="flex items-start gap-2.5">
                        <button
                          onClick={() => onStar(card.id)}
                          className={cn(
                            "mt-0.5 shrink-0 transition-colors",
                            starred ? "text-primary" : "text-foreground/20 hover:text-foreground/50",
                          )}
                          aria-label={starred ? "Unstar idea" : "Star idea"}
                        >
                          <Star
                            className="h-3.5 w-3.5"
                            fill={starred ? "currentColor" : "none"}
                          />
                        </button>
                        <p className="font-sans text-xs leading-relaxed text-foreground/80">
                          <span
                            className="meta mr-1.5 inline-block px-1 py-px text-[9px]"
                            style={{ background: tm.bg, color: tm.text }}
                          >
                            {tm.label}
                          </span>
                          {card.claim}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function OutlineView({ analysis, ideaById, stars, onStar }: OutlineProps) {
  const pillars = analysis.argumentPillars ?? [];

  return (
    <div>
      {/* Thesis */}
      <div className="ink-border-b bg-foreground px-5 py-5 text-background">
        <div className="meta mb-2 text-background/60">Central thesis</div>
        <p className="font-serif text-lg leading-snug italic md:text-xl">
          {analysis.thesis}
        </p>
      </div>

      {pillars.length === 0 ? (
        <div className="px-5 py-10 text-sm text-muted-foreground">
          No argument pillars extracted — re-analyze the book to generate them.
        </div>
      ) : (
        pillars.map((p, i) => (
          <PillarRow
            key={p.id}
            pillar={p}
            index={i}
            ideaById={ideaById}
            stars={stars}
            onStar={onStar}
          />
        ))
      )}
    </div>
  );
}

// ─── Cards view ───────────────────────────────────────────────────────────────

interface CardProps {
  card: IdeaCard;
  starred: boolean;
  note: string;
  onStar: () => void;
  onNoteChange: (note: string) => void;
}

function IdeaCardItem({ card, starred, note, onStar, onNoteChange }: CardProps) {
  const [noteOpen, setNoteOpen] = useState(!!note);
  const [localNote, setLocalNote] = useState(note);
  const debounce = useRef<number | null>(null);
  const tm = TAG_META[card.tag] ?? TAG_META.supporting_argument;

  // sync if note changes externally
  useEffect(() => { setLocalNote(note); }, [note]);

  const handleNoteChange = useCallback(
    (val: string) => {
      setLocalNote(val);
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = window.setTimeout(() => onNoteChange(val), 800);
    },
    [onNoteChange],
  );

  return (
    <div className="ink-border bg-card">
      {/* Card header */}
      <div className="flex items-center justify-between border-b border-foreground/10 px-4 py-2">
        <span
          className="meta px-1.5 py-0.5 text-[9px]"
          style={{ background: tm.bg, color: tm.text }}
        >
          {tm.label}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setNoteOpen((o) => !o); }}
            className={cn(
              "transition-colors",
              noteOpen || note
                ? "text-primary"
                : "text-foreground/20 hover:text-foreground/50",
            )}
            aria-label="Toggle note"
          >
            <StickyNote className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onStar}
            className={cn(
              "transition-colors",
              starred ? "text-primary" : "text-foreground/20 hover:text-foreground/50",
            )}
            aria-label={starred ? "Unstar" : "Star this idea"}
          >
            <Star
              className="h-3.5 w-3.5"
              fill={starred ? "currentColor" : "none"}
            />
          </button>
        </div>
      </div>

      {/* Claim */}
      <div className="px-4 py-4">
        <p className="font-sans text-sm font-semibold leading-snug">{card.claim}</p>
      </div>

      {/* Evidence */}
      <div className="border-t border-foreground/10 px-4 py-3">
        <div className="meta mb-1.5 text-muted-foreground">Evidence</div>
        <p className="font-serif text-xs leading-relaxed text-foreground/80">
          {card.evidence}
        </p>
      </div>

      {/* Note (collapsible) */}
      <AnimatePresence initial={false}>
        {noteOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-foreground/10 px-4 py-3">
              <div className="meta mb-1.5 text-muted-foreground">Your note</div>
              <textarea
                value={localNote}
                onChange={(e) => handleNoteChange(e.target.value)}
                onBlur={() => onNoteChange(localNote)}
                placeholder="Add a note on this idea…"
                rows={3}
                className="w-full resize-none bg-transparent font-serif text-xs leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/50"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CardsView({
  cards,
  stars,
  notes,
  onStar,
  onNoteChange,
}: {
  cards: IdeaCard[];
  stars: Set<string>;
  notes: Record<string, string>;
  onStar: (id: string) => void;
  onNoteChange: (id: string, note: string) => void;
}) {
  const [filter, setFilter] = useState<IdeaCardTag | "all">("all");
  const tagOrder: IdeaCardTag[] = [
    "core_thesis", "supporting_argument", "evidence", "implication", "counterpoint",
  ];
  const presentTags = tagOrder.filter((t) => cards.some((c) => c.tag === t));
  const filtered = filter === "all" ? cards : cards.filter((c) => c.tag === filter);

  return (
    <div>
      {/* Filter strip */}
      <div className="flex items-center gap-0 overflow-x-auto border-b border-foreground">
        <button
          onClick={() => setFilter("all")}
          className={cn(
            "meta shrink-0 border-r border-foreground px-4 py-2.5 transition-colors",
            filter === "all" ? "bg-foreground text-background" : "hover:bg-muted/40",
          )}
        >
          All ({cards.length})
        </button>
        {presentTags.map((tag) => {
          const tm = TAG_META[tag];
          const count = cards.filter((c) => c.tag === tag).length;
          return (
            <button
              key={tag}
              onClick={() => setFilter(tag)}
              className={cn(
                "meta shrink-0 border-r border-foreground px-4 py-2.5 transition-colors",
                filter === tag ? "bg-foreground text-background" : "hover:bg-muted/40",
              )}
            >
              {tm.label} ({count})
            </button>
          );
        })}
        {stars.size > 0 && (
          <button
            onClick={() => setFilter("all")}
            className="meta ml-auto shrink-0 flex items-center gap-1 px-4 py-2.5 text-primary"
          >
            <Star className="h-3 w-3" fill="currentColor" />
            {stars.size} starred
          </button>
        )}
      </div>

      {/* Card list */}
      <div className="grid gap-4 p-4 md:grid-cols-2 md:p-6 lg:grid-cols-2">
        {filtered.map((card) => (
          <IdeaCardItem
            key={card.id}
            card={card}
            starred={stars.has(card.id)}
            note={notes[card.id] ?? ""}
            onStar={() => onStar(card.id)}
            onNoteChange={(note) => onNoteChange(card.id, note)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  analysis: NonFictionAnalysis;
  cacheKey?: string | null;
  onReanalyze?: () => void;
}

type View = "outline" | "cards";

export function IdeasTab({ analysis, cacheKey, onReanalyze }: Props) {
  const [view, setView] = useState<View>("outline");
  const [stars, setStars] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const key = cacheKey ?? analysis.title;

  // Load from localStorage on mount / book change
  useEffect(() => {
    const stored = loadStored(key);
    setStars(new Set(stored.stars));
    setNotes(stored.notes);
  }, [key]);

  const toggleStar = useCallback(
    (id: string) => {
      setStars((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        saveStored(key, { stars: Array.from(next), notes });
        return next;
      });
    },
    [key, notes],
  );

  const handleNoteChange = useCallback(
    (id: string, note: string) => {
      setNotes((prev) => {
        const next = { ...prev, [id]: note };
        if (!note) delete next[id];
        saveStored(key, { stars: Array.from(stars), notes: next });
        return next;
      });
    },
    [key, stars],
  );

  const cards = analysis.ideaCards ?? [];
  const ideaById = new Map(cards.map((c) => [c.id, c]));

  const hasIdeas = cards.length > 0 || (analysis.argumentPillars ?? []).length > 0;

  if (!hasIdeas) {
    return (
      <div className="flex flex-col items-center gap-5 px-6 py-20 text-center">
        <p className="font-serif text-base italic text-foreground/70">
          No argument structure yet for <span className="not-italic font-semibold">{analysis.title}</span>.
        </p>
        <p className="text-xs text-muted-foreground max-w-sm">
          This book was analyzed before the Ideas feature launched. A quick re-analyze will extract
          the thesis, argument pillars, and idea cards.
        </p>
        {onReanalyze && (
          <button
            onClick={onReanalyze}
            className="meta border border-foreground px-5 py-2.5 text-sm transition-colors hover:bg-foreground/10"
          >
            Re-analyze book
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* View toggle */}
      <div className="flex items-center border-b border-foreground">
        {(["outline", "cards"] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "meta border-r border-foreground px-5 py-3 capitalize transition-colors",
              view === v ? "bg-foreground text-background" : "hover:bg-muted/40",
            )}
          >
            {v}
            {v === "cards" && cards.length > 0 && (
              <span className="ml-1.5 opacity-50">({cards.length})</span>
            )}
          </button>
        ))}
        <div className="ml-auto px-5 py-3">
          <div className="meta text-muted-foreground hidden sm:block">
            {analysis.title} · {(analysis.argumentPillars ?? []).length} pillars
          </div>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
        >
          {view === "outline" ? (
            <OutlineView
              analysis={analysis}
              ideaById={ideaById}
              stars={stars}
              onStar={toggleStar}
            />
          ) : (
            <CardsView
              cards={cards}
              stars={stars}
              notes={notes}
              onStar={toggleStar}
              onNoteChange={handleNoteChange}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
