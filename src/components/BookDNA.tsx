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
import { OPEN_DNA_EVENT, glyphSource } from "@/lib/dna-glyph";
import { ease, useReducedMotion } from "@/lib/motion";
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

/* -------------------------------------------------------------
 * Kinetic spine — a thin decorative double-helix that animates
 * in the left gutter. Pure ornament; the data lives in the rows.
 * ------------------------------------------------------------*/
function KineticSpine({ activeIdx }: { activeIdx: number }) {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setPhase((p) => p + dt * 0.5);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  const VB_W = 32;
  const VB_H = 600;
  const AMP = 11;
  const CENTER = VB_W / 2;
  const TURNS = 3;
  const SAMPLES = 60;
  const path = (offset: number) => {
    let d = "";
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      const y = t * VB_H;
      const x = CENTER + AMP * Math.sin(t * Math.PI * 2 * TURNS + phase + offset);
      d += i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    return d;
  };
  const activeT = (activeIdx + 0.5) / 12;
  const activeY = activeT * VB_H;
  const xA = CENTER + AMP * Math.sin(activeT * Math.PI * 2 * TURNS + phase);
  const xB = CENTER + AMP * Math.sin(activeT * Math.PI * 2 * TURNS + phase + Math.PI);

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      className="absolute inset-y-0 left-0 hidden h-full w-8 md:block"
      aria-hidden
    >
      <path d={path(0)} fill="none" stroke="hsl(var(--foreground) / 0.35)" strokeWidth={0.8} />
      <path d={path(Math.PI)} fill="none" stroke="hsl(var(--primary))" strokeWidth={0.8} />
      <line
        x1={Math.min(xA, xB)}
        y1={activeY}
        x2={Math.max(xA, xB)}
        y2={activeY}
        stroke="hsl(var(--foreground))"
        strokeWidth={1.2}
        style={{ transition: "y1 250ms, y2 250ms" }}
      />
    </svg>
  );
}

/**
 * Book DNA — readable strand of 12 axes.
 *
 * Each axis is a horizontal row with: name, always-visible bar (solid
 * --primary fill, width alone encodes the 0-100 score), draggable square
 * marker, numeric score.
 * Drag any marker to register your take; absolute scores autosave per book.
 * A decorative kinetic helix runs in the left gutter as a brand motif.
 */
