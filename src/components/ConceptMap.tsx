/**
 * ConceptMap — D3 force-directed graph of non-fiction book concepts.
 * Mirrors the design language of CharacterNetwork but adapted for ideas.
 *
 * Concept nodes are sized by importance (0-100).
 * Edges are coloured by relationship type using the editorial palette.
 */
import { useEffect, useRef, useState } from "react";
import { NfConcept, NfConceptRelationship, NfRelationshipType, NonFictionAnalysis } from "@/lib/novel-types";
import { cn } from "@/lib/utils";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

// ─── Colour system ────────────────────────────────────────────────────────────

type RelTone = "constructive" | "critical" | "neutral";

const REL_TONE: Record<NfRelationshipType, RelTone> = {
  supports:    "constructive",
  expands:     "constructive",
  leads_to:    "constructive",
  illustrates: "neutral",
  contradicts: "critical",
  challenges:  "critical",
};

const REL_DASH: Partial<Record<NfRelationshipType, string>> = {
  contradicts: "6 4",
  challenges:  "4 4",
  illustrates: "2 4",
};

const REL_LABEL: Record<NfRelationshipType, string> = {
  supports:    "SUPPORTS",
  expands:     "EXPANDS",
  leads_to:    "LEADS TO",
  illustrates: "ILLUSTRATES",
  contradicts: "CONTRADICTS",
  challenges:  "CHALLENGES",
};

function toneColor(tone: RelTone): string {
  if (tone === "constructive") return "hsl(var(--primary))";
  if (tone === "critical")     return "hsl(var(--destructive))";
  return "hsl(var(--foreground) / 0.4)";
}

// ─── Concept type colours (CSS vars from the lane system) ─────────────────────

const CONCEPT_TYPE_COLOR: Record<NfConcept["type"], string> = {
  thesis:     "hsl(var(--lane-1))",
  framework:  "hsl(var(--lane-3))",
  evidence:   "hsl(var(--lane-5))",
  example:    "hsl(var(--lane-7))",
  conclusion: "hsl(var(--lane-9))",
  principle:  "hsl(var(--lane-2))",
};

// ─── Physics ──────────────────────────────────────────────────────────────────

interface Node {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  concept: NfConcept;
}

const W = 900;
const H = 560;
const PADDING = 40;

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function computeRadius(importance: number): number {
  return 12 + (importance / 100) * 22; // 12-34px
}

