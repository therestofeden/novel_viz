import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronDown, Loader2, Pin, X } from "lucide-react";
import { motion } from "framer-motion";

import {
  NovelAnalysis,
  Recommendation,
  DnaAxisId,
  DNA_AXIS_META,
  DNA_AXIS_IDS,
  NfDnaAxisId,
  NF_DNA_AXIS_META,
  NF_DNA_AXIS_IDS,
  isNonFiction,
} from "@/lib/novel-types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { BuyButton } from "@/components/BuyButton";
import { BookPoster, DnaNeighbourhood } from "@/components/DnaNeighbourhood";
import { GlyphPlate } from "@/components/GlyphPlate";
import { GLYPH_BOX, OPEN_DNA_EVENT, R_MAX, bookInk, glyphSource, spokePath } from "@/lib/dna-glyph";
import { ease } from "@/lib/motion";
import { track } from "@/lib/track";

// Widened to `string`: supabase-js's typed select parser trips TS2589 on a
// JSON-path alias.
const KINDRED_DNA_SELECT: string = "dna:analysis->dna";

interface BookDNAProps {
  analysis: NovelAnalysis;
  cacheKey?: string | null;
}

// 2026-09-18 (daily backend audit): recommend-by-dna calls Gemini
// (geminiFetchWithFallback), bound server-side by gemini.ts's
// MAX_TOTAL_MS=90_000 hard ceiling — same class of call as analyze-novel's
// ANALYSIS_IDLE_TIMEOUT_MS and TakeawaysTab's SYNTHESIZE_IDLE_TIMEOUT_MS,
// both 100_000 to give 10s of headroom over that same 90s server cap. This
// call site (and AntiShelf's/BuyButton's) was the one remaining
// `supabase.functions.invoke()` gap: every raw `fetch()` in the app has
// carried a `signal` since 09-14/09-15/09-16, but `.invoke()` calls didn't.
// A wedged connection here left `recLoading` stuck `true` forever with no
// error and no retry — this fetch drives the live-updating recommendation
// as a reader drags DNA-axis sliders, debounced 1s apart, so a stuck
// `recLoading` silently freezes that whole interaction.
const RECOMMEND_TIMEOUT_MS = 100_000;

/**
 * Book DNA — readable strand of 12 axes.
 *
 * Opens from "See Book DNA" (or the hero glyph). Each axis is a quiet row
 * in the book's own ink: name, serif score, a thin rule and a round marker.
 * Drag any marker to register your take; absolute scores autosave per book.
 * Evidence sits in a sticky card on desktop and inline under the pinned row
 * on a phone.
 */