export function BookDNA({ analysis, cacheKey }: BookDNAProps) {
  const { user } = useAuth();
  const dna = analysis.dna;
  const rec = analysis.recommendation;
  const nf = isNonFiction(analysis);

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

  const sharedSet = useMemo(() => new Set(rec?.shared_axes ?? []), [rec]);
  const divergentSet = useMemo(() => new Set(rec?.divergent_axes ?? []), [rec]);

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

  // Renders one axis, always at the same size — full track+fill bar and
  // draggable marker for every one of the twelve. Hover (or tap on touch)
  // sets hoveredAxis, click sets pinnedAxis; both already drove the
  // evidence panel on the right before this fix, so the only change here
  // is dropping the old "lg vs sm" size branch entirely.
  const renderAxisRow = (id: DnaAxisId) => {
    const meta = AXIS_META[id] ?? DNA_AXIS_META[id as DnaAxisId];
    const score = effectiveScore(id);
    const isPinned = pinnedAxis === id;
    const isHover = activeAxis === id;
    const isShared = sharedSet.has(id);
    const isDivergent = divergentSet.has(id);
    const idx = AXIS_IDS.indexOf(id);
    const fillColor = "hsl(var(--primary))";

    return (
      <div
        key={id}
        onMouseEnter={() => setHoveredAxis(id)}
        onMouseLeave={() => setHoveredAxis((h) => (h === id ? null : h))}
        onClick={() => setPinnedAxis((p) => (p === id ? null : id))}
        className={cn(
          "cursor-pointer border-b border-foreground/30 px-4 py-3 transition-colors md:px-8",
          isHover && "bg-[hsl(var(--ink-blue))] text-background",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <span
            className={cn(
              "flex min-w-0 items-center gap-1.5 font-sans font-semibold text-sm md:text-base",
              isHover && "text-background",
            )}
          >
            <span className={cn("meta shrink-0", isHover ? "text-background/60" : "text-muted-foreground")}>
              {String(idx + 1).padStart(2, "0")}
            </span>
            <span className="truncate">{meta.name}</span>
            {isPinned && (
              <Pin
                className={cn("h-3 w-3 shrink-0", isHover ? "text-background" : "text-primary")}
                aria-label="Pinned"
              />
            )}
            {isShared && !isHover && (
              <span title="Shared with recommendation" className="h-1.5 w-1.5 shrink-0 bg-primary" />
            )}
            {isDivergent && !isHover && (
              <span title="Divergent" className="h-1.5 w-1.5 shrink-0 bg-accent" />
            )}
          </span>
          <span
            className={cn(
              "shrink-0 font-mono text-sm font-bold",
              isHover && "text-background/80",
            )}
          >
            {Math.round(score)}
          </span>
        </div>

        <div
          data-row
          className={cn(
            "relative mt-1.5 h-4 select-none",
            isHover ? "bg-background/15" : "bg-foreground/10",
          )}
        >
          <div
            className={cn("absolute inset-y-0 left-0", isDivergent && "outline outline-1 outline-accent")}
            style={{
              width: `calc(0.75rem + ((100% - 1.5rem) * ${score / 100}))`,
              backgroundColor: fillColor,
            }}
          />
          <div
              aria-label={`${meta.name}: ${Math.round(score)}`}
              role="slider"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(score)}
              tabIndex={0}
              className={cn(
                "absolute top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 border touch-none cursor-grab transition-transform active:scale-110 active:cursor-grabbing hover:scale-110",
                isHover && "scale-110",
              )}
              style={{
                left: `calc(0.75rem + ((100% - 1.5rem) * ${score / 100}))`,
                backgroundColor: fillColor,
                borderColor: "hsl(var(--background))",
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                const handle = e.currentTarget as HTMLDivElement;
                const row = handle.closest("[data-row]") as HTMLDivElement | null;
                if (!row) return;
                const baseScore = axesById.get(id)?.score ?? 50;
                const startX = e.clientX;
                const startScore = effectiveScore(id);
                // Mouse input is precise; touch/pen input has natural thumb/finger
                // jitter, so use a larger engagement threshold for non-mouse pointers
                // to avoid premature/twitchy engagement on touch devices.
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
                  setPerturbations((p) => ({ ...p, [id]: next - baseScore }));
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
                const baseScore = axesById.get(id)?.score ?? 50;
                const cur = effectiveScore(id);
                if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                  e.preventDefault();
                  setPerturbations((p) => ({ ...p, [id]: Math.max(0, cur - step) - baseScore }));
                } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                  e.preventDefault();
                  setPerturbations((p) => ({ ...p, [id]: Math.min(100, cur + step) - baseScore }));
                }
              }}
            />
        </div>

        {isHover && (
          <div className="mt-2 flex items-center justify-between border-t border-background/20 pt-1.5">
            <span className="meta text-background/70">← {meta.low}</span>
            <span className="meta text-background/70">{meta.high} →</span>
          </div>
        )}
      </div>
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
          <div className="flex h-full w-full flex-col justify-between bg-secondary p-[9%] text-foreground">
            <span className="font-mono text-[11px] leading-none tracking-tight">{pickLabel}</span>
            <span className="self-center border border-foreground px-2.5 py-1.5 text-xs font-medium md:text-sm">
              {kindredChecked ? "Map this book" : "Checking\u2026"}
            </span>
            <span className="font-serif text-[15px] italic leading-[1.05] md:text-xl">{activeRec.title}</span>
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
            <span className="font-serif text-xl leading-tight md:text-2xl">All twelve measurements</span>
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
      <div id="dna-strand" className="mx-auto grid max-w-[1280px] grid-cols-12 gap-0 px-4 py-6 md:px-8 md:py-10">
      {/* ============== LEFT — THE STRAND ============== */}
      <div className="relative col-span-12 ink-border md:col-span-7">
        <KineticSpine activeIdx={focusIdx} />

        {/* Strand header */}
        <div className="grid grid-cols-12 border-b border-foreground md:pl-8">
          <div className="col-span-3 border-r border-foreground p-4">
            <div className="meta text-muted-foreground">Specimen</div>
            <div className="display-num mt-2 text-3xl">{AXIS_IDS.length}</div>
            <div className="meta mt-1 text-muted-foreground">Axes</div>
          </div>
          <div className="col-span-9 p-4">
            <div className="meta text-muted-foreground">How to read this</div>
            <div className="mt-2 font-serif text-base leading-snug md:text-lg">
              Click an axis to pin its evidence.{" "}
              <span className="italic">Drag any marker to register your take</span> — the
              neighbourhood below re-ranks as you move.
            </div>
            <div className="meta mt-3 text-muted-foreground">
              {user && cacheKey ? "Saved to your reading fingerprint" : "Your changes stay on this page"}
              {maxVoteCount > 0 ? ` · shaped by ${maxVoteCount} reader${maxVoteCount === 1 ? "" : "s"}` : ""}
            </div>
          </div>
        </div>

        {/* The strand — all twelve axes, one bar size, canonical order.
            Hover or tap any row for its evidence in the panel to the right. */}
        <div className="md:pl-8">
          {AXIS_IDS.map((id) => renderAxisRow(id))}
        </div>

        {(totalDrift > 0 || saveState !== "idle") && (
          <div className="flex items-center justify-between border-t border-foreground bg-background px-4 py-3 md:pl-11">
            <div className="meta flex items-center gap-3 text-muted-foreground">
              {totalDrift > 0 && (
                <span>Your take diverges by{" "}<span className="text-foreground">{Math.round(totalDrift)} units</span></span>
              )}
              {user && cacheKey && saveState === "saving" && (
                <span className="inline-flex items-center gap-1 text-foreground/60">
                  <Loader2 className="h-3 w-3 animate-spin" /> Saving
                </span>
              )}
              {user && cacheKey && saveState === "saved" && (
                <span className="inline-flex items-center gap-1 text-primary">
                  <Check className="h-3 w-3" /> Saved
                </span>
              )}
            </div>
            {totalDrift > 0 && (
              <button
                onClick={() => { setPerturbations({}); setDynamicRec(null); setRecSource(null); }}
                className="meta border border-foreground bg-card px-3 py-1.5 hover:bg-foreground/10"
              >
                ↺ Reset
              </button>
            )}
          </div>
        )}
      </div>

      {/* ============== RIGHT — EVIDENCE + RECOMMENDATION ============== */}
      <div className="col-span-12 ink-border mt-4 md:col-span-5 md:ml-[-1px] md:mt-0">
        <div className="border-b border-foreground p-5">
          <div className="meta flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1.5">
              {pinnedAxis ? (
                <>
                  <Pin className="h-3 w-3 text-primary" /> Pinned
                </>
              ) : hoveredAxis ? (
                "Evidence"
              ) : (
                "Default focus"
              )}
            </span>
            <span className="flex items-center gap-3">
              {pinnedAxis && (
                <button
                  type="button"
                  onClick={() => setPinnedAxis(null)}
                  className="flex items-center gap-1 text-foreground/60 transition-colors hover:text-foreground"
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
            <div className="mt-2 font-sans text-xl font-bold leading-tight md:text-2xl">
              {focusAxisMeta.name}
            </div>
            <div className="meta mt-2 flex items-center justify-between text-muted-foreground">
              <span>{focusAxisMeta.low}</span>
              <span className="display-num text-foreground text-lg">
                {Math.round(effectiveScore(focusAxis))}
              </span>
              <span>{focusAxisMeta.high}</span>
            </div>
            <p className="mt-3 font-serif text-sm leading-relaxed text-muted-foreground">
              {focusAxisMeta.description}
            </p>
            {focusAxisData?.evidence && (
              <blockquote className="mt-4 border-l-2 border-foreground pl-3 font-serif text-sm italic leading-relaxed">
                {focusAxisData.evidence}
              </blockquote>
            )}
          </motion.div>
        </div>
      </div>
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
