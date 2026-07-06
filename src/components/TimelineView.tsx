import { useEffect, useMemo, useRef, useState } from "react";
import { Character, FictionAnalysis, PlotEvent, laneColor } from "@/lib/novel-types";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  X,
  BookMarked,
  ShieldAlert,
  GitBranch,
  Users,
} from "lucide-react";

interface Props {
  analysis: FictionAnalysis;
  /** 0–100 spoiler frontier. Events past this are masked. */
  progress: number;
  selectedEventId: string | null;
  onSelectEvent: (event: PlotEvent | null) => void;
  /** When a character is selected from the network, filter events to those featuring them. */
  selectedCharacterId: string | null;
  onSelectCharacter: (id: string | null) => void;
}

/* ---- Layout constants ---- */
const LEFT_GUTTER = 180;        // reserved area for lane label
const RIGHT_PAD = 24;
const TOP_PAD = 64;             // ruler + headroom
const BOTTOM_PAD = 56;
const LANE_HEIGHT = 110;        // generous so stacks fit
const EVENT_R = 6;
const STACK_STEP = 18;          // vertical offset per stacked event
const MIN_X_GAP = 26;           // px below which two events collide
const VIEW_W_DESKTOP = 1180;
const VIEW_W_MOBILE = 1600;     // wider canvas on mobile -> horizontal scroll