export function BookDNA({ analysis, cacheKey }: BookDNAProps) {
  const { user } = useAuth();
  const dna = analysis.dna;
  const rec = analysis.recommendation;
  const nf = isNonFiction(analysis);
  // The book's own ink (Paper & ink): bars, numerals and markers use it.
  const ink = useMemo(() => bookInk(analysis), [analysis]);

  // Use non-fiction axis IDs and meta when applicable
  const AXIS_IDS = nf ? (NF_DNA_AXIS_IDS as unknown as readonly DnaAxisId[]) : DNA_AXIS_IDS;
  const AXIS_META = nf
    ? (NF_DNA_AXIS_META as unknown as typeof DNA_AXIS_META)
    : DNA_AXIS_META;

  const [hoveredAxis, setHoveredAxis] = useState<DnaAxisId | null>(null);
  // Clicking (or tapping) an axis used to just call setHoveredAxis — identical
  // to plain hover — so the evidence panel reverted the instant the pointer
  // moved away, making the evidence text unreadable without holding the mouse
  // perfectly still. pinnedAxis is a separate, click-driven selection that
  // takes priority over hover and persists until the reader clicks again
  // (same axis to unpin, a different one to re-pin). Works identically for
  // mouse clicks and touch taps since it's driven by onClick, not
  // onMouseEnter/onMouseLeave.
  const [pinnedAxis, setPinnedAxis] = useState<DnaAxisId | null>(null);
  const activeAxis = pinnedAxis ?? hoveredAxis;
  const [perturbations, setPerturbations] = useState<Partial<Record<DnaAxisId, number>>>({});
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<number | null>(null);

  // Does Gemini's pick actually exist in NovelViz? An audit on 2026-09-07
  // found only 26% of stored recommendations name a book with a page, which
  // is precisely why this panel's sole action used to be a shop link. When
  // there IS a page we link inward; when there isn't, the CTA becomes
  // "Map this book" — the miss turns into the corpus's own growth loop.
  // 2026-09-19: replaced the expand/collapse gate with always-visible rows.
  // 2026-09-20: dropped the two-size (defining vs. quiet) treatment those
  // rows started with — see renderAxisRow, below — in favor of one uniform
  // bar size for all twelve axes, with evidence surfaced on hover/click.
  const [kindredSlug, setKindredSlug] = useState<string | null>(null);
  const [kindredChecked, setKindredChecked] = useState(false);
  const [kindredAxes, setKindredAxes] = useState<Array<{ id: string; score: number }> | null>(null);

  // 2026-11-18 (Paper & ink redesign): the strand is one tap away instead of
  // always open. The glyph above the fold is the at-a-glance read; this is
  // the instrument. BookHero's glyph fires OPEN_DNA_EVENT to open it.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_DNA_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_DNA_EVENT, onOpen);
  }, []);

  // Dynamic recommendation — re-fetched from recommend-by-dna whenever the
  // user adjusts DNA sliders. Null means "use the original inline rec".
  const [dynamicRec, setDynamicRec] = useState<Recommendation | null>(null);
  const [recLoading, setRecLoading] = useState(false);
  const [recSource, setRecSource] = useState<"personal" | "consensus" | null>(null);
  const recTimer = useRef<number | null>(null);

  // Wisdom-of-the-crowds: the book's crowd-consensus DNA (Bayesian blend of
  // Gemini's original + up to the last 100 readers' saved overrides), plus a
  // cached recommendation for that consensus point. Public read — works for
  // every visitor, logged in or not. A reader's OWN saved override (if any)
  // always takes precedence over this for that reader; see effectiveScore.
  const [consensusData, setConsensusData] = useState<{
    axes: Record<string, { score: number; voteCount: number }>;
    recommendation: Recommendation | null;
  } | null>(null);

  // Define derived maps/sets before the callback that closes over them,
  // so they are already initialised when useCallback evaluates its deps array.
  const axesById = useMemo(() => {
    const m = new Map<DnaAxisId, { score: number; evidence: string }>();
    for (const a of dna?.axes ?? []) m.set(a.id as DnaAxisId, { score: a.score, evidence: a.evidence });
    return m;
  }, [dna]);


  // Consensus expressed as deltas-from-Gemini-original, same shape as
  // `perturbations`, so it can slot into effectiveScore as a fallback layer
  // beneath the reader's own (higher-priority) personal perturbations.
  const consensusPerturbations = useMemo(() => {
    const out: Partial<Record<DnaAxisId, number>> = {};
    if (!consensusData) return out;
    for (const id of AXIS_IDS) {
      const c = consensusData.axes[id];
      const base = axesById.get(id)?.score;
      if (c && typeof base === "number" && Math.abs(c.score - base) > 0.001) {
        out[id] = c.score - base;
      }
    }
    return out;
  }, [consensusData, axesById, AXIS_IDS]);

  const maxVoteCount = useMemo(() => {
    if (!consensusData) return 0;
    return Object.values(consensusData.axes).reduce((m, v) => Math.max(m, v.voteCount), 0);
  }, [consensusData]);

  // Fetch the book's crowd consensus once per book. Public read (works
  // logged-out too) — the row may not exist yet for books nobody has
  // adjusted, which is fine (falls back to the raw Gemini score everywhere).
  useEffect(() => {
    let cancelled = false;
    setConsensusData(null);
    if (!cacheKey) return;
    (async () => {
      const { data } = await supabase
        .from("book_dna_consensus")
        .select("consensus, recommendation")
        .eq("cache_key", cacheKey)
        .maybeSingle();
      if (cancelled || !data) return;
      setConsensusData({
        axes: (data.consensus as Record<string, { score: number; voteCount: number }>) ?? {},
        recommendation: (data.recommendation as unknown as Recommendation | null) ?? null,
      });
    })();
    return () => { cancelled = true; };
  }, [cacheKey]);

  // Once hydration of the reader's own overrides is done, if they haven't
  // personally touched anything, show the crowd-consensus recommendation
  // (already cached server-side — no Gemini call needed) instead of the
  // single-shot original Gemini recommendation.
  useEffect(() => {
    if (!hydrated) return;
    if (Object.keys(perturbations).length > 0) return; // personal touch wins — handled below
    if (consensusData?.recommendation) {
      setDynamicRec(consensusData.recommendation);
      setRecSource("consensus");
    }
  }, [hydrated, consensusData, perturbations]);

  // The reader's current point in DNA space: personal perturbation wins
  // per-axis if present, else the crowd-consensus point, else Gemini's
  // original. Lifted out of fetchDynamicRec (2026-09-07) because the DNA
  // neighbourhood needs the identical vector — the whole point of the two
  // tiers is that they describe the *same* point, one by judgement and one
  // by measurement, so they must never drift apart.
  const effectiveAxes = useMemo(
    () =>
      AXIS_IDS.map((id) => {
        const base = axesById.get(id)?.score ?? 50;
        const hasPersonal = Object.prototype.hasOwnProperty.call(perturbations, id);
        const delta = hasPersonal ? (perturbations[id] ?? 0) : (consensusPerturbations[id] ?? 0);
        return { id: id as string, score: Math.max(0, Math.min(100, base + delta)) };
      }),
    [AXIS_IDS, axesById, perturbations, consensusPerturbations],
  );

  // True once the reader (or the crowd) has moved this book off its own
  // stored DNA — tells the neighbourhood RPC whether to use the passed
  // vector or fall back to the book's canonical axes.
  const axesArePerturbed = useMemo(
    () =>
      Object.keys(perturbations).length > 0 ||
      Object.keys(consensusPerturbations).length > 0,
    [perturbations, consensusPerturbations],
  );

  const fetchDynamicRec = useCallback(async () => {
    track("recommendation_clicked", { surface: "book_dna" });
    setRecLoading(true);
    try {
      // Retrieve user's BYOK key from auth metadata (same pattern as AntiShelf/Index).
      const { data: { session } } = await supabase.auth.getSession();
      const geminiKey: string | undefined =
        (session?.user?.user_metadata?.gemini_key as string | undefined) ?? undefined;

      const res = await supabase.functions.invoke("recommend-by-dna", {
        body: {
          title: analysis.title,
          author: analysis.author,
          bookType: analysis.bookType,
          axes: effectiveAxes,
          cacheKey,
          ...(geminiKey ? { gemini_key: geminiKey } : {}),
        },
        signal: AbortSignal.timeout(RECOMMEND_TIMEOUT_MS),
      });
      if (!res.error && res.data?.recommendation) {
        setDynamicRec(res.data.recommendation as Recommendation);
        setRecSource("personal");
      }
    } catch (e) {
      console.error("recommend-by-dna error", e);
    } finally {
      setRecLoading(false);
    }
  }, [analysis, effectiveAxes, cacheKey]);

  // Debounced recommendation refresh whenever DNA sliders change.
  // Works for all users (logged-in or not) as long as the server has a Gemini key.
  useEffect(() => {
    if (Object.keys(perturbations).length === 0) return;
    if (recTimer.current) window.clearTimeout(recTimer.current);
    recTimer.current = window.setTimeout(() => { fetchDynamicRec(); }, 1000);
    return () => { if (recTimer.current) window.clearTimeout(recTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perturbations]);

  const activeRecForPage = dynamicRec ?? rec;
  useEffect(() => {
    const t = activeRecForPage?.title;
    if (!t) { setKindredSlug(null); setKindredChecked(true); return; }
    let cancelled = false;
    setKindredChecked(false);
    supabase
      .rpc("resolve_book_page", { p_title: t, p_author: activeRecForPage?.author ?? undefined })
      .then(async ({ data, error }) => {
        if (cancelled) return;
        const found = !error && data && data.length > 0 ? data[0].slug : null;
        setKindredSlug(found);
        setKindredChecked(true);
        setKindredAxes(null);
        if (!found) return;
        // its DNA, so the pick's poster can carry its glyph and ink
        const { data: row } = await supabase
          .from("novel_analyses")
          .select(KINDRED_DNA_SELECT)
          .eq("slug", found)
          .eq("is_validated", true)
          .maybeSingle();
        if (cancelled) return;
        const axes = (row as unknown as { dna?: { axes?: Array<{ id: string; score: number }> } } | null)?.dna?.axes;
        setKindredAxes(axes?.length ? axes : null);
      });
    return () => { cancelled = true; };
  }, [activeRecForPage?.title, activeRecForPage?.author]);

  // 2026-09-20: dropped the "defining axes render bigger" idea — Stefano's
  // feedback was that two bar sizes made a reader decode a hierarchy before
  // they'd read a single label. All twelve axes now render identically, in
  // canonical axis order. The "why" for any axis still lives in the
  // evidence panel on the right, driven by the existing pinnedAxis/
  // hoveredAxis hover-and-click state below — that part already worked.

  const focusAxis = activeAxis ?? rec?.shared_axes?.[0] ?? AXIS_IDS[0];
  const focusAxisMeta = AXIS_META[focusAxis] ?? DNA_AXIS_META[focusAxis as DnaAxisId];
  const focusAxisData = axesById.get(focusAxis);
  const focusIdx = AXIS_IDS.indexOf(focusAxis);

  const effectiveScore = (id: DnaAxisId): number => {
    const base = axesById.get(id)?.score ?? 50;
    // Personal perturbation (this reader's own saved/in-progress take) always
    // wins; otherwise fall back to the crowd-consensus point for this axis.
    const hasPersonal = Object.prototype.hasOwnProperty.call(perturbations, id);
    const delta = hasPersonal ? (perturbations[id] ?? 0) : (consensusPerturbations[id] ?? 0);
    return Math.max(0, Math.min(100, base + delta));
  };

  const totalDrift = useMemo(
    () => AXIS_IDS.reduce((sum, id) => sum + Math.abs(perturbations[id] ?? 0), 0),
    [perturbations, AXIS_IDS],
  );

  // Hydrate user overrides
  useEffect(() => {
    let cancelled = false;
    setHydrated(false);
    setPerturbations({});
    if (!user || !cacheKey) {
      setHydrated(true);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("book_overrides")
        .select("axis_overrides")
        .eq("user_id", user.id)
        .eq("cache_key", cacheKey)
        .maybeSingle();
      if (cancelled) return;
      if (data?.axis_overrides && typeof data.axis_overrides === "object") {
        const next: Partial<Record<DnaAxisId, number>> = {};
        for (const id of AXIS_IDS) {
          const stored = (data.axis_overrides as Record<string, number>)[id];
          const base = axesById.get(id)?.score;
          if (typeof stored === "number" && typeof base === "number") {
            const delta = stored - base;
            if (Math.abs(delta) > 0.001) next[id] = delta;
          }
        }
        setPerturbations(next);
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, cacheKey, axesById]);

  // Debounced autosave
  useEffect(() => {
    if (!hydrated || !user || !cacheKey) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      setSaveState("saving");
      const axis_overrides: Record<string, number> = {};
      for (const id of AXIS_IDS) {
        const delta = perturbations[id] ?? 0;
        if (Math.abs(delta) > 0.001) {
          const base = axesById.get(id)?.score ?? 50;
          axis_overrides[id] = Math.round(Math.max(0, Math.min(100, base + delta)) * 100) / 100;
        }
      }
      const { error } = await supabase
        .from("book_overrides")
        .upsert(
          { user_id: user.id, cache_key: cacheKey, axis_overrides },
          { onConflict: "user_id,cache_key" },
        );
      if (!error) {
        setSaveState("saved");
        window.setTimeout(() => setSaveState("idle"), 1500);

        // Fire-and-forget: fold this reader's take into the crowd consensus
        // server-side (Bayesian blend over the last 100 readers) and cache
        // the resulting recommendation for everyone. Never blocks the UI —
        // this reader's own view is already up to date via their perturbations.
        // 2026-09-22 (daily_novel_viz_feat): despite the 09-18 header comment
        // above claiming "the one remaining `supabase.functions.invoke()`
        // gap" was closed that day across recommend-by-dna/AntiShelf/
        // BuyButton, this call site — same file, added separately — was
        // missed: unlike those three it drives no `loading` state a stuck
        // promise could visibly wedge, so it slipped past that audit's
        // grep-by-symptom pass. dna-consensus can call Gemini on a cache
        // miss (server-side MAX_TOTAL_MS=90_000, same class as
        // recommend-by-dna itself, just steps 1-5 back from wherever the UI
        // sees it), so it gets the exact same RECOMMEND_TIMEOUT_MS ceiling
        // rather than BuyButton's shorter no-AI budget. A wedged connection
        // here no longer leaks an unresolved promise indefinitely.
        supabase.functions
          .invoke("dna-consensus", {
            body: { cacheKey },
            signal: AbortSignal.timeout(RECOMMEND_TIMEOUT_MS),
          })
          .then(({ data, error: consensusError }) => {
            if (consensusError || !data?.consensus) return;
            setConsensusData({
              axes: data.consensus as Record<string, { score: number; voteCount: number }>,
              recommendation: (data.recommendation as unknown as Recommendation | null) ?? null,
            });
          })
          .catch((e) => console.error("dna-consensus recompute error:", e));
      } else {
        setSaveState("idle");
      }
    }, 600);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [perturbations, hydrated, user, cacheKey, axesById]);

  // 2026-11-18 (Paper & ink): one quiet row per measurement, in the book's
  // own ink: a thin rule, a round marker you can drag, the score as a serif
  // numeral. The active row lifts onto card paper instead of inverting to
  // navy. On a phone the pinned row carries its evidence inline, because
  // the evidence panel would otherwise sit twelve rows away.
  const renderAxisRow = (id: DnaAxisId) => {
    const meta = AXIS_META[id] ?? DNA_AXIS_META[id as DnaAxisId];
    const score = effectiveScore(id);
    const base = axesById.get(id)?.score ?? 50;
    const isPinned = pinnedAxis === id;
    const isActive = activeAxis === id;
    const idx = AXIS_IDS.indexOf(id);
    const moved = Object.prototype.hasOwnProperty.call(perturbations, id);
    const evidenceText = axesById.get(id)?.evidence;
    const at = (v: number) => `calc(0.75rem + ((100% - 1.5rem) * ${v / 100}))`;

    return (
      <li
        key={id}
        onMouseEnter={() => setHoveredAxis(id)}
        onMouseLeave={() => setHoveredAxis((h) => (h === id ? null : h))}
        onClick={() => setPinnedAxis((p) => (p === id ? null : id))}
        className={cn(
          "cursor-pointer border-b border-foreground/15 px-3 pb-2 pt-3 transition-colors md:px-4",
          isActive ? "bg-card" : "hover:bg-card/60",
        )}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="w-5 shrink-0 font-mono text-[11px] text-muted-foreground">
              {String(idx + 1).padStart(2, "0")}
            </span>
            <span className="truncate text-[15px] font-semibold md:text-base">{meta.name}</span>
            {isPinned && (
              <Pin className="h-3 w-3 shrink-0 self-center" style={{ color: ink.inkText }} aria-label="Pinned" />
            )}
          </span>
          <span className="shrink-0 font-serif text-2xl leading-none tabular-nums" style={{ color: ink.inkText }}>
            {Math.round(score)}
          </span>
        </div>

        <div data-row className="relative mt-1 h-7 select-none">
          <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 bg-foreground/15" />
          <div
            className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2"
            style={{ width: at(score), backgroundColor: ink.inkText }}
          />
          {moved && (
            <div
              className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-foreground/50"
              style={{ left: at(base) }}
              title={`Original score: ${Math.round(base)}`}
            />
          )}
          <div
            aria-label={`${meta.name}: ${Math.round(score)}`}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(score)}
            tabIndex={0}
            className="absolute top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
            style={{ left: at(score) }}
            onPointerDown={(e) => {
              e.stopPropagation();
              const handle = e.currentTarget as HTMLDivElement;
              const row = handle.closest("[data-row]") as HTMLDivElement | null;
              if (!row) return;
              const startX = e.clientX;
              const startScore = effectiveScore(id);
              // Mouse input is precise; touch/pen has natural jitter, so use a
              // larger engagement threshold for non-mouse pointers.
              const THRESHOLD = e.pointerType === "mouse" ? 4 : 9;
              let engaged = false;
              setHoveredAxis(id);
              try { handle.setPointerCapture(e.pointerId); } catch { /* noop */ }
              const onMove = (ev: PointerEvent) => {
                if (!engaged && Math.abs(ev.clientX - startX) < THRESHOLD) return;
                if (!engaged) {
                  console.log({ ui: "book_dna_slider", event: "drag_engaged", pointerType: ev.pointerType });
                }
                engaged = true;
                const rect = row.getBoundingClientRect();
                const inner = rect.width - 24;
                const deltaPct = ((ev.clientX - startX) / inner) * 100;
                const next = Math.max(0, Math.min(100, startScore + deltaPct));
                setPerturbations((p) => ({ ...p, [id]: next - base }));
              };
              const onUp = (ev: PointerEvent) => {
                handle.removeEventListener("pointermove", onMove);
                handle.removeEventListener("pointerup", onUp);
                handle.removeEventListener("pointercancel", onUp);
                try { handle.releasePointerCapture(ev.pointerId); } catch { /* noop */ }
              };
              handle.addEventListener("pointermove", onMove);
              handle.addEventListener("pointerup", onUp);
              handle.addEventListener("pointercancel", onUp);
            }}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 5 : 1;
              const cur = effectiveScore(id);
              if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                e.preventDefault();
                setPerturbations((p) => ({ ...p, [id]: Math.max(0, cur - step) - base }));
              } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                e.preventDefault();
                setPerturbations((p) => ({ ...p, [id]: Math.min(100, cur + step) - base }));
              }
            }}
          >
            <span
              className={cn("block h-3.5 w-3.5 rounded-full transition-transform", isActive && "scale-125")}
              style={{ backgroundColor: ink.inkText, boxShadow: "0 0 0 3px hsl(var(--background))" }}
            />
          </div>
        </div>

        {isActive && (
          <div className="flex justify-between gap-4 text-xs text-muted-foreground">
            <span>{meta.low}</span>
            <span className="text-right">{meta.high}</span>
          </div>
        )}
        {isPinned && evidenceText && (
          <p
            className="mb-1 mt-3 border-l-2 pl-3 font-serif text-[15px] leading-relaxed text-foreground/80 md:hidden"
            style={{ borderColor: ink.inkText }}
          >
            {evidenceText}
          </p>
        )}
      </li>
    );
  };


  if (!dna || !rec || !dna.axes || dna.axes.length === 0) {
    return (
      <div className="ink-border bg-card p-8">
        <div className="meta text-muted-foreground">DNA not available for this analysis.</div>
        <p className="mt-3 font-serif text-sm italic text-muted-foreground">
          Re-run the analysis from the search bar to generate a DNA fingerprint.
        </p>
      </div>
    );
  }

  const activeRec = dynamicRec ?? rec;
  const pickLabel = recLoading ? "Our pick" : `Our pick · ${Math.round(activeRec.similarity)}%`;
  const pickTo = kindredSlug ? `/book/${kindredSlug}` : `/?book=${encodeURIComponent(activeRec.title)}`;
  const pickPoster = (
    <BookPoster
      key="pick"
      to={pickTo}
      title={activeRec.title}
      author={activeRec.author}
      plate={
        recLoading ? (
          <div className="flex h-full w-full items-center justify-center bg-secondary">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Finding your match" />
          </div>
        ) : kindredAxes ? (
          <GlyphPlate
            analysis={glyphSource(activeRec.title, analysis.bookType, kindredAxes)}
            label={pickLabel}
            titleClassName="text-[15px] md:text-xl"
          />
        ) : (
          // The pick isn't in NovelViz yet, so there is no DNA to draw. Show
          // an empty, dashed ring of the twelve axes (honest: unmeasured)
          // in the same frame as its neighbours, with the way to map it.
          <div className="flex h-full w-full flex-col justify-between bg-secondary p-[9%] text-foreground">
            <span className="font-mono text-[11px] leading-none tracking-tight">{pickLabel}</span>
            <span className="relative flex flex-1 items-center justify-center py-[6%]">
              <svg viewBox={`0 0 ${GLYPH_BOX} ${GLYPH_BOX}`} className="h-auto w-[72%]" aria-hidden="true">
                <circle
                  cx={GLYPH_BOX / 2}
                  cy={GLYPH_BOX / 2}
                  r={R_MAX}
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity={0.35}
                  strokeDasharray="3 5"
                />
                <path d={spokePath()} fill="none" stroke="currentColor" strokeOpacity={0.25} strokeDasharray="2 4" />
              </svg>
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
                <span className="bg-secondary px-2 text-xs text-muted-foreground">
                  {kindredChecked ? "Shape not mapped yet" : "Checking\u2026"}
                </span>
                {kindredChecked && (
                  <span className="border border-foreground bg-secondary px-2.5 py-1.5 text-xs font-medium md:text-sm">
                    Map this book
                  </span>
                )}
              </span>
            </span>
            <span className="line-clamp-4 break-words font-serif text-[15px] italic leading-[1.05] md:text-xl">
              {activeRec.title}
            </span>
          </div>
        )
      }
      caption={<span className="line-clamp-3">{activeRec.why}</span>}
      footer={<BuyButton title={activeRec.title} author={activeRec.author} variant="ghost" size="sm" />}
    />
  );
  const shelfSubtitle = recLoading
    ? "Finding your match\u2026"
    : recSource === "personal"
      ? "Re-ranked for your take"
      : recSource === "consensus" && maxVoteCount > 0
        ? `Shaped by ${maxVoteCount} reader${maxVoteCount === 1 ? "" : "s"}`
        : "Our pick first, then the nearest books by DNA";

  return (
    <div>
      <div className="border-b border-foreground/20">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="dna-strand"
          className="mx-auto flex min-h-[64px] w-full max-w-[1280px] items-center justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-foreground/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:px-8 md:py-5"
        >
          <span className="flex min-w-0 flex-col gap-1">
            <span className="font-serif text-xl leading-tight md:text-2xl">See Book DNA</span>
            <span className="text-sm text-muted-foreground">
              {totalDrift > 0
                ? `Your take differs by ${Math.round(totalDrift)} points`
                : "Tap one to see why. Drag a bar to register your take."}
            </span>
          </span>
          <ChevronDown
            className={cn("h-5 w-5 shrink-0 transition-transform duration-200", open && "rotate-180")}
            aria-hidden="true"
          />
        </button>
      </div>
      {open && (
        <div
          id="dna-strand"
          className="mx-auto grid max-w-[1280px] gap-6 px-4 py-6 md:grid-cols-12 md:gap-10 md:px-8 md:py-10"
        >
          <div className="md:col-span-7">
            <p className="mb-3 text-sm text-muted-foreground">
              {user && cacheKey ? "Your take is saved to your reading fingerprint." : "Your changes stay on this page."}
              {maxVoteCount > 0 ? ` Shaped by ${maxVoteCount} reader${maxVoteCount === 1 ? "" : "s"}.` : ""}
            </p>
            <ul className="border-t border-foreground/15">{AXIS_IDS.map((id) => renderAxisRow(id))}</ul>

            {(totalDrift > 0 || saveState !== "idle") && (
              <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-3">
                  {totalDrift > 0 && (
                    <span>
                      Your take differs by <span className="text-foreground">{Math.round(totalDrift)} points</span>
                    </span>
                  )}
                  {user && cacheKey && saveState === "saving" && (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Saving
                    </span>
                  )}
                  {user && cacheKey && saveState === "saved" && (
                    <span className="inline-flex items-center gap-1" style={{ color: ink.inkText }}>
                      <Check className="h-3 w-3" /> Saved
                    </span>
                  )}
                </span>
                {totalDrift > 0 && (
                  <button
                    type="button"
                    onClick={() => { setPerturbations({}); setDynamicRec(null); setRecSource(null); }}
                    className="border border-foreground px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-foreground hover:bg-foreground/5"
                  >
                    Reset
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Evidence for the hovered or pinned measurement. Desktop only: on a
              phone the pinned row shows its evidence inline. */}
          <aside className="hidden md:col-span-5 md:block">
            <div className="sticky top-20 border border-foreground/20 bg-card p-6">
              <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  {pinnedAxis ? (
                    <>
                      <Pin className="h-3 w-3" style={{ color: ink.inkText }} /> Pinned
                    </>
                  ) : (
                    "Why this score"
                  )}
                </span>
                <span className="flex items-center gap-3">
                  {pinnedAxis && (
                    <button
                      type="button"
                      onClick={() => setPinnedAxis(null)}
                      className="flex items-center gap-1 transition-colors hover:text-foreground"
                    >
                      <X className="h-3 w-3" /> Unpin
                    </button>
                  )}
                  {String(focusIdx + 1).padStart(2, "0")} / 12
                </span>
              </div>
              <motion.div
                key={focusAxis}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: ease.out }}
              >
                <div
                  className="mt-4 font-serif text-[3.5rem] leading-[0.9] tabular-nums"
                  style={{ color: ink.inkText }}
                >
                  {Math.round(effectiveScore(focusAxis))}
                </div>
                <div className="mt-2 text-lg font-semibold leading-snug">
                  {focusAxisMeta.name}
                  <span className="font-normal text-muted-foreground">
                    {" "}· {effectiveScore(focusAxis) >= 50 ? focusAxisMeta.high : focusAxisMeta.low}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {focusAxisMeta.low} ↔ {focusAxisMeta.high}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{focusAxisMeta.description}</p>
                {focusAxisData?.evidence && (
                  <p
                    className="mt-4 border-l-2 pl-3 font-serif text-base leading-relaxed text-foreground/80"
                    style={{ borderColor: ink.inkText }}
                  >
                    {focusAxisData.evidence}
                  </p>
                )}
              </motion.div>
            </div>
          </aside>
        </div>
      )}

      {/* 2026-11-18: "If you loved this shape". The judged pick (Gemini, with
          reasons) leads, then the measured neighbours; every book is a poster
          in its own ink. Replaces the navy pick panel and the row list. The
          pick still points inward first: its page if we have one, "Map this
          book" if we don't, with the shop demoted to a small link. */}
      <DnaNeighbourhood
        cacheKey={cacheKey}
        bookType={analysis.bookType}
        axes={effectiveAxes}
        isPerturbed={axesArePerturbed}
        nonFiction={nf}
        limit={6}
        lead={pickPoster}
        subtitle={shelfSubtitle}
      />
    </div>
  );
}
