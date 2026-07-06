import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Character,
  FictionAnalysis,
  Relationship,
  REL_DEFAULT_STRENGTH,
  ROLE_WEIGHT,
} from "@/lib/novel-types";
import { cn } from "@/lib/utils";
import { ZoomIn, ZoomOut, Maximize2, Play, Pause, X } from "lucide-react";

interface Props {
  analysis: FictionAnalysis;
  /** Spoiler frontier 0–100. Characters introduced later are hidden. */
  progress?: number;
  /** Drive the global progress slider from inside the network's mini-scrubber. */
  onProgressChange?: (next: number) => void;
  /** Externally-controlled selection */
  selectedCharacterId?: string | null;
  onSelectCharacter?: (id: string | null) => void;
  /** Highlight characters featured in the currently-selected event. */
  highlightedCharacterIds?: string[];
  /** When an event is picked from inside the network panel, bubble up. */
  onSelectEventId?: (eventId: string) => void;
  /** Deprecated — kept for backward compatibility, no longer used (pin feature removed). */
  cacheKey?: string | null;
}

/* -----------------------------------------------------------------------------
 * Edge tone system — three semantic buckets mapped onto the editorial palette.
 *  positive  → cobalt primary, solid       (family, friend, romantic, mentor)
 *  negative  → signal red, dashed          (rival, antagonistic)
 *  neutral   → ink at low opacity, dashed  (professional, acquaintance)
 * --------------------------------------------------------------------------- */
type RelTone = "positive" | "negative" | "neutral";
const REL_STYLE: Record<
  string,
  { tone: RelTone; dash?: string; label: string }
> = {
  family:       { tone: "positive", label: "FAMILY" },
  romantic:     { tone: "positive", label: "ROMANTIC" },
  friend:       { tone: "positive", label: "FRIEND" },
  mentor:       { tone: "positive", label: "MENTOR" },
  professional: { tone: "neutral",  dash: "2 4", label: "PROFESSIONAL" },
  acquaintance: { tone: "neutral",  dash: "2 6", label: "ACQUAINTANCE" },
  rival:        { tone: "negative", dash: "6 4", label: "RIVAL" },
  antagonistic: { tone: "negative", dash: "6 4", label: "ANTAGONIST" },
};
const toneColor = (tone: RelTone) =>
  tone === "positive"
    ? "hsl(var(--primary))"
    : tone === "negative"
      ? "hsl(var(--destructive))"
      : "hsl(var(--foreground) / 0.45)";

interface Node {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  laneIdx: number;
  char: Character;
}

const W = 900;
const H = 600;