export const TimelineView = ({
  analysis,
  progress,
  selectedEventId,
  onSelectEvent,
  selectedCharacterId,
  onSelectCharacter,
}: Props) => {
  const [hovered, setHovered] = useState<string | null>(null);
  const [activeLane, setActiveLane] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(false);
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, [analysis]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const VIEW_W = isMobile ? VIEW_W_MOBILE : VIEW_W_DESKTOP;
  const PLOT_W = VIEW_W - LEFT_GUTTER - RIGHT_PAD;

  const laneIndex = useMemo(() => {
    const map = new Map<string, number>();
    analysis.lanes.forEach((l, i) => map.set(l.id, i));
    return map;
  }, [analysis.lanes]);

  const charById = useMemo(() => {
    const m = new Map<string, Character>();
    analysis.characters.forEach((c) => m.set(c.id, c));
    return m;
  }, [analysis.characters]);

  const sortedEvents = useMemo(
    () => [...analysis.events].sort((a, b) => a.position - b.position),
    [analysis.events],
  );

  const totalH = TOP_PAD + analysis.lanes.length * LANE_HEIGHT + BOTTOM_PAD;

  const isSpoiler = (pos: number) => pos > progress + 0.1;

  const visibleEventIds = useMemo(() => {
    const s = new Set<string>();
    analysis.events.forEach((e) => {
      if (isSpoiler(e.position)) return;
      if (selectedCharacterId && !e.characterIds.includes(selectedCharacterId)) return;
      s.add(e.id);
    });
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis.events, progress, selectedCharacterId]);

  const xFor = (pos: number) =>
    LEFT_GUTTER + (Math.max(0, Math.min(100, pos)) / 100) * PLOT_W;

  const laneCenterY = (laneId: string) => {
    const idx = laneIndex.get(laneId) ?? 0;
    return TOP_PAD + idx * LANE_HEIGHT + LANE_HEIGHT / 2;
  };

  /**
   * For each event compute (x, y) with collision stacking within its lane.
   * Sort by position; if next event's x is within MIN_X_GAP of any unresolved
   * neighbor, push to next stack row (alternating up/down from lane center).
   */
  const eventLayout = useMemo(() => {
    type P = { e: PlotEvent; x: number; y: number; row: number };
    const out = new Map<string, P>();
    analysis.lanes.forEach((lane) => {
      const center = laneCenterY(lane.id);
      const inLane = sortedEvents.filter((e) => e.laneId === lane.id);
      // For each event, find smallest non-negative row not used by a neighbor within MIN_X_GAP
      const placed: { x: number; row: number }[] = [];
      inLane.forEach((e) => {
        const x = xFor(e.position);
        const used = new Set<number>();
        for (let i = placed.length - 1; i >= 0; i--) {
          if (Math.abs(placed[i].x - x) < MIN_X_GAP) used.add(placed[i].row);
          else break; // sorted by x ascending — earlier ones will be even further
        }
        let row = 0;
        // sequence 0, -1, 1, -2, 2, ...
        for (let k = 0; k < 20; k++) {
          const candidates = k === 0 ? [0] : [-k, k];
          let found: number | null = null;
          for (const c of candidates) {
            if (!used.has(c)) {
              found = c;
              break;
            }
          }
          if (found !== null) {
            row = found;
            break;
          }
        }
        placed.push({ x, row });
        out.set(e.id, { e, x, y: center + row * STACK_STEP, row });
      });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedEvents, analysis.lanes, isMobile]);

  const selectedEvent = useMemo(
    () => sortedEvents.find((e) => e.id === selectedEventId) || null,
    [sortedEvents, selectedEventId],
  );

  // Sparkline density per 5% bucket
  const density = useMemo(() => {
    const buckets = new Array(20).fill(0);
    sortedEvents.forEach((e) => {
      const idx = Math.min(19, Math.max(0, Math.floor(e.position / 5)));
      buckets[idx] += 1;
    });
    const max = Math.max(1, ...buckets);
    return buckets.map((v) => v / max);
  }, [sortedEvents]);

  const handleSelect = (e: PlotEvent) => {
    if (isSpoiler(e.position)) return;
    onSelectEvent(selectedEventId === e.id ? null : e);
    // keep selection in view on mobile
    if (isMobile && scrollRef.current) {
      const lay = eventLayout.get(e.id);
      if (lay) {
        const ratio = lay.x / VIEW_W;
        const sw = scrollRef.current.scrollWidth;
        scrollRef.current.scrollTo({
          left: Math.max(0, ratio * sw - scrollRef.current.clientWidth / 2),
          behavior: "smooth",
        });
      }
    }
  };

  const stepEvent = (dir: 1 | -1) => {
    const navigable = sortedEvents.filter((e) => visibleEventIds.has(e.id));
    if (navigable.length === 0) return;
    const idx = selectedEvent ? navigable.findIndex((e) => e.id === selectedEvent.id) : -1;
    const nextIdx =
      idx === -1
        ? dir === 1
          ? 0
          : navigable.length - 1
        : (idx + dir + navigable.length) % navigable.length;
    handleSelect(navigable[nextIdx]);
  };

  const selectedCharName = selectedCharacterId
    ? charById.get(selectedCharacterId)?.name
    : null;

  // Guard: if the analysis has no lanes or events, the book is too new/sparse for a
  // full timeline. Show a friendly empty state rather than a blank/broken canvas.
  if (analysis.lanes.length === 0 || analysis.events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-20 text-center">
        <p className="font-serif text-base italic text-foreground/70">
          The AI returned an incomplete analysis for{" "}
          <span className="not-italic font-semibold">{analysis.title}</span>.
        </p>
        <p className="text-xs text-muted-foreground max-w-sm">
          Try searching again with the author's name (e.g. "Pale Fire by Nabokov"), or add your Gemini API key for a deeper attempt.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative space-y-4">
      {/* ===== Top bar ===== */}
      <div className="flex flex-wrap items-center justify-between gap-3 ink-border-b pb-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="meta inline-flex items-center gap-1.5 text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            {visibleEventIds.size}/{analysis.events.length} Events
          </span>
          <span className="meta inline-flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-3 w-3 text-accent" />
            {analysis.characters.length} Characters
          </span>
          <span className="inline-flex items-center gap-1.5 font-serif text-sm italic">
            <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
            {analysis.lanes.length === 1
              ? "Single narrative thread"
              : `${analysis.lanes.length} narrative lanes`}
          </span>
        </div>

        <div className="flex items-center">
          <button
            onClick={() => stepEvent(-1)}
            className="ink-border border-r-0 bg-card px-2.5 py-1.5 text-foreground hover:bg-foreground hover:text-background"
            aria-label="Previous event"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => stepEvent(1)}
            className="ink-border bg-card px-2.5 py-1.5 text-foreground hover:bg-foreground hover:text-background"
            aria-label="Next event"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {selectedCharName && (
        <div className="meta inline-flex items-center gap-2 ink-border bg-accent px-3 py-1.5 text-accent-foreground">
          Filtering by {selectedCharName}
          <button
            onClick={() => onSelectCharacter(null)}
            className="hover:opacity-70"
            aria-label="Clear character filter"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* ===== Lane chips ===== */}
      <div className="flex flex-wrap gap-0">
        <button
          onClick={() => setActiveLane(null)}
          className={cn(
            "meta px-3 py-1.5 ink-border border-r-0 transition-colors",
            !activeLane
              ? "bg-foreground text-background"
              : "bg-card text-foreground hover:bg-foreground hover:text-background",
          )}
        >
          All Lanes
        </button>
        {analysis.lanes.map((lane, i) => {
          const color = laneColor(i);
          const active = activeLane === lane.id;
          const isLast = i === analysis.lanes.length - 1;
          return (
            <button
              key={lane.id}
              onClick={() => setActiveLane(active ? null : lane.id)}
              className={cn(
                "meta flex items-center gap-2 px-3 py-1.5 ink-border transition-colors",
                !isLast && "border-r-0",
                active
                  ? "bg-foreground text-background"
                  : "bg-card text-foreground hover:bg-foreground hover:text-background",
              )}
            >
              <span className="h-2 w-2" style={{ backgroundColor: color }} />
              <span className="font-serif text-xs normal-case italic tracking-normal">
                {lane.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* ===== Canvas ===== */}
      <div className="ink-border bg-card">
        {/* Header strip */}
        <div className="flex items-center justify-between ink-border-b bg-background px-4 py-2">
          <span className="meta text-muted-foreground">Opening</span>
          <span className="font-serif text-xs italic">
            {progress < 100 ? `Reading at ${Math.round(progress)}%` : "Full visualization"}
          </span>
          <span className="meta text-muted-foreground">Resolution</span>
        </div>

        {/* Mobile hint */}
        {isMobile && (
          <div className="meta border-b border-foreground/20 bg-muted px-4 py-1.5 text-center text-muted-foreground">
            ← Scroll horizontally →
          </div>
        )}

        {/* Scrollable plot */}
        <div
          ref={scrollRef}
          className="relative overflow-x-auto"
          style={{
            backgroundImage:
              "radial-gradient(hsl(var(--foreground) / 0.05) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        >
          <svg
            viewBox={`0 0 ${VIEW_W} ${totalH}`}
            width={isMobile ? VIEW_W : "100%"}
            style={{ height: isMobile ? totalH * 0.65 : totalH * 0.78, display: "block" }}
            preserveAspectRatio="xMinYMin meet"
          >
            <defs>
              <pattern
                id="spoiler-hatch"
                patternUnits="userSpaceOnUse"
                width="8"
                height="8"
                patternTransform="rotate(45)"
              >
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="8"
                  stroke="hsl(var(--foreground))"
                  strokeWidth="1"
                  strokeOpacity="0.18"
                />
              </pattern>
              <filter id="evt-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Gutter divider */}
            <line
              x1={LEFT_GUTTER}
              x2={LEFT_GUTTER}
              y1={0}
              y2={totalH}
              stroke="hsl(var(--foreground))"
              strokeWidth="1"
            />

            {/* Chapter ruler — only across plot area */}
            {Array.from({ length: 21 }).map((_, i) => {
              const p = i * 5;
              const major = i % 5 === 0;
              const x = xFor(p);
              return (
                <g key={p}>
                  <line
                    x1={x}
                    x2={x}
                    y1={TOP_PAD - 16}
                    y2={TOP_PAD - (major ? 26 : 20)}
                    stroke="hsl(var(--foreground))"
                    strokeOpacity={major ? 0.7 : 0.25}
                    strokeWidth="1"
                  />
                  {major && (
                    <text
                      x={x}
                      y={TOP_PAD - 32}
                      textAnchor="middle"
                      fontSize="9"
                      fontFamily="JetBrains Mono, monospace"
                      fill="hsl(var(--muted-foreground))"
                      style={{ letterSpacing: "0.2em" }}
                    >
                      {p}%
                    </text>
                  )}
                </g>
              );
            })}

            {/* Quarter grid */}
            {[25, 50, 75].map((p) => (
              <line
                key={p}
                x1={xFor(p)}
                x2={xFor(p)}
                y1={TOP_PAD - 8}
                y2={totalH - BOTTOM_PAD + 8}
                stroke="hsl(var(--foreground))"
                strokeOpacity="0.08"
                strokeWidth="1"
              />
            ))}

            {/* Lane bands + horizontal rules */}
            {analysis.lanes.map((lane, i) => {
              const color = laneColor(i);
              const yTop = TOP_PAD + i * LANE_HEIGHT;
              const cy = yTop + LANE_HEIGHT / 2;
              const dimmed = activeLane && activeLane !== lane.id;
              return (
                <g
                  key={`lane-${lane.id}`}
                  style={{ opacity: dimmed ? 0.18 : 1, transition: "opacity 0.3s" }}
                >
                  {/* alternating band fill */}
                  {i % 2 === 1 && (
                    <rect
                      x={LEFT_GUTTER}
                      y={yTop}
                      width={PLOT_W + RIGHT_PAD}
                      height={LANE_HEIGHT}
                      fill="hsl(var(--foreground))"
                      fillOpacity="0.025"
                    />
                  )}
                  {/* lane top divider */}
                  <line
                    x1={0}
                    x2={VIEW_W}
                    y1={yTop}
                    y2={yTop}
                    stroke="hsl(var(--foreground))"
                    strokeOpacity="0.12"
                    strokeWidth="1"
                  />
                  {/* center line — straight, no waves */}
                  <line
                    x1={LEFT_GUTTER}
                    x2={LEFT_GUTTER + PLOT_W}
                    y1={cy}
                    y2={cy}
                    stroke={color}
                    strokeOpacity="0.35"
                    strokeWidth="1.5"
                    style={{
                      strokeDasharray: PLOT_W,
                      strokeDashoffset: mounted ? 0 : PLOT_W,
                      transition: `stroke-dashoffset 1.1s cubic-bezier(0.4,0,0.2,1) ${i * 0.12}s`,
                    }}
                  />
                  {/* lane label inside the gutter */}
                  <g>
                    <rect
                      x={8}
                      y={cy - 14}
                      width={3}
                      height={28}
                      fill={color}
                    />
                    <text
                      x={20}
                      y={cy - 2}
                      fontSize="11"
                      fontFamily="JetBrains Mono, monospace"
                      fill="hsl(var(--foreground))"
                      style={{
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        fontWeight: 600,
                      }}
                    >
                      {lane.name.length > 18 ? lane.name.slice(0, 17) + "…" : lane.name}
                    </text>
                    <text
                      x={20}
                      y={cy + 14}
                      fontSize="10"
                      fontFamily="Fraunces, Georgia, serif"
                      fontStyle="italic"
                      fill="hsl(var(--muted-foreground))"
                    >
                      {lane.description.length > 24
                        ? lane.description.slice(0, 23) + "…"
                        : lane.description}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* bottom rule of last lane */}
            <line
              x1={0}
              x2={VIEW_W}
              y1={TOP_PAD + analysis.lanes.length * LANE_HEIGHT}
              y2={TOP_PAD + analysis.lanes.length * LANE_HEIGHT}
              stroke="hsl(var(--foreground))"
              strokeOpacity="0.12"
              strokeWidth="1"
            />

            {/* Spoiler veil over plot area */}
            {progress < 100 && (
              <g style={{ pointerEvents: "none" }}>
                <rect
                  x={xFor(progress)}
                  y={TOP_PAD - 10}
                  width={LEFT_GUTTER + PLOT_W - xFor(progress) + RIGHT_PAD}
                  height={analysis.lanes.length * LANE_HEIGHT + 20}
                  fill="hsl(var(--card))"
                  opacity="0.82"
                />
                <rect
                  x={xFor(progress)}
                  y={TOP_PAD - 10}
                  width={LEFT_GUTTER + PLOT_W - xFor(progress) + RIGHT_PAD}
                  height={analysis.lanes.length * LANE_HEIGHT + 20}
                  fill="url(#spoiler-hatch)"
                />
                <line
                  x1={xFor(progress)}
                  x2={xFor(progress)}
                  y1={TOP_PAD - 14}
                  y2={totalH - BOTTOM_PAD + 14}
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                />
                <rect
                  x={xFor(progress) - 1}
                  y={TOP_PAD - 14}
                  width={2}
                  height={6}
                  fill="hsl(var(--primary))"
                />
                <text
                  x={Math.min(VIEW_W - 100, xFor(progress) + 8)}
                  y={TOP_PAD - 38}
                  fontSize="9"
                  fontFamily="JetBrains Mono, monospace"
                  fill="hsl(var(--primary))"
                  style={{ letterSpacing: "0.22em", textTransform: "uppercase" }}
                >
                  Spoiler shield · {Math.round(progress)}%
                </text>
              </g>
            )}

            {/* Events with stacking */}
            {sortedEvents.map((e, i) => {
              const lay = eventLayout.get(e.id);
              if (!lay) return null;
              const idx = laneIndex.get(e.laneId) ?? 0;
              const color = laneColor(idx);
              const cx = lay.x;
              const cy = lay.y;
              const laneCy = laneCenterY(e.laneId);
              const isHover = hovered === e.id;
              const isSel = selectedEventId === e.id;
              const dimmed = activeLane && activeLane !== e.laneId;
              const spoiled = isSpoiler(e.position);
              const filtered =
                selectedCharacterId && !e.characterIds.includes(selectedCharacterId);
              const featuresSelectedChar =
                selectedCharacterId && e.characterIds.includes(selectedCharacterId);
              const r = isSel ? EVENT_R + 4 : isHover ? EVENT_R + 2 : featuresSelectedChar ? EVENT_R + 1 : EVENT_R;
              const op = spoiled ? 0 : filtered ? 0.2 : dimmed ? 0.22 : 1;

              return (
                <g
                  key={e.id}
                  style={{
                    opacity: mounted ? op : 0,
                    transition: `opacity 0.4s ${0.3 + i * 0.025}s`,
                    cursor: spoiled ? "not-allowed" : "pointer",
                  }}
                  onMouseEnter={() => !spoiled && setHovered(e.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => {
                    if (!spoiled) {
                      // eslint-disable-next-line no-console
                      console.log({ ui: "timeline_event", event: "tap_shown_info", eventId: e.id });
                    }
                    handleSelect(e);
                  }}
                >
                  {/* tether from stacked event back to lane center line */}
                  {lay.row !== 0 && (
                    <line
                      x1={cx}
                      x2={cx}
                      y1={cy}
                      y2={laneCy}
                      stroke={color}
                      strokeOpacity={isSel || isHover ? 0.6 : 0.3}
                      strokeWidth="1"
                    />
                  )}
                  {(isSel || isHover) && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={r + 8}
                      fill={color}
                      fillOpacity="0.18"
                      style={{ filter: "url(#evt-glow)" }}
                    />
                  )}
                  {/* hit area — sized to a ~40px touch target (r=20) while keeping the
                      visible dot small; capped relative to stacking/x-gap spacing so
                      adjacent hit circles don't overlap excessively */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={Math.max(20, r + 6)}
                    fill="transparent"
                    pointerEvents="all"
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill={isSel ? color : "hsl(var(--card))"}
                    stroke={color}
                    strokeWidth={isSel ? 2 : 2}
                    strokeDasharray={e.confidence === "low" ? "2 2" : undefined}
                  />
                  {isSel && (
                    <text
                      x={cx}
                      y={cy - r - 8}
                      textAnchor="middle"
                      fontSize="9"
                      fontFamily="JetBrains Mono, monospace"
                      fill="hsl(var(--foreground))"
                      style={{ letterSpacing: "0.18em", textTransform: "uppercase" }}
                    >
                      {e.chapterRef ? e.chapterRef : `${Math.round(e.position)}%`}
                    </text>
                  )}
                  {/* always-on label for selected event title */}
                  {isSel && (
                    <text
                      x={cx}
                      y={cy + r + 14}
                      textAnchor="middle"
                      fontSize="11"
                      fontFamily="Fraunces, Georgia, serif"
                      fontStyle="italic"
                      fill="hsl(var(--foreground))"
                    >
                      {e.title.length > 28 ? e.title.slice(0, 27) + "…" : e.title}
                    </text>
                  )}
                  {/* hover-only mini label */}
                  {isHover && !isSel && (
                    <g>
                      <rect
                        x={cx - 80}
                        y={cy - r - 26}
                        width={160}
                        height={18}
                        fill="hsl(var(--popover))"
                        stroke="hsl(var(--foreground))"
                        strokeWidth="1"
                      />
                      <text
                        x={cx}
                        y={cy - r - 13}
                        textAnchor="middle"
                        fontSize="10"
                        fontFamily="Space Grotesk, sans-serif"
                        fill="hsl(var(--popover-foreground))"
                      >
                        {e.title.length > 24 ? e.title.slice(0, 23) + "…" : e.title}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Density sparkline footer */}
        <div className="ink-border-t bg-background px-4 py-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="meta text-muted-foreground">Event Density</span>
            <span className="font-serif text-xs italic text-muted-foreground">
              where the story crowds
            </span>
          </div>
          <svg viewBox={`0 0 ${VIEW_W_DESKTOP} 28`} className="block w-full" style={{ height: 28 }}>
            {density.map((v, i) => {
              const w = VIEW_W_DESKTOP / density.length;
              const x = i * w;
              const h = 4 + v * 22;
              const p = (i + 0.5) * 5;
              const past = p <= progress;
              return (
                <rect
                  key={i}
                  x={x + 1}
                  y={28 - h}
                  width={w - 2}
                  height={h}
                  fill={past ? "hsl(var(--primary))" : "hsl(var(--foreground))"}
                  fillOpacity={past ? 0.85 : 0.18}
                />
              );
            })}
            {progress < 100 && (
              <line
                x1={(progress / 100) * VIEW_W_DESKTOP}
                x2={(progress / 100) * VIEW_W_DESKTOP}
                y1={0}
                y2={28}
                stroke="hsl(var(--primary))"
                strokeWidth="1.5"
              />
            )}
          </svg>
          <div className="mt-1 flex justify-between">
            <span className="meta text-muted-foreground">Opening</span>
            <span className="meta text-muted-foreground">Rising</span>
            <span className="meta text-muted-foreground">Climax</span>
            <span className="meta text-muted-foreground">Resolution</span>
          </div>
        </div>
      </div>

      {/* ===== Selected event card ===== */}
      {selectedEvent && (
        <div
          className="relative ink-border bg-card p-5"
          style={{
            borderLeftWidth: 6,
            borderLeftColor: laneColor(laneIndex.get(selectedEvent.laneId) ?? 0),
          }}
        >
          <button
            onClick={() => onSelectEvent(null)}
            className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="meta flex flex-wrap items-center gap-2 text-muted-foreground">
            <span
              className="h-2 w-2"
              style={{
                backgroundColor: laneColor(laneIndex.get(selectedEvent.laneId) ?? 0),
              }}
            />
            <span>{analysis.lanes.find((l) => l.id === selectedEvent.laneId)?.name}</span>
            <span>·</span>
            <span>{Math.round(selectedEvent.position)}% through</span>
            {selectedEvent.chapterRef && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1 normal-case tracking-normal">
                  <BookMarked className="h-3 w-3" />
                  <span className="font-serif italic">{selectedEvent.chapterRef}</span>
                </span>
              </>
            )}
            {selectedEvent.confidence === "low" && (
              <span className="meta inline-flex items-center gap-1 bg-muted px-1.5 py-0.5">
                <ShieldAlert className="h-2.5 w-2.5" /> low confidence
              </span>
            )}
          </div>
          <h3 className="mt-2 font-serif text-2xl font-semibold leading-tight">
            {selectedEvent.title}
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {selectedEvent.description}
          </p>
          {selectedEvent.characterIds.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <span className="meta mr-1 text-muted-foreground">Featuring</span>
              {selectedEvent.characterIds.map((id) => {
                const c = charById.get(id);
                if (!c) return null;
                const cIdx = laneIndex.get(c.laneId) ?? 0;
                const color = laneColor(cIdx);
                const isSel = selectedCharacterId === id;
                return (
                  <button
                    key={id}
                    onClick={() => onSelectCharacter(isSel ? null : id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 ink-border px-2 py-0.5 text-xs transition-colors",
                      isSel
                        ? "bg-foreground text-background"
                        : "bg-card text-foreground hover:bg-foreground hover:text-background",
                    )}
                  >
                    <span className="h-1.5 w-1.5" style={{ backgroundColor: color }} />
                    <span className="font-serif italic">{c.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