function simulate(nodes: Node[], edges: NfConceptRelationship[], iterations = 120): Node[] {
  const ns = nodes.map((n) => ({ ...n }));
  const nodeMap = new Map(ns.map((n) => [n.id, n]));
  const cx = W / 2;
  const cy = H / 2;

  for (let iter = 0; iter < iterations; iter++) {
    const cooling = 1 - iter / iterations;

    // Repulsion between all node pairs
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const a = ns[i], b = ns[j];
        const dx = b.x - a.x || 0.01;
        const dy = b.y - a.y || 0.01;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const minDist = a.r + b.r + 30;
        if (dist < minDist) {
          const force = ((minDist - dist) / dist) * 0.6 * cooling;
          a.vx -= dx * force;
          a.vy -= dy * force;
          b.vx += dx * force;
          b.vy += dy * force;
        }
      }
    }

    // Spring attraction along edges
    for (const edge of edges) {
      const a = nodeMap.get(edge.fromId);
      const b = nodeMap.get(edge.toId);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const rest = a.r + b.r + 90;
      const force = ((dist - rest) / dist) * 0.12 * cooling;
      a.vx += dx * force;
      a.vy += dy * force;
      b.vx -= dx * force;
      b.vy -= dy * force;
    }

    // Gravity toward centre
    for (const n of ns) {
      n.vx += (cx - n.x) * 0.01 * cooling;
      n.vy += (cy - n.y) * 0.01 * cooling;
    }

    // Integrate
    for (const n of ns) {
      n.x = Math.max(PADDING + n.r, Math.min(W - PADDING - n.r, n.x + n.vx));
      n.y = Math.max(PADDING + n.r, Math.min(H - PADDING - n.r, n.y + n.vy));
      n.vx *= 0.75;
      n.vy *= 0.75;
    }
  }
  return ns;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  analysis: NonFictionAnalysis;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ConceptMap({ analysis }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const concepts = analysis.concepts ?? [];
  const edges = analysis.conceptRelationships ?? [];

  // Build + simulate nodes
  useEffect(() => {
    if (concepts.length === 0) return;
    const rng = mulberry32(concepts.reduce((s, c) => s + c.id.charCodeAt(0), 0));
    const initial: Node[] = concepts.map((c) => ({
      id: c.id,
      x: PADDING + rng() * (W - PADDING * 2),
      y: PADDING + rng() * (H - PADDING * 2),
      vx: 0,
      vy: 0,
      r: computeRadius(c.importance),
      concept: c,
    }));
    const simulated = simulate(initial, edges);
    setNodes(simulated);
  }, [analysis.title]);

  // Fit to SVG viewport
  const fitView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const selectedNode = selectedId ? nodes.find((n) => n.id === selectedId) : null;

  if (concepts.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        No concepts available.
      </div>
    );
  }

  return (
    <div className="relative select-none">
      {/* Controls */}
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-1">
        {[
          { icon: <ZoomIn className="h-3.5 w-3.5" />, action: () => setZoom((z) => Math.min(3, z * 1.25)) },
          { icon: <ZoomOut className="h-3.5 w-3.5" />, action: () => setZoom((z) => Math.max(0.3, z / 1.25)) },
          { icon: <Maximize2 className="h-3.5 w-3.5" />, action: fitView },
        ].map(({ icon, action }, i) => (
          <button
            key={i}
            onClick={action}
            className="border border-foreground/30 bg-card p-1.5 text-foreground/60 transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            {icon}
          </button>
        ))}
      </div>

      {/* SVG */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="h-[420px] w-full cursor-grab overflow-visible active:cursor-grabbing md:h-[560px]"
        onMouseDown={(e) => {
          if ((e.target as SVGElement).closest("[data-node]")) return;
          setIsDragging(true);
          setDragStart({ x: e.clientX, y: e.clientY });
          setPanStart({ ...pan });
        }}
        onMouseMove={(e) => {
          if (!isDragging) return;
          const svgEl = svgRef.current;
          if (!svgEl) return;
          const rect = svgEl.getBoundingClientRect();
          const scaleX = W / rect.width;
          const scaleY = H / rect.height;
          setPan({
            x: panStart.x + (e.clientX - dragStart.x) * scaleX,
            y: panStart.y + (e.clientY - dragStart.y) * scaleY,
          });
        }}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L8,3 z" fill="hsl(var(--foreground) / 0.35)" />
          </marker>
        </defs>

        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {/* Edges */}
          {edges.map((edge, i) => {
            const a = nodes.find((n) => n.id === edge.fromId);
            const b = nodes.find((n) => n.id === edge.toId);
            if (!a || !b) return null;
            const tone = REL_TONE[edge.type] ?? "neutral";
            const color = toneColor(tone);
            const dash = REL_DASH[edge.type];

            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const ux = dx / dist;
            const uy = dy / dist;
            const x1 = a.x + ux * a.r;
            const y1 = a.y + uy * a.r;
            const x2 = b.x - ux * (b.r + 8);
            const y2 = b.y - uy * (b.r + 8);
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;

            const isSelected =
              selectedId === edge.fromId || selectedId === edge.toId;

            return (
              <g key={i} opacity={selectedId && !isSelected ? 0.15 : 1}>
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={color}
                  strokeWidth={isSelected ? 2 : 1}
                  strokeDasharray={dash}
                  markerEnd="url(#arrowhead)"
                />
                {isSelected && (
                  <text
                    x={mx}
                    y={my - 5}
                    textAnchor="middle"
                    fontSize={8}
                    fontFamily="var(--font-sans)"
                    letterSpacing="0.05em"
                    fill={color}
                    opacity={0.8}
                  >
                    {REL_LABEL[edge.type]}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const isSelected = selectedId === node.id;
            const isRelated = selectedId
              ? edges.some(
                  (e) =>
                    (e.fromId === selectedId && e.toId === node.id) ||
                    (e.toId === selectedId && e.fromId === node.id),
                )
              : false;
            const dimmed = selectedId && !isSelected && !isRelated;
            const color = CONCEPT_TYPE_COLOR[node.concept.type];

            return (
              <g
                key={node.id}
                data-node="true"
                transform={`translate(${node.x},${node.y})`}
                style={{ cursor: "pointer" }}
                opacity={dimmed ? 0.2 : 1}
                onClick={() => setSelectedId(isSelected ? null : node.id)}
              >
                <circle
                  r={node.r}
                  fill={color}
                  fillOpacity={isSelected ? 0.3 : 0.12}
                  stroke={color}
                  strokeWidth={isSelected ? 2 : 1}
                />
                <text
                  textAnchor="middle"
                  dy="0.35em"
                  fontSize={Math.min(11, node.r * 0.65)}
                  fontFamily="var(--font-sans)"
                  fontWeight={isSelected ? "700" : "500"}
                  fill="hsl(var(--foreground))"
                  style={{ userSelect: "none", pointerEvents: "none" }}
                >
                  {node.concept.name.length > 18
                    ? node.concept.name.slice(0, 16) + "…"
                    : node.concept.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Detail panel */}
      {selectedNode && (
        <div className="ink-border-t bg-card px-4 py-4 md:px-6">
          <div className="flex items-start gap-3">
            <span
              className="meta mt-0.5 shrink-0 rounded-sm px-1.5 py-0.5 text-xs"
              style={{
                background: CONCEPT_TYPE_COLOR[selectedNode.concept.type],
                color: "hsl(var(--foreground))",
                opacity: 0.85,
              }}
            >
              {selectedNode.concept.type.toUpperCase()}
            </span>
            <div>
              <p className="font-sans text-sm font-semibold">{selectedNode.concept.name}</p>
              <p className="mt-1 font-serif text-sm text-foreground/80">
                {selectedNode.concept.description}
              </p>
              {/* Related concepts */}
              {(() => {
                const related = edges
                  .filter((e) => e.fromId === selectedId || e.toId === selectedId)
                  .map((e) => {
                    const otherId = e.fromId === selectedId ? e.toId : e.fromId;
                    const other = nodes.find((n) => n.id === otherId);
                    const dir = e.fromId === selectedId ? "→" : "←";
                    return other ? { other, e, dir } : null;
                  })
                  .filter(Boolean) as Array<{ other: Node; e: NfConceptRelationship; dir: string }>;
                if (related.length === 0) return null;
                return (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {related.map(({ other, e, dir }, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedId(other.id)}
                        className="meta flex items-center gap-1 border border-foreground/20 px-2 py-0.5 text-xs text-muted-foreground hover:border-foreground/50 hover:text-foreground"
                      >
                        <span className="opacity-50">{dir}</span>
                        {REL_LABEL[e.type]}
                        <span className="font-semibold text-foreground">{other.concept.name}</span>
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="ink-border-t flex flex-wrap gap-4 px-4 py-3 md:px-6">
        {(Object.entries(CONCEPT_TYPE_COLOR) as [NfConcept["type"], string][]).map(
          ([type, color]) =>
            concepts.some((c) => c.type === type) ? (
              <div key={type} className="meta flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="block h-2.5 w-2.5 rounded-full"
                  style={{ background: color }}
                />
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </div>
            ) : null,
        )}
      </div>
    </div>
  );
}