/** Tiny deterministic seeded RNG so layout is stable across rerenders. */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const CharacterNetwork = ({
  analysis,
  progress = 100,
  onProgressChange,
  selectedCharacterId,
  onSelectCharacter,
  highlightedCharacterIds,
  onSelectEventId,
}: Props) => {
  const [hovered, setHovered] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragNode, setDragNode] = useState<string | null>(null);
  const [panning, setPanning] = useState<{ x: number; y: number } | null>(null);
  const [selectedRelIdx, setSelectedRelIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // Auto-play scrubber: ticks progress 0→100 over ~12s
  useEffect(() => {
    if (!playing || !onProgressChange) return;
    if (progress >= 100) {
      setPlaying(false);
      return;
    }
    const t = window.setTimeout(() => {
      onProgressChange(Math.min(100, progress + 2));
    }, 240);
    return () => window.clearTimeout(t);
  }, [playing, progress, onProgressChange]);

  const laneIndex = useMemo(() => {
    const m = new Map<string, number>();
    analysis.lanes.forEach((l, i) => m.set(l.id, i));
    return m;
  }, [analysis.lanes]);

  /* ---------------------------------------------------------------------------
   * Force-directed layout — radial-by-lane, attracted along edges,
   * with a "central protagonist" pin so important nodes anchor the composition.
   * ------------------------------------------------------------------------- */
  const initialNodes = useMemo<Node[]>(() => {
    const seed = analysis.title.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const rand = mulberry32(seed || 1);
    const lanesCount = Math.max(1, analysis.lanes.length);
    const nodes: Node[] = analysis.characters.map((c) => {
      const idx = c.laneId ? laneIndex.get(c.laneId) ?? 0 : 0;
      const angle =
        lanesCount === 1
          ? rand() * Math.PI * 2
          : (idx / lanesCount) * Math.PI * 2 - Math.PI / 2;
      const ringR = Math.min(W, H) * 0.28;
      const jitter = (rand() - 0.5) * 80;
      // Protagonists sit larger; supporting/minor get progressively smaller.
      const weight = ROLE_WEIGHT[c.role] ?? 2;
      return {
        id: c.id,
        x: W / 2 + Math.cos(angle) * (ringR + jitter),
        y: H / 2 + Math.sin(angle) * (ringR + jitter),
        vx: 0,
        vy: 0,
        r: 14 + weight * 6,
        laneIdx: idx,
        char: c,
      };
    });

    if (nodes.length === 0) return nodes;

    // Pin the highest-weight character at the centre.
    const protagonistIdx = nodes.reduce(
      (best, n, i) =>
        (ROLE_WEIGHT[n.char.role] ?? 0) >
        (ROLE_WEIGHT[nodes[best].char.role] ?? 0)
          ? i
          : best,
      0,
    );
    nodes[protagonistIdx].x = W / 2;
    nodes[protagonistIdx].y = H / 2;

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const edges = analysis.relationships
      .map((r) => {
        const a = nodeMap.get(r.fromId);
        const b = nodeMap.get(r.toId);
        if (!a || !b) return null;
        const strength = r.strength ?? REL_DEFAULT_STRENGTH[r.type] ?? 2;
        return { a, b, strength };
      })
      .filter((x): x is { a: Node; b: Node; strength: number } => !!x);

    const ITER = 360;
    const cx = W / 2;
    const cy = H / 2;
    for (let it = 0; it < ITER; it++) {
      const alpha = 1 - it / ITER;
      // Repulsion (Coulomb-ish, O(n^2))
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist2 = dx * dx + dy * dy + 0.01;
          const dist = Math.sqrt(dist2);
          const minSep = a.r + b.r + 22;
          const force =
            6800 / dist2 + (dist < minSep ? (minSep - dist) * 0.6 : 0);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }
      }
      // Attraction along edges
      for (const e of edges) {
        const dx = e.b.x - e.a.x;
        const dy = e.b.y - e.a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
        const desired = 130 - e.strength * 8;
        const k = 0.025 * e.strength;
        const force = (dist - desired) * k;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        e.a.vx += fx;
        e.a.vy += fy;
        e.b.vx -= fx;
        e.b.vy -= fy;
      }
      // Mild centre gravity
      for (const n of nodes) {
        n.vx += (cx - n.x) * 0.0035;
        n.vy += (cy - n.y) * 0.0035;
      }
      // Pin protagonist
      nodes[protagonistIdx].vx = 0;
      nodes[protagonistIdx].vy = 0;
      const damp = 0.72 + 0.2 * (1 - alpha);
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (i === protagonistIdx) continue;
        n.vx *= damp;
        n.vy *= damp;
        n.x += n.vx * (0.6 + 0.4 * alpha);
        n.y += n.vy * (0.6 + 0.4 * alpha);
        n.x = Math.max(56, Math.min(W - 56, n.x));
        n.y = Math.max(56, Math.min(H - 56, n.y));
      }
    }
    return nodes;
  }, [analysis, laneIndex]);

  const [nodes, setNodes] = useState(initialNodes);
  useEffect(() => setNodes(initialNodes), [initialNodes]);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const screenToSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const onPointerDown = (e: React.PointerEvent, nodeId?: string) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (nodeId) {
      // eslint-disable-next-line no-console
      console.log({ ui: "character_network", event: "node_drag_started", pointerType: e.pointerType, nodeId });
      setDragNode(nodeId);
    } else {
      // eslint-disable-next-line no-console
      console.log({ ui: "character_network", event: "canvas_pan_started", pointerType: e.pointerType });
      setPanning({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragNode) {
      const { x, y } = screenToSvg(e.clientX, e.clientY);
      setNodes((prev) =>
        prev.map((n) => (n.id === dragNode ? { ...n, x, y } : n)),
      );
    } else if (panning) {
      setPan({ x: e.clientX - panning.x, y: e.clientY - panning.y });
    }
  };
  const onPointerUp = () => {
    setDragNode(null);
    setPanning(null);
  };

  const isHidden = (c: Character) =>
    typeof c.introducedAt === "number" && c.introducedAt > progress + 0.1;

  const focused = selectedCharacterId || hovered;
  const highlightSet = useMemo(
    () => new Set(highlightedCharacterIds ?? []),
    [highlightedCharacterIds],
  );

  const focusedChar =
    (selectedCharacterId &&
      analysis.characters.find((c) => c.id === selectedCharacterId)) ||
    (hovered && analysis.characters.find((c) => c.id === hovered)) ||
    null;

  const charById = useMemo(() => {
    const m = new Map<string, Character>();
    analysis.characters.forEach((c) => m.set(c.id, c));
    return m;
  }, [analysis.characters]);

  const focusedRelationships = useMemo<
    { rel: Relationship; other: Character; strength: number }[]
  >(() => {
    if (!focusedChar) return [];
    const out: { rel: Relationship; other: Character; strength: number }[] = [];
    for (const r of analysis.relationships) {
      let otherId: string | null = null;
      if (r.fromId === focusedChar.id) otherId = r.toId;
      else if (r.toId === focusedChar.id) otherId = r.fromId;
      if (!otherId) continue;
      const other = charById.get(otherId);
      if (!other) continue;
      out.push({
        rel: r,
        other,
        strength: r.strength ?? REL_DEFAULT_STRENGTH[r.type] ?? 2,
      });
    }
    return out.sort((a, b) => b.strength - a.strength);
  }, [focusedChar, analysis.relationships, charById]);

  const focusedEvents = useMemo(() => {
    if (!focusedChar) return [];
    return analysis.events
      .filter(
        (e) =>
          e.characterIds.includes(focusedChar.id) &&
          e.position <= progress + 0.1,
      )
      .sort((a, b) => a.position - b.position);
  }, [focusedChar, analysis.events, progress]);

  const selectedRel =
    selectedRelIdx !== null ? analysis.relationships[selectedRelIdx] : null;
  const selectedRelChars = selectedRel
    ? {
        a: charById.get(selectedRel.fromId) || null,
        b: charById.get(selectedRel.toId) || null,
      }
    : null;
  const selectedRelEvents = useMemo(() => {
    if (!selectedRel) return [];
    return analysis.events
      .filter(
        (e) =>
          e.characterIds.includes(selectedRel.fromId) &&
          e.characterIds.includes(selectedRel.toId) &&
          e.position <= progress + 0.1,
      )
      .sort((a, b) => a.position - b.position);
  }, [selectedRel, analysis.events, progress]);

  /* ---------------------------------------------------------------------------
   * Centrality — count of relationships divided by total. Drives the
   * "Centrality" bar in the focus panel and the protagonist call-out.
   * ------------------------------------------------------------------------- */
  const centrality = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of analysis.relationships) {
      m.set(r.fromId, (m.get(r.fromId) ?? 0) + 1);
      m.set(r.toId, (m.get(r.toId) ?? 0) + 1);
    }
    const max = Math.max(1, ...m.values());
    return { byId: m, max };
  }, [analysis.relationships]);

  const visibleCount = analysis.characters.filter((c) => !isHidden(c)).length;
  const visibleRelCount = analysis.relationships.filter((r) => {
    const a = charById.get(r.fromId);
    const b = charById.get(r.toId);
    return a && b && !isHidden(a) && !isHidden(b);
  }).length;

  // The most adversarial active edge — surfaced as a footer call-out on the canvas.
  const activeConflict = useMemo(() => {
    const adv = analysis.relationships
      .map((r) => {
        const a = charById.get(r.fromId);
        const b = charById.get(r.toId);
        if (!a || !b || isHidden(a) || isHidden(b)) return null;
        const tone = REL_STYLE[r.type]?.tone ?? "neutral";
        if (tone !== "negative") return null;
        return {
          r,
          a,
          b,
          strength: r.strength ?? REL_DEFAULT_STRENGTH[r.type] ?? 2,
        };
      })
      .filter(Boolean) as { r: Relationship; a: Character; b: Character; strength: number }[];
    if (adv.length === 0) return null;
    adv.sort((x, y) => y.strength - x.strength);
    return adv[0];
  }, [analysis.relationships, charById, progress]);

  return (
    <div className="ink-border bg-card">
      {/* ============== HEADER ============== */}
      <div className="flex items-center justify-between gap-3 border-b border-foreground px-4 py-3 md:px-5">
        <div className="min-w-0">
          <h3 className="truncate font-sans text-lg font-bold tracking-tight md:text-xl">
            Character Network
          </h3>
          <div className="mt-1 hidden flex-wrap items-center gap-3 md:flex">
            <span className="meta text-muted-foreground">
              SYSTEM · FORCE-DIRECTED v2.4
            </span>
            <span className="meta text-muted-foreground">
              DATA · {String(visibleCount).padStart(2, "0")} NODES /{" "}
              {String(visibleRelCount).padStart(2, "0")} EDGES
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <ChromeBtn ariaLabel="Zoom out" onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}>
            <ZoomOut className="h-3.5 w-3.5" />
          </ChromeBtn>
          <ChromeBtn ariaLabel="Zoom in" onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}>
            <ZoomIn className="h-3.5 w-3.5" />
          </ChromeBtn>
          <ChromeBtn
            ariaLabel="Reset view"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
              setNodes(initialNodes);
            }}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </ChromeBtn>
        </div>
      </div>

      {/* ============== MAIN — canvas + sidebar ============== */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px]">
        {/* ---- Canvas ---- */}
        <div
          className="relative overflow-hidden border-foreground lg:border-r"
          style={{
            backgroundImage:
              "radial-gradient(hsl(var(--foreground) / 0.16) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            backgroundPosition: "center",
          }}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="block w-full select-none"
            style={{
              // Floor at 360px so portrait phones (≈700-800px viewport minus header/nav
              // chrome above this panel) never collapse the network into an unusably
              // cramped strip; still caps at 620px so it doesn't dominate short desktop
              // windows either.
              height: "max(360px, min(64vh, 620px))",
              touchAction: "none",
              cursor: panning ? "grabbing" : "grab",
            }}
            onPointerDown={(e) => onPointerDown(e)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onClick={(e) => {
              if (e.target === svgRef.current) {
                onSelectCharacter?.(null);
                setSelectedRelIdx(null);
              }
            }}
          >
            <defs>
              <marker
                id="arrow-red"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L0,6 L9,3 z" fill="hsl(var(--destructive))" />
              </marker>
            </defs>
            <g
              transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}
              style={{ transformOrigin: "center" }}
            >
              {/* edges */}
              {analysis.relationships.map((r, i) => {
                const a = nodeById.get(r.fromId);
                const b = nodeById.get(r.toId);
                if (!a || !b) return null;
                if (isHidden(a.char) || isHidden(b.char)) return null;
                const style = REL_STYLE[r.type] || REL_STYLE.acquaintance;
                const strength = r.strength ?? REL_DEFAULT_STRENGTH[r.type] ?? 2;
                const isRelSelected = selectedRelIdx === i;
                const isFocusEdge =
                  isRelSelected ||
                  (focused && (focused === r.fromId || focused === r.toId));
                const isFaded =
                  (focused || selectedRelIdx !== null) && !isFocusEdge;
                const stroke = toneColor(style.tone);
                return (
                  <g key={i} opacity={isFaded ? 0.08 : isFocusEdge ? 1 : 0.65}>
                    {/* Wide invisible hit target for easier clicking */}
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="transparent"
                      strokeWidth={14}
                      style={{ cursor: "pointer", pointerEvents: "stroke" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRelIdx(isRelSelected ? null : i);
                        onSelectCharacter?.(null);
                      }}
                    />
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={stroke}
                      strokeWidth={
                        isFocusEdge ? Math.max(2.4, strength * 0.85) : 0.8 + strength * 0.4
                      }
                      strokeDasharray={style.dash}
                      strokeLinecap="butt"
                      markerEnd={
                        style.tone === "negative" && isFocusEdge ? "url(#arrow-red)" : undefined
                      }
                      style={{ pointerEvents: "none" }}
                    />
                    {isFocusEdge && (
                      <text
                        x={(a.x + b.x) / 2}
                        y={(a.y + b.y) / 2 - 6}
                        textAnchor="middle"
                        fontSize={9}
                        fontFamily="'JetBrains Mono', ui-monospace, monospace"
                        fontWeight={700}
                        letterSpacing="0.12em"
                        fill={stroke}
                        style={{ pointerEvents: "none" }}
                      >
                        {style.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* nodes — bloom-in as their introducedAt threshold crosses */}
              <AnimatePresence>
                {nodes.map((n, idx) => {
                  const c = n.char;
                  const hidden = isHidden(c);
                  if (hidden) return null;

                  const isFocused = focused === c.id;
                  const isHighlighted = highlightSet.has(c.id);
                  const isConnected =
                    focused &&
                    analysis.relationships.some(
                      (r) =>
                        (r.fromId === focused && r.toId === c.id) ||
                        (r.toId === focused && r.fromId === c.id),
                    );
                  const isFaded = focused && !isFocused && !isConnected;
                  const op = isFaded ? 0.22 : 1;

                  // Protagonist = highest centrality node, gets the cobalt ring.
                  const isProtagonist =
                    (centrality.byId.get(c.id) ?? 0) === centrality.max;

                  // Selected/focused → cobalt fill, ink text inverts to bone.
                  const fillSelected = isFocused || isHighlighted;
                  const fill = fillSelected
                    ? "hsl(var(--primary))"
                    : "hsl(var(--card))";
                  const stroke = isProtagonist
                    ? "hsl(var(--primary))"
                    : "hsl(var(--foreground))";
                  const strokeW = isProtagonist || isFocused ? 2.4 : 1.4;
                  const textColor = fillSelected
                    ? "hsl(var(--primary-foreground))"
                    : "hsl(var(--foreground))";

                  return (
                    <motion.g
                      key={c.id}
                      initial={{ opacity: 0, scale: 0.4 }}
                      animate={{ opacity: op, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.4 }}
                      transition={{
                        duration: 0.55,
                        delay: 0.04 * (idx % 8),
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      style={{
                        transformOrigin: `${n.x}px ${n.y}px`,
                        cursor: "pointer",
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        onPointerDown(e as unknown as React.PointerEvent, c.id);
                      }}
                      onMouseEnter={() => setHovered(c.id)}
                      onMouseLeave={() => setHovered(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRelIdx(null);
                        onSelectCharacter?.(
                          selectedCharacterId === c.id ? null : c.id,
                        );
                      }}
                    >
                      {/* focus halo */}
                      {(isFocused || isHighlighted) && (
                        <circle
                          cx={n.x}
                          cy={n.y}
                          r={n.r + 10}
                          fill="none"
                          stroke="hsl(var(--primary))"
                          strokeWidth={1}
                          opacity={0.45}
                        />
                      )}
                      {/* Invisible enlarged hit target — the visible node body (r as low as
                          ~20 SVG units, i.e. well under a 40px screen target once scaled into
                          the mobile canvas) is too small to reliably grab on touch and easily
                          mistaken for a background pan-start. Capped relative to minSep (r_a +
                          r_b + 22 in the force layout) so neighboring hit targets don't swallow
                          each other on dense graphs. */}
                      <circle
                        cx={n.x}
                        cy={n.y}
                        r={Math.min(n.r + 20, 34)}
                        fill="transparent"
                        pointerEvents="all"
                      />
                      {/* subtle static ring — a touch-visible cue that this is a grabbable
                          node (distinct from the empty background, which pans) since :hover
                          affordances don't fire on touch */}
                      <circle
                        cx={n.x}
                        cy={n.y}
                        r={n.r + 4}
                        fill="none"
                        stroke="hsl(var(--foreground) / 0.25)"
                        strokeWidth={1}
                        strokeDasharray="2 3"
                        pointerEvents="none"
                      />
                      {/* main body */}
                      <circle
                        cx={n.x}
                        cy={n.y}
                        r={n.r}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={strokeW}
                        pointerEvents="none"
                      />
                      {/* index number on big nodes */}
                      {n.r >= 22 && (
                        <text
                          x={n.x}
                          y={n.y - 3}
                          textAnchor="middle"
                          fontFamily="'JetBrains Mono', ui-monospace, monospace"
                          fontSize={9}
                          fontWeight={500}
                          fill={textColor}
                          opacity={0.7}
                          style={{ pointerEvents: "none" }}
                        >
                          {String(idx + 1).padStart(3, "0")}
                        </text>
                      )}
                      {/* short name in-circle for protagonist & big roles */}
                      {n.r >= 22 && (
                        <text
                          x={n.x}
                          y={n.y + 9}
                          textAnchor="middle"
                          fontFamily="'Space Grotesk', system-ui, sans-serif"
                          fontSize={Math.min(11, n.r / 2.2)}
                          fontWeight={700}
                          fill={textColor}
                          letterSpacing="-0.01em"
                          style={{ pointerEvents: "none", textTransform: "uppercase" }}
                        >
                          {shortLabel(c.name)}
                        </text>
                      )}
                      {/* always-visible name plate beneath node */}
                      <text
                        x={n.x}
                        y={n.y + n.r + 14}
                        textAnchor="middle"
                        fontFamily="'Space Grotesk', system-ui, sans-serif"
                        fontSize={isFocused ? 12 : 10.5}
                        fontWeight={isFocused ? 700 : 500}
                        fill="hsl(var(--foreground))"
                        style={{ pointerEvents: "none" }}
                      >
                        {c.name}
                      </text>
                    </motion.g>
                  );
                })}
              </AnimatePresence>
            </g>
          </svg>

          {/* Active conflict call-out */}
          {activeConflict && !focusedChar && !selectedRel && (
            <div className="pointer-events-none absolute bottom-4 left-4 max-w-[60%] border-l-2 border-destructive bg-background/85 pl-3 pr-2 py-1.5 backdrop-blur">
              <div className="meta text-destructive">ACTIVE CONFLICT</div>
              <div className="mt-0.5 font-sans text-sm font-semibold">
                {activeConflict.a.name}
                <span className="mx-1.5 text-muted-foreground">vs</span>
                {activeConflict.b.name}
              </div>
              {activeConflict.r.description && (
                <div className="meta mt-0.5 text-muted-foreground line-clamp-1">
                  {activeConflict.r.description}
                </div>
              )}
            </div>
          )}

          {/* Hidden-by-spoiler badge */}
          {analysis.characters.some(isHidden) && (
            <div className="pointer-events-none absolute bottom-4 right-4 border border-foreground/30 bg-background/85 px-2.5 py-1 backdrop-blur">
              <div className="meta text-muted-foreground">
                {analysis.characters.filter(isHidden).length} hidden by spoiler shield
              </div>
            </div>
          )}
        </div>

        {/* ---- Sidebar ---- */}
        <aside className="flex flex-col border-t border-foreground bg-background lg:border-t-0">
          <AnimatePresence mode="wait">
            {selectedRel && selectedRelChars?.a && selectedRelChars?.b ? (
              <motion.div
                key={`rel-${selectedRelIdx}`}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="flex flex-1 flex-col"
              >
                <RelPanel
                  rel={selectedRel}
                  a={selectedRelChars.a}
                  b={selectedRelChars.b}
                  events={selectedRelEvents}
                  onSelectCharacter={(id) => {
                    setSelectedRelIdx(null);
                    onSelectCharacter?.(id);
                  }}
                  onSelectEventId={onSelectEventId}
                  onClose={() => setSelectedRelIdx(null)}
                />
              </motion.div>
            ) : focusedChar ? (
              <motion.div
                key={`char-${focusedChar.id}`}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="flex flex-1 flex-col"
              >
                <CharPanel
                  char={focusedChar}
                  centrality={
                    (centrality.byId.get(focusedChar.id) ?? 0) /
                    Math.max(1, centrality.max)
                  }
                  isProtagonist={
                    (centrality.byId.get(focusedChar.id) ?? 0) === centrality.max
                  }
                  relationships={focusedRelationships}
                  events={focusedEvents}
                  onSelectCharacter={(id) => onSelectCharacter?.(id)}
                  onSelectRelationship={(rel) => {
                    onSelectCharacter?.(null);
                    setSelectedRelIdx(analysis.relationships.indexOf(rel));
                  }}
                  onSelectEventId={onSelectEventId}
                  onClear={
                    selectedCharacterId
                      ? () => onSelectCharacter?.(null)
                      : undefined
                  }
                />
              </motion.div>
            ) : (
              <motion.div
                key="legend"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-1 flex-col"
              >
                <Legend
                  total={analysis.characters.length}
                  visible={visibleCount}
                  edges={visibleRelCount}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </aside>
      </div>

      {/* ============== TIMELINE FOOTER ============== */}
      {onProgressChange && (
        <div className="grid grid-cols-1 items-center gap-4 border-t border-foreground bg-foreground px-4 py-4 text-background md:grid-cols-[auto_1fr_auto] md:px-6 md:py-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (progress >= 100 && !playing) onProgressChange(0);
                setPlaying((p) => !p);
              }}
              aria-label={playing ? "Pause story" : "Play story"}
              className="inline-flex h-10 w-10 items-center justify-center border border-background/40 transition-colors hover:bg-primary hover:border-primary"
            >
              {playing ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </button>
            <div className="flex flex-col">
              <span className="meta text-background/60">STORY PROGRESS</span>
              <span className="font-sans text-xs font-bold uppercase tracking-wide">
                {chapterLabel(progress)}
              </span>
            </div>
          </div>

          <div className="relative h-8 group">
            {/* tick marks at 25/50/75 */}
            <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between">
              {[0, 25, 50, 75, 100].map((t) => (
                <div
                  key={t}
                  className={cn(
                    "w-px",
                    t % 50 === 0 ? "h-3 bg-background/35" : "h-2 bg-background/20",
                  )}
                />
              ))}
            </div>
            {/* track */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-background/25" />
            {/* progress fill */}
            <div
              className="absolute top-1/2 -translate-y-1/2 h-[3px] bg-primary"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
            {/* native input — invisible but hit-testable */}
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={progress}
              onChange={(e) => {
                setPlaying(false);
                onProgressChange(Number(e.target.value));
              }}
              aria-label="Story progress"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            {/* handle */}
            <div
              aria-hidden
              className="pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-3 bg-primary ring-4 ring-foreground transition-transform group-hover:scale-125"
              style={{ left: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <span
              className="font-mono text-2xl font-bold tabular-nums tracking-tight"
            >
              {String(Math.round(progress)).padStart(2, "0")}
              <span className="text-sm text-background/50">%</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

/* =============================================================================
 * Sub-components
 * ========================================================================== */

function ChromeBtn({
  children,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className="inline-flex h-8 w-8 items-center justify-center border border-foreground bg-card text-foreground transition-colors hover:bg-primary hover:text-primary-foreground hover:border-primary"
    >
      {children}
    </button>
  );
}

function shortLabel(name: string): string {
  // First word, uppercased, trimmed to 7 chars max — keeps in-circle text readable.
  const first = name.split(/\s+/)[0] ?? name;
  return first.length > 7 ? first.slice(0, 7) : first;
}

function chapterLabel(progress: number): string {
  // We don't know real chapter breaks; surface a friendly label.
  if (progress <= 0) return "OPENING";
  if (progress >= 100) return "RESOLUTION";
  const part = Math.ceil(progress / 25);
  const labels = ["EXPOSITION", "RISING ACTION", "TURN", "FALLING ACTION"];
  return labels[Math.min(3, part - 1)] ?? "MIDPOINT";
}

function CharPanel({
  char,
  centrality,
  isProtagonist,
  relationships,
  events,
  onSelectCharacter,
  onSelectRelationship,
  onSelectEventId,
  onClear,
}: {
  char: Character;
  centrality: number;
  isProtagonist: boolean;
  relationships: { rel: Relationship; other: Character; strength: number }[];
  events: { id: string; position: number; title: string }[];
  onSelectCharacter: (id: string) => void;
  onSelectRelationship: (rel: Relationship) => void;
  onSelectEventId?: (id: string) => void;
  onClear?: () => void;
}) {
  return (
    <>
      <div className="border-b border-foreground p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="meta text-primary tracking-[0.2em]">
            {isProtagonist ? "PROTAGONIST" : "FOCUS PROFILE"}
          </div>
          {onClear && (
            <button
              onClick={onClear}
              aria-label="Clear selection"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <h4 className="mt-2 font-sans text-2xl font-bold leading-tight">
          {char.name}
        </h4>
        <div className="meta mt-1 text-muted-foreground uppercase">
          {char.role}
        </div>
        {char.description && (
          <p className="mt-3 font-serif text-sm italic leading-relaxed text-muted-foreground">
            {char.description}
          </p>
        )}
      </div>

      <div className="space-y-6 overflow-y-auto p-5">
        <section>
          <div className="meta border-b border-foreground pb-1.5 text-foreground tracking-widest">
            KEY METRICS
          </div>
          <Metric label="Centrality" value={centrality} tone="primary" />
          <Metric
            label="Bonds"
            value={Math.min(1, relationships.length / 6)}
            tone="ink"
            display={`${relationships.length}`}
          />
          {events.length > 0 && (
            <Metric
              label="Appearances"
              value={Math.min(1, events.length / 12)}
              tone="ink"
              display={`${events.length}`}
            />
          )}
        </section>

        {relationships.length > 0 && (
          <section>
            <div className="meta border-b border-foreground pb-1.5 text-foreground tracking-widest">
              PRIMARY BONDS
            </div>
            <ul className="mt-3 space-y-2.5">
              {relationships.slice(0, 8).map(({ rel, other, strength }, i) => {
                const style = REL_STYLE[rel.type] || REL_STYLE.acquaintance;
                const dot = toneColor(style.tone);
                return (
                  <li key={`${other.id}-${i}`} className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0"
                      style={{ backgroundColor: dot }}
                    />
                    <button
                      onClick={() => onSelectCharacter(other.id)}
                      className="font-sans text-xs font-semibold uppercase tracking-tight transition-colors hover:text-primary"
                    >
                      {other.name}
                    </button>
                    <button
                      onClick={() => onSelectRelationship(rel)}
                      className="meta ml-auto text-muted-foreground hover:text-foreground"
                      title={rel.description || style.label}
                    >
                      {style.label}
                      <span className="ml-1.5 opacity-60">
                        {String(strength).padStart(1, "0")}/5
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {events.length > 0 && onSelectEventId && (
          <section>
            <div className="meta border-b border-foreground pb-1.5 text-foreground tracking-widest">
              APPEARS IN
            </div>
            <ul className="mt-3 space-y-1.5">
              {events.slice(0, 6).map((ev) => (
                <li key={ev.id}>
                  <button
                    onClick={() => onSelectEventId(ev.id)}
                    className="block w-full text-left transition-colors hover:text-primary"
                  >
                    <span className="meta mr-2 text-muted-foreground">
                      {String(Math.round(ev.position)).padStart(2, "0")}%
                    </span>
                    <span className="font-serif text-sm italic">{ev.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}

function Metric({
  label,
  value,
  tone,
  display,
}: {
  label: string;
  value: number;
  tone: "primary" | "ink";
  display?: string;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex items-end justify-between">
        <span className="meta text-muted-foreground">{label}</span>
        <span className="font-mono text-xs font-medium">
          {display ?? value.toFixed(2)}
        </span>
      </div>
      <div className="h-[3px] w-full bg-foreground/10">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "h-full",
            tone === "primary" ? "bg-primary" : "bg-foreground",
          )}
        />
      </div>
    </div>
  );
}

function RelPanel({
  rel,
  a,
  b,
  events,
  onSelectCharacter,
  onSelectEventId,
  onClose,
}: {
  rel: Relationship;
  a: Character;
  b: Character;
  events: { id: string; position: number; title: string }[];
  onSelectCharacter: (id: string) => void;
  onSelectEventId?: (id: string) => void;
  onClose: () => void;
}) {
  const style = REL_STYLE[rel.type] || REL_STYLE.acquaintance;
  const strength = rel.strength ?? REL_DEFAULT_STRENGTH[rel.type] ?? 2;
  const tone = toneColor(style.tone);
  return (
    <>
      <div className="border-b border-foreground p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="meta tracking-[0.2em]" style={{ color: tone }}>
            RELATIONSHIP · {style.label}
          </div>
          <button
            onClick={onClose}
            aria-label="Close relationship"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => onSelectCharacter(a.id)}
            className="font-sans text-base font-bold underline-offset-2 hover:underline"
          >
            {a.name}
          </button>
          <span
            aria-hidden
            className="inline-block h-px flex-1"
            style={{ backgroundColor: tone }}
          />
          <button
            onClick={() => onSelectCharacter(b.id)}
            className="font-sans text-base font-bold underline-offset-2 hover:underline"
          >
            {b.name}
          </button>
        </div>
        <div className="meta mt-2 text-muted-foreground">
          STRENGTH · {strength}/5
        </div>
        {rel.description && (
          <p className="mt-3 font-serif text-sm italic leading-relaxed">
            {rel.description}
          </p>
        )}
      </div>
      {events.length > 0 && onSelectEventId && (
        <div className="overflow-y-auto p-5">
          <div className="meta border-b border-foreground pb-1.5 tracking-widest">
            SHARED EVENTS
          </div>
          <ul className="mt-3 space-y-1.5">
            {events.slice(0, 8).map((ev) => (
              <li key={ev.id}>
                <button
                  onClick={() => onSelectEventId(ev.id)}
                  className="block w-full text-left transition-colors hover:text-primary"
                >
                  <span className="meta mr-2 text-muted-foreground">
                    {String(Math.round(ev.position)).padStart(2, "0")}%
                  </span>
                  <span className="font-serif text-sm italic">{ev.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function Legend({
  total,
  visible,
  edges,
}: {
  total: number;
  visible: number;
  edges: number;
}) {
  return (
    <div className="space-y-6 p-5">
      <div>
        <div className="meta text-primary tracking-[0.2em]">
          NETWORK OVERVIEW
        </div>
        <div className="mt-2 font-serif text-base italic leading-snug text-muted-foreground">
          Hover or tap a character to read their dossier. Click an edge to
          inspect the relationship.
        </div>
      </div>

      <div>
        <div className="meta border-b border-foreground pb-1.5 tracking-widest">
          AT A GLANCE
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Stat label="Visible" value={visible} sub={`of ${total}`} />
          <Stat label="Edges" value={edges} />
          <Stat label="Hidden" value={total - visible} />
        </div>
      </div>

      <div>
        <div className="meta border-b border-foreground pb-1.5 tracking-widest">
          EDGE LEGEND
        </div>
        <ul className="mt-3 space-y-2">
          <LegendRow tone="positive" label="Family · Friend · Romantic · Mentor" />
          <LegendRow tone="negative" label="Rival · Antagonist" />
          <LegendRow tone="neutral" label="Professional · Acquaintance" />
        </ul>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="border border-foreground p-2.5">
      <div className="display-num text-2xl">{String(value).padStart(2, "0")}</div>
      <div className="meta mt-0.5 text-muted-foreground">{label}</div>
      {sub && <div className="meta text-muted-foreground/70">{sub}</div>}
    </div>
  );
}

function LegendRow({ tone, label }: { tone: RelTone; label: string }) {
  const color = toneColor(tone);
  return (
    <li className="flex items-center gap-3">
      <svg width="48" height="6" className="shrink-0">
        <line
          x1="0"
          y1="3"
          x2="48"
          y2="3"
          stroke={color}
          strokeWidth={2}
          strokeDasharray={tone === "positive" ? undefined : tone === "negative" ? "6 4" : "2 5"}
        />
      </svg>
      <span className="meta text-muted-foreground">{label}</span>
    </li>
  );
}
