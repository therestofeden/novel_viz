import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, RefreshCw, Sparkles } from "lucide-react";
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
import { Reveal, ease, useReducedMotion } from "@/lib/motion";

interface BookDNAProps {
  analysis: NovelAnalysis;
  cacheKey?: string | null;
}

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
 * Each axis is a horizontal row with: name, always-visible bar (score plotted
 * as fill from a center spine), draggable square marker, numeric score.
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
  const [perturbations, setPerturbations] = useState<Partial<Record<DnaAxisId, number>>>({});
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<number | null>(null);

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

  const fetchDynamicRec = useCallback(async () => {
    // Build axes with current perturbations applied — personal perturbation
    // wins per-axis if present, else fall back to the crowd-consensus point.
    const effectiveAxes = AXIS_IDS.map((id) => {
      const base = (axesById.get(id)?.score ?? 50);
      const hasPersonal = Object.prototype.hasOwnProperty.call(perturbations, id);
      const delta = hasPersonal ? (perturbations[id] ?? 0) : (consensusPerturbations[id] ?? 0);
      return { id, score: Math.max(0, Math.min(100, base + delta)) };
    });
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
  }, [analysis, perturbations, consensusPerturbations, AXIS_IDS, axesById, cacheKey]);

  // Debounced recommendation refresh whenever DNA sliders change.
  // Works for all users (logged-in or not) as long as the server has a Gemini key.
  useEffect(() => {
    if (Object.keys(perturbations).length === 0) return;
    if (recTimer.current) window.clearTimeout(recTimer.current);
    recTimer.current = window.setTimeout(() => { fetchDynamicRec(); }, 1000);
    return () => { if (recTimer.current) window.clearTimeout(recTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perturbations]);

  const focusAxis = hoveredAxis ?? rec?.shared_axes?.[0] ?? AXIS_IDS[0];
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
        supabase.functions
          .invoke("dna-consensus", { body: { cacheKey } })
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

  return (
    <div className="grid grid-cols-12 gap-0">
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
            <div className="meta text-muted-foreground">Signature</div>
            <div className="mt-2 font-serif text-lg italic leading-tight md:text-2xl">
              {dna.signature || "—"}
            </div>
            <div className="meta mt-3 text-muted-foreground">
              Tap or hover an axis to read the evidence · drag any marker to register your take
              {user && cacheKey ? " — saved to your reading fingerprint" : ""}
              {maxVoteCount > 0 ? ` · shaped by ${maxVoteCount} reader${maxVoteCount === 1 ? "" : "s"}` : ""}
            </div>
          </div>
        </div>

        {/* Top axis ruler */}
        <div className="relative grid grid-cols-12 border-b border-foreground/30 bg-background/40 px-3 py-2 md:pl-11">
          <div className="col-span-4 meta text-muted-foreground md:col-span-3">Axis</div>
          <div className="col-span-8 md:col-span-9">
            <div className="flex justify-between meta text-muted-foreground">
              <span>0</span>
              <span className="hidden sm:inline">25</span>
              <span>50</span>
              <span className="hidden sm:inline">75</span>
              <span>100</span>
            </div>
          </div>
        </div>

        {/* The strand */}
        <div className="md:pl-8">
          {AXIS_IDS.map((id, idx) => {
            const meta = AXIS_META[id] ?? DNA_AXIS_META[id as DnaAxisId];
            const score = effectiveScore(id);
            const isHover = hoveredAxis === id;
            const isShared = sharedSet.has(id);
            const isDivergent = divergentSet.has(id);
            const isOdd = idx % 2 === 1;
            const leftPct = Math.min(50, score);
            const widthPct = Math.abs(score - 50);
            const laneColor = `hsl(var(--lane-${idx + 1}))`;

            return (
              <div
                key={id}
                onMouseEnter={() => setHoveredAxis(id)}
                onMouseLeave={() => setHoveredAxis((h) => (h === id ? null : h))}
                onClick={() => setHoveredAxis(id)}
                className={cn(
                  "group relative grid grid-cols-12 border-b border-foreground/30 transition-colors cursor-pointer",
                  isOdd && "bg-background/30",
                  isHover && "bg-foreground text-background",
                )}
              >
                {/* Axis label */}
                <div className="col-span-4 flex items-center gap-2 border-r border-foreground/30 px-3 py-2.5 md:col-span-3">
                  <span className={cn("meta w-5 shrink-0", isHover ? "text-background/60" : "text-muted-foreground")}>
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="font-sans text-xs font-semibold leading-tight md:text-sm">
                    {meta.name}
                  </span>
                  {isShared && !isHover && (
                    <span title="Shared with recommendation" className="ml-auto h-1.5 w-1.5 shrink-0 bg-primary" />
                  )}
                  {isDivergent && !isHover && (
                    <span title="Divergent" className="ml-auto h-1.5 w-1.5 shrink-0 bg-accent" />
                  )}
                </div>

                {/* Bar track */}
                <div data-row className="col-span-8 relative h-12 px-3 select-none md:col-span-9">
                  <div className="absolute inset-x-3 top-1/2 h-px -translate-y-1/2 bg-foreground/20 pointer-events-none" />
                  <div
                    className={cn(
                      "absolute top-1 bottom-1 w-px pointer-events-none",
                      isHover ? "bg-background/60" : "bg-foreground/40",
                    )}
                    style={{ left: `calc(0.75rem + ((100% - 1.5rem) * 0.5))` }}
                  />
                  {[25, 75].map((t) => (
                    <div
                      key={t}
                      className={cn(
                        "absolute top-1 bottom-1 w-px pointer-events-none",
                        isHover ? "bg-background/20" : "bg-foreground/10",
                      )}
                      style={{ left: `calc(0.75rem + ((100% - 1.5rem) * ${t / 100}))` }}
                    />
                  ))}
                  <div
                    className={cn(
                      "absolute top-1/2 h-3 -translate-y-1/2 transition-all duration-300 pointer-events-none",
                      isHover && "h-5",
                      isDivergent && "outline outline-1 outline-accent",
                    )}
                    style={{
                      left: `calc(0.75rem + ((100% - 1.5rem) * ${leftPct / 100}))`,
                      width: `calc((100% - 1.5rem) * ${widthPct / 100})`,
                      backgroundColor: laneColor,
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
                      "absolute top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 border touch-none cursor-grab transition-transform active:cursor-grabbing hover:scale-110 md:h-7 md:w-7",
                      isHover && "scale-110",
                    )}
                    style={{
                      left: `calc(0.75rem + ((100% - 1.5rem) * ${score / 100}))`,
                      backgroundColor: laneColor,
                      borderColor: laneColor,
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      const handle = e.currentTarget as HTMLDivElement;
                      const row = handle.closest("[data-row]") as HTMLDivElement | null;
                      if (!row) return;
                      const baseScore = axesById.get(id)?.score ?? 50;
                      const startX = e.clientX;
                      const startScore = effectiveScore(id);
                      const THRESHOLD = 4;
                      let engaged = false;
                      setHoveredAxis(id);
                      try { handle.setPointerCapture(e.pointerId); } catch { /* noop */ }
                      const onMove = (ev: PointerEvent) => {
                        if (!engaged && Math.abs(ev.clientX - startX) < THRESHOLD) return;
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
                  <span
                    className={cn(
                      "absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[11px] pointer-events-none",
                      isHover ? "text-background/70" : "text-muted-foreground",
                    )}
                  >
                    {String(Math.round(score)).padStart(3, " ")}
                  </span>
                </div>

                {isHover && (
                  <div className="col-span-12 col-start-1 grid grid-cols-12 border-t border-background/20 bg-foreground text-background">
                    <div className="col-span-4 md:col-span-3" />
                    <div className="col-span-8 flex items-center justify-between px-3 py-1.5 md:col-span-9">
                      <span className="meta text-background/70">← {meta.low}</span>
                      <span className="meta text-background/70">{meta.high} →</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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
                className="meta border border-foreground bg-card px-3 py-1.5 hover:bg-foreground hover:text-background"
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
            <span>{hoveredAxis ? "Evidence" : "Default focus"}</span>
            <span>{String(focusIdx + 1).padStart(2, "0")} / 12</span>
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

        <Reveal className="bg-foreground text-background">
          {(() => {
            const activeRec = dynamicRec ?? rec;
            const isDynamic = !!dynamicRec;
            return (
              <>
                <div className="flex items-center justify-between border-b border-background/30 px-5 py-3">
                  <div className="meta text-background/70 flex items-center gap-2">
                    {recLoading
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <Sparkles className="h-3 w-3" />}
                    {recLoading
                      ? "Finding your DNA match…"
                      : recSource === "consensus"
                        ? `Reader consensus · ${maxVoteCount} adjustment${maxVoteCount === 1 ? "" : "s"}`
                        : isDynamic
                          ? "Your DNA, your match"
                          : "Canon match · drag sliders to personalise"}
                  </div>
                  <div className="flex items-center gap-3">
                    {isDynamic && !recLoading && (
                      <button
                        onClick={fetchDynamicRec}
                        title="Refresh recommendation"
                        className="meta text-background/50 hover:text-background transition-colors"
                      >
                        <RefreshCw className="h-3 w-3" />
                      </button>
                    )}
                    <div className="display-num text-2xl">
                      {recLoading ? "—" : Math.round(activeRec.similarity)}
                      <span className="meta ml-1 text-background/60">% MATCH</span>
                    </div>
                  </div>
                </div>

                {recLoading ? (
                  <div className="flex items-center justify-center px-5 py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-background/40" />
                  </div>
                ) : (
                  <motion.div
                    key={activeRec.title}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: ease.out }}
                    className="px-5 py-5"
                  >
                    <div className="meta text-background/60">You'll likely also love</div>
                    <div className="mt-2 font-serif text-2xl italic leading-tight md:text-3xl">{activeRec.title}</div>
                    <div className="meta mt-2 text-background/70">By {activeRec.author}</div>
                    <p className="mt-4 font-serif text-sm leading-relaxed text-background/90">{activeRec.why}</p>

                    <div className="mt-5 grid gap-1.5">
                      {activeRec.shared_axes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          <span className="meta text-background/60">Shared</span>
                          {activeRec.shared_axes.map((id) => (
                            <button
                              key={id}
                              type="button"
                              onMouseEnter={() => setHoveredAxis(id as DnaAxisId)}
                              onMouseLeave={() => setHoveredAxis(null)}
                              onClick={() => setHoveredAxis(id as DnaAxisId)}
                              className="meta border border-primary bg-primary px-1.5 py-0.5 text-primary-foreground transition-transform hover:-translate-y-[1px]"
                            >
                              {DNA_AXIS_META[id as DnaAxisId]?.name ?? id}
                            </button>
                          ))}
                        </div>
                      )}
                      {activeRec.divergent_axes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          <span className="meta text-background/60">Differs</span>
                          {activeRec.divergent_axes.map((id) => (
                            <button
                              key={id}
                              type="button"
                              onMouseEnter={() => setHoveredAxis(id as DnaAxisId)}
                              onMouseLeave={() => setHoveredAxis(null)}
                              onClick={() => setHoveredAxis(id as DnaAxisId)}
                              className="meta border border-accent bg-accent px-1.5 py-0.5 text-accent-foreground transition-transform hover:-translate-y-[1px]"
                            >
                              {DNA_AXIS_META[id as DnaAxisId]?.name ?? id}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-5">
                      <BuyButton
                        title={activeRec.title}
                        author={activeRec.author}
                        size="md"
                        className="border-background bg-background text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary"
                      />
                    </div>
                  </motion.div>
                )}
              </>
            );
          })()}
        </Reveal>
      </div>
    </div>
  );
}
