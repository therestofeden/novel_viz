import React, { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Lasso, X, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type BookType = "fiction" | "nonfiction";

type PcaBasis = {
  axis_order: string[];
  means: number[];
  components: number[][]; // 2 x N
  x_axis_label: string;
  y_axis_label: string;
  seed_corpus: { cache_key: string; title: string; author: string }[];
};

type Point = {
  cache_key: string;
  title: string;
  author: string;
  x: number;
  y: number;
  isShelf: boolean;
};

type ShelfBookLite = { cache_key: string; title: string; author: string; id?: string };

type Cluster = {
  id: string;
  name: string;
  color: string;
  members: string[]; // shelf_book ids
};

interface ConstellationProps {
  shelfBooks: ShelfBookLite[];
  /** Required for cluster persistence. If absent, cluster mode is hidden. */
  shelfId?: string | null;
  /** Called when any book dot is clicked (shelf or reference). */
  onSelect?: (cacheKey: string, title: string, author: string) => void;
}

const CLUSTER_COLORS = [
  "hsl(226 100% 50%)", // primary cobalt
  "hsl(0 85% 52%)",    // signal red
  "hsl(38 92% 50%)",   // amber
  "hsl(160 70% 38%)",  // forest
  "hsl(280 70% 50%)",  // violet
  "hsl(195 80% 42%)",  // teal
];

function projectVector(scores: number[], basis: PcaBasis): [number, number] {
  const centered = scores.map((s, i) => s - basis.means[i]);
  const x = basis.components[0].reduce((acc, c, i) => acc + c * centered[i], 0);
  const y = basis.components[1].reduce((acc, c, i) => acc + c * centered[i], 0);
  return [x, y];
}

/**
 * Extract a score vector from an analysis matching the given axis order.
 * Returns null if any axis score is missing (book belongs to wrong constellation).
 */
function vectorFromAnalysis(analysis: any, axisOrder: string[]): number[] | null {
  const axes = analysis?.dna?.axes;
  if (!Array.isArray(axes) || axes.length === 0) return null;
  const byId: Record<string, number> = {};
  for (const a of axes) byId[a.id] = Number(a.score);
  const vec = axisOrder.map((id) => byId[id]);
  if (vec.some((v) => v == null || Number.isNaN(v))) return null;
  return vec;
}

/** Ray-casting point-in-polygon. */
function pointInPolygon(px: number, py: number, polygon: { x: number; y: number }[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect =
      (yi > py) !== (yj > py) &&
      px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Andrew's monotone chain — returns convex hull (CCW), no duplicate first point. */
function convexHull(pts: { x: number; y: number }[]): { x: number; y: number }[] {
  if (pts.length < 3) return pts.slice();
  const sorted = [...pts].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const cross = (o: any, a: any, b: any) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: typeof pts = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: typeof pts = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/** Pad a hull outward from its centroid by `pad` px so dots sit fully inside. */
function padHull(hull: { x: number; y: number }[], pad: number): { x: number; y: number }[] {
  if (hull.length === 0) return hull;
  const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length;
  const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length;
  return hull.map((p) => {
    const dx = p.x - cx, dy = p.y - cy;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: p.x + (dx / d) * pad, y: p.y + (dy / d) * pad };
  });
}

const Constellation = ({ shelfBooks, shelfId, onSelect }: ConstellationProps) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<BookType>("fiction");
  const [basis, setBasis] = useState<PcaBasis | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [fingerprint, setFingerprint] = useState<{ x: number; y: number; sourceCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<Point | null>(null);
  const [hoverFingerprint, setHoverFingerprint] = useState(false);
  const [wrapEl, setWrapEl] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const isNarrow = size.w > 0 && size.w < 520;

  // Lasso / clusters
  const clustersEnabled = !!(user && shelfId);
  const [clusterMode, setClusterMode] = useState(false);
  const [drawing, setDrawing] = useState<{ x: number; y: number }[] | null>(null);
  const [pendingMembers, setPendingMembers] = useState<string[] | null>(null); // shelf_book ids inside lasso
  const [draftName, setDraftName] = useState("");
  const [draftColorIdx, setDraftColorIdx] = useState(0);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [hiddenClusters, setHiddenClusters] = useState<Set<string>>(new Set());
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Map cache_key → shelf_book id (so cluster members are stable across re-fetches)
  const shelfBookIdByCacheKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of shelfBooks) if (b.id) m.set(b.cache_key, b.id);
    return m;
  }, [shelfBooks]);

  // Fetch basis + analyses + clusters
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: basisRow } = await supabase
        .from("pca_basis")
        .select("*")
        .eq("book_type", activeTab)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!basisRow || cancelled) {
        setLoading(false);
        return;
      }
      const b: PcaBasis = {
        axis_order: basisRow.axis_order as DnaAxisId[],
        means: basisRow.means as number[],
        components: basisRow.components as number[][],
        x_axis_label: basisRow.x_axis_label,
        y_axis_label: basisRow.y_axis_label,
        seed_corpus: basisRow.seed_corpus as PcaBasis["seed_corpus"],
      };

      const shelfKeys = new Set(shelfBooks.map((s) => s.cache_key));
      const allKeys = Array.from(
        new Set([...b.seed_corpus.map((s) => s.cache_key), ...shelfBooks.map((s) => s.cache_key)]),
      );

      // Grow the reference-dot pool as the user's own shelf grows, on top of
      // (never replacing) the fixed PCA seed_corpus -- the seed_corpus is
      // what the projection's means/components were actually fit on and
      // stays untouched. Source: canon_books titles that already have a
      // plottable, publicly-cached analysis, via a SECURITY DEFINER RPC
      // (canon_books itself is deny-all RLS; the RPC returns only
      // cache_key/title/author for rows that already pass novel_analyses'
      // own public-read policy, no new exposure). Capped 1:1 with shelf
      // size so a small library still sees roughly the plain 50-book
      // reference set and a large one sees proportionally more, up to +100
      // extra so the graph never gets unreadably dense. Skipped entirely
      // for an empty shelf (the cap would be 0 anyway).
      let extraAnchorKeys: string[] = [];
      if (shelfBooks.length > 0) {
        const extraCap = Math.min(shelfBooks.length, 100);
        const { data: candidates } = await supabase.rpc("get_constellation_anchor_candidates", {
          p_book_type: activeTab,
        });
        extraAnchorKeys = ((candidates ?? []) as { cache_key: string; title: string; author: string }[])
          .filter((c) => !allKeys.includes(c.cache_key))
          // Stable, deterministic order (not re-shuffled every load) --
          // simple alphabetical for now; DNA-space-diversity-aware
          // sampling would be a nicer future pass but needs each
          // candidate's vector fetched up front to do well.
          .sort((a, c) => a.title.localeCompare(c.title))
          .slice(0, extraCap)
          .map((c) => c.cache_key);
      }
      const allKeysWithAnchors = Array.from(new Set([...allKeys, ...extraAnchorKeys]));

      const [{ data: analyses }, overridesRes, clustersRes, membersRes] = await Promise.all([
        supabase
          .from("novel_analyses")
          .select("cache_key, title, author, slug, analysis")
          .in("cache_key", allKeysWithAnchors),
        user
          ? supabase
              .from("book_overrides")
              .select("cache_key, axis_overrides")
              .eq("user_id", user.id)
              .in("cache_key", shelfBooks.map((s) => s.cache_key))
          : Promise.resolve({ data: [] as { cache_key: string; axis_overrides: Record<string, number> }[] }),
        clustersEnabled
          ? supabase
              .from("shelf_clusters")
              .select("id, name, color, position")
              .eq("user_id", user!.id)
              .eq("shelf_id", shelfId!)
              .order("position", { ascending: true })
          : Promise.resolve({ data: [] as any[] }),
        clustersEnabled
          ? supabase
              .from("shelf_cluster_members")
              .select("cluster_id, shelf_book_id")
              .eq("user_id", user!.id)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      if (cancelled) return;

      const overridesByKey = new Map<string, Record<string, number>>();
      for (const r of (overridesRes.data ?? []) as { cache_key: string; axis_overrides: Record<string, number> }[]) {
        overridesByKey.set(r.cache_key, r.axis_overrides ?? {});
      }

      // Group fetched rows by normalized title+author identity before
      // plotting. novel_analyses can legitimately hold more than one row
      // for the same real book: analyze-novel writes an "alias" row (no
      // slug) under the raw search string alongside the canonical row (see
      // its cache write comment, "ensures this exact search string is a
      // cache hit next time") whenever the raw input didn't already match
      // what the AI identified as the true title/author (e.g. author was
      // blank at request time) — same identity, two cache_keys. Without
      // this grouping, a book that's both a fixed seed-corpus reference
      // AND on the user's shelf under the other twin cache_key rendered as
      // two dots with the same title (reported live: "Blindness" by José
      // Saramago showing twice). Prefer, per group: the row actually on the
      // shelf (so shelfBookIdByCacheKey / lasso-cluster lookups, which key
      // off the real shelf_books.cache_key, keep resolving), else the
      // canonical row (has a slug), else whichever row has a usable DNA
      // vector.
      const norm = (s: string) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
      type AnalysisRow = { cache_key: string; title: string; author: string; slug: string | null; analysis: any };
      const groups = new Map<string, AnalysisRow[]>();
      for (const row of (analyses ?? []) as AnalysisRow[]) {
        const key = `${norm(row.title)}||${norm(row.author)}`;
        const arr = groups.get(key);
        if (arr) arr.push(row);
        else groups.set(key, [row]);
      }

      const out: Point[] = [];
      const fingerprintVectors: number[][] = [];
      for (const rows of groups.values()) {
        const shelfRow = rows.find((r) => shelfKeys.has(r.cache_key));
        const canonicalRow = rows.find((r) => r.slug);
        const ordered = [shelfRow, canonicalRow, ...rows].filter((r): r is AnalysisRow => !!r);
        const seen = new Set<string>();
        let primary: AnalysisRow | null = null;
        let vec: number[] | null = null;
        for (const candidate of ordered) {
          if (seen.has(candidate.cache_key)) continue;
          seen.add(candidate.cache_key);
          const v = vectorFromAnalysis(candidate.analysis, b.axis_order);
          if (v) {
            primary = candidate;
            vec = v;
            break;
          }
        }
        if (!primary || !vec) continue;

        const [x, y] = projectVector(vec, b);
        const onShelf = !!shelfRow;
        out.push({
          cache_key: primary.cache_key,
          title: primary.title,
          author: primary.author,
          x,
          y,
          isShelf: onShelf,
        });
        if (onShelf) {
          const ov = overridesByKey.get(primary.cache_key);
          const effective = b.axis_order.map((axisId, i) => {
            const o = ov?.[axisId];
            return typeof o === "number" ? o : vec![i];
          });
          fingerprintVectors.push(effective);
        }
      }

      let fp: { x: number; y: number; sourceCount: number } | null = null;
      if (fingerprintVectors.length > 0) {
        const dim = b.axis_order.length;
        const mean = new Array(dim).fill(0);
        for (const v of fingerprintVectors) for (let i = 0; i < dim; i++) mean[i] += v[i];
        for (let i = 0; i < dim; i++) mean[i] /= fingerprintVectors.length;
        const [fx, fy] = projectVector(mean, b);
        fp = { x: fx, y: fy, sourceCount: fingerprintVectors.length };
      }

      // Build clusters
      const memberMap = new Map<string, string[]>();
      for (const m of (membersRes.data ?? []) as { cluster_id: string; shelf_book_id: string }[]) {
        const arr = memberMap.get(m.cluster_id) ?? [];
        arr.push(m.shelf_book_id);
        memberMap.set(m.cluster_id, arr);
      }
      const clusterList: Cluster[] = ((clustersRes.data ?? []) as { id: string; name: string; color: string | null }[]).map(
        (c, i) => ({
          id: c.id,
          name: c.name,
          color: c.color || CLUSTER_COLORS[i % CLUSTER_COLORS.length],
          members: memberMap.get(c.id) ?? [],
        }),
      );

      setBasis(b);
      setPoints(out);
      setFingerprint(fp);
      setClusters(clusterList);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [shelfBooks, user, shelfId, clustersEnabled, activeTab]);

  useEffect(() => {
    if (!wrapEl) return;
    const measure = () => {
      const w = Math.max(1, Math.floor(wrapEl.clientWidth));
      const h = w < 520 ? Math.round(w * 0.95) : Math.max(380, Math.min(640, w * 0.6));
      setSize({ w, h });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrapEl);
    return () => ro.disconnect();
  }, [wrapEl]);

  const { scaled, scaledFingerprint } = useMemo(() => {
    if (points.length === 0 || size.w === 0) {
      return { scaled: [] as (Point & { sx: number; sy: number })[], scaledFingerprint: null as null | { sx: number; sy: number; sourceCount: number } };
    }
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const pad = 0.15;
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const xRange = (xMax - xMin) || 1;
    const yRange = (yMax - yMin) || 1;
    const padX = xRange * pad;
    const padY = yRange * pad;
    const padding = isNarrow ? 28 : 56;
    const W = Math.max(1, size.w - padding * 2);
    const H = Math.max(1, size.h - padding * 2);
    const project = (x: number, y: number) => ({
      sx: padding + ((x - (xMin - padX)) / (xRange + padX * 2)) * W,
      sy: padding + (1 - (y - (yMin - padY)) / (yRange + padY * 2)) * H,
    });
    const scaled = points.map((p) => ({ ...p, ...project(p.x, p.y) }));
    const scaledFingerprint = fingerprint
      ? { ...project(fingerprint.x, fingerprint.y), sourceCount: fingerprint.sourceCount }
      : null;
    return { scaled, scaledFingerprint };
  }, [points, fingerprint, size, isNarrow]);

  // Map shelf_book_id → screen coords (for hull rendering)
  const shelfBookCoords = useMemo(() => {
    const m = new Map<string, { sx: number; sy: number }>();
    for (const p of scaled) {
      if (!p.isShelf) continue;
      const bookId = shelfBookIdByCacheKey.get(p.cache_key);
      if (bookId) m.set(bookId, { sx: p.sx, sy: p.sy });
    }
    return m;
  }, [scaled, shelfBookIdByCacheKey]);

  // ---- Lasso event handlers ----
  const svgPointFromEvent = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onLassoDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!clusterMode || pendingMembers !== null) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrawing([svgPointFromEvent(e)]);
  };
  const onLassoMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drawing) return;
    const p = svgPointFromEvent(e);
    setDrawing((prev) => {
      if (!prev) return prev;
      const last = prev[prev.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) < 3) return prev; // sample throttle
      return [...prev, p];
    });
  };
  const onLassoUp = () => {
    if (!drawing) return;
    const poly = drawing;
    setDrawing(null);
    if (poly.length < 4) return;
    // Find shelf books inside polygon
    const insideIds: string[] = [];
    for (const p of scaled) {
      if (!p.isShelf) continue;
      const bookId = shelfBookIdByCacheKey.get(p.cache_key);
      if (!bookId) continue;
      if (pointInPolygon(p.sx, p.sy, poly)) insideIds.push(bookId);
    }
    if (insideIds.length === 0) {
      toast("Lasso was empty", { description: "Drag around at least one shelf dot." });
      return;
    }
    setPendingMembers(insideIds);
    setDraftName("");
    setDraftColorIdx(clusters.length % CLUSTER_COLORS.length);
  };

  const saveCluster = async () => {
    if (!pendingMembers || !user || !shelfId) return;
    const name = draftName.trim() || `Cluster ${clusters.length + 1}`;
    const color = CLUSTER_COLORS[draftColorIdx];
    // Compute centroid in PCA-space for storage
    const memberPts = pendingMembers
      .map((id) => {
        const ck = [...shelfBookIdByCacheKey.entries()].find(([, v]) => v === id)?.[0];
        return ck ? points.find((p) => p.cache_key === ck) : null;
      })
      .filter((p): p is Point => !!p);
    const cx = memberPts.reduce((s, p) => s + p.x, 0) / Math.max(1, memberPts.length);
    const cy = memberPts.reduce((s, p) => s + p.y, 0) / Math.max(1, memberPts.length);

    const { data: clusterRow, error } = await supabase
      .from("shelf_clusters")
      .insert({
        user_id: user.id,
        shelf_id: shelfId,
        name,
        color,
        position: clusters.length,
        centroid_x: cx,
        centroid_y: cy,
      })
      .select("id")
      .single();
    if (error || !clusterRow) {
      toast.error("Could not save cluster", { description: error?.message });
      return;
    }
    const memberRows = pendingMembers.map((shelf_book_id) => ({
      cluster_id: clusterRow.id,
      shelf_book_id,
      user_id: user.id,
    }));
    const { error: mErr } = await supabase.from("shelf_cluster_members").insert(memberRows);
    if (mErr) {
      toast.error("Saved cluster, but members failed", { description: mErr.message });
    }
    setClusters((prev) => [
      ...prev,
      { id: clusterRow.id, name, color, members: pendingMembers },
    ]);
    setPendingMembers(null);
    setDraftName("");
    toast.success(`Saved "${name}"`, { description: `${pendingMembers.length} books grouped.` });
  };

  const deleteCluster = async (id: string) => {
    if (!user) return;
    await supabase.from("shelf_cluster_members").delete().eq("cluster_id", id).eq("user_id", user.id);
    await supabase.from("shelf_clusters").delete().eq("id", id).eq("user_id", user.id);
    setClusters((prev) => prev.filter((c) => c.id !== id));
    setHiddenClusters((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  };

  const toggleClusterVisibility = (id: string) => {
    setHiddenClusters((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  if (loading) {
    return (
      <div className="ink-border flex h-[420px] items-center justify-center bg-card">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!basis) {
    return (
      <div className="ink-border bg-card p-8">
        <div className="meta text-muted-foreground">Constellation unavailable</div>
        <p className="mt-3 font-serif italic text-muted-foreground">
          The reference map hasn't been computed yet. Check back shortly.
        </p>
      </div>
    );
  }

  const shelfCount = scaled.filter((p) => p.isShelf).length;
  // Actual reference-dot count shown, not just the fixed seed_corpus size --
  // grows with shelf size once the extra canon-book anchors above kick in.
  const referenceCount = scaled.filter((p) => !p.isShelf).length;

  // Build hulls for visible clusters
  const visibleHulls = clusters
    .filter((c) => !hiddenClusters.has(c.id))
    .map((c) => {
      const pts = c.members
        .map((id) => shelfBookCoords.get(id))
        .filter((p): p is { sx: number; sy: number } => !!p)
        .map((p) => ({ x: p.sx, y: p.sy }));
      if (pts.length === 0) return null;
      let hull: { x: number; y: number }[];
      if (pts.length === 1) {
        // single point → small circle hull (12 vertices)
        const [p] = pts;
        hull = Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return { x: p.x + Math.cos(a) * 14, y: p.y + Math.sin(a) * 14 };
        });
      } else if (pts.length === 2) {
        const [a, b] = pts;
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / len * 14, ny = dx / len * 14;
        hull = [
          { x: a.x + nx, y: a.y + ny },
          { x: b.x + nx, y: b.y + ny },
          { x: b.x - nx, y: b.y - ny },
          { x: a.x - nx, y: a.y - ny },
        ];
      } else {
        hull = padHull(convexHull(pts), 16);
      }
      return { cluster: c, hull };
    })
    .filter((h): h is { cluster: Cluster; hull: { x: number; y: number }[] } => !!h);

  return (
    <div className="ink-border bg-card">
      {/* Fiction / Non-fiction tab strip */}
      <div className="flex ink-border-b">
        {(["fiction", "nonfiction"] as BookType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "meta px-4 py-2 capitalize transition-colors first:border-r first:border-foreground",
              activeTab === tab
                ? "bg-foreground text-background"
                : "bg-background text-muted-foreground hover:bg-foreground/10",
            )}
          >
            {tab === "fiction" ? "Fiction" : "Non-fiction"}
          </button>
        ))}
      </div>

      {/* Header strip */}
      <div className="flex items-stretch justify-between ink-border-b">
        <div className="px-4 py-3">
          <div className="meta text-muted-foreground">Fig. 01 — DNA Constellation</div>
          <div className="mt-1 font-serif text-lg italic">
            Your {activeTab === "nonfiction" ? "non-fiction" : "fiction"} shelf, mapped against {referenceCount} canonical books. Click any dot to analyse.
          </div>
        </div>
        <div className="hidden items-center gap-4 border-l border-foreground px-4 py-3 md:flex">
          <div className="meta flex items-center gap-2">
            <span className="inline-block h-2 w-2 bg-primary" /> Shelf · {shelfCount}
          </div>
          <div className="meta flex items-center gap-2 text-muted-foreground">
            <span className="inline-block h-2 w-2 bg-foreground/30" /> Reference
          </div>
          {scaledFingerprint && (
            <div className="meta flex items-center gap-2 text-accent">
              <span className="inline-block h-2 w-2 border border-accent bg-background" /> You
            </div>
          )}
        </div>
      </div>

      {/* Cluster toolbar */}
      {clustersEnabled && (
        <div className="flex flex-wrap items-center justify-between gap-2 ink-border-b bg-background px-4 py-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setClusterMode((v) => !v);
                setDrawing(null);
                setPendingMembers(null);
              }}
              className={cn(
                "meta inline-flex items-center gap-1.5 border px-2.5 py-1 transition-colors",
                clusterMode
                  ? "border-foreground bg-foreground text-background"
                  : "border-foreground bg-background hover:bg-foreground/10",
              )}
            >
              <Lasso className="h-3 w-3" />
              {clusterMode ? "Drawing — drag to lasso" : "Cluster mode"}
            </button>
            {clusterMode && (
              <span className="meta text-muted-foreground">
                Drag a freeform shape around shelf dots, then name the group.
              </span>
            )}
          </div>
          {clusters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {clusters.map((c) => {
                const hidden = hiddenClusters.has(c.id);
                return (
                  <div
                    key={c.id}
                    className={cn(
                      "group meta inline-flex items-center gap-1.5 border border-foreground px-2 py-0.5 transition-opacity",
                      hidden && "opacity-40",
                    )}
                  >
                    <button
                      onClick={() => toggleClusterVisibility(c.id)}
                      className="inline-flex items-center gap-1.5"
                      title={hidden ? "Show cluster" : "Hide cluster"}
                    >
                      <span className="inline-block h-2 w-2" style={{ backgroundColor: c.color }} />
                      <span className="normal-case tracking-normal">{c.name}</span>
                      <span className="text-muted-foreground">· {c.members.length}</span>
                    </button>
                    <button
                      onClick={() => deleteCluster(c.id)}
                      className="ml-1 text-muted-foreground hover:text-accent"
                      title="Delete cluster"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div ref={setWrapEl} className="relative w-full overflow-hidden" style={{ minHeight: 280 }}>
        <svg
          ref={svgRef}
          width={size.w || "100%"}
          height={size.h || 320}
          className="block"
          style={{
            cursor: clusterMode ? (drawing ? "crosshair" : "crosshair") : "default",
            touchAction: clusterMode ? "none" : "auto",
          }}
          onPointerDown={onLassoDown}
          onPointerMove={onLassoMove}
          onPointerUp={onLassoUp}
          onPointerCancel={() => setDrawing(null)}
        >
          {/* Grid */}
          <line x1={(size.w || 1) / 2} y1={24} x2={(size.w || 1) / 2} y2={Math.max(24, (size.h || 1) - 24)} stroke="hsl(var(--foreground) / 0.1)" />
          <line x1={24} y1={(size.h || 1) / 2} x2={Math.max(24, (size.w || 1) - 24)} y2={(size.h || 1) / 2} stroke="hsl(var(--foreground) / 0.1)" />

          {/* Cluster hulls — drawn behind everything */}
          {visibleHulls.map(({ cluster, hull }) => {
            const d =
              "M " +
              hull.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ") +
              " Z";
            // centroid for label
            const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length;
            const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length;
            return (
              <g key={cluster.id} style={{ pointerEvents: "none" }}>
                <path d={d} fill={cluster.color} fillOpacity={0.1} stroke={cluster.color} strokeWidth={1.25} strokeOpacity={0.7} />
                <text
                  x={cx}
                  y={cy - hull.reduce((s, p) => s + Math.abs(p.y - cy), 0) / hull.length - 6}
                  textAnchor="middle"
                  fontFamily="JetBrains Mono, monospace"
                  fontSize={10}
                  fill={cluster.color}
                  style={{ letterSpacing: "0.18em", textTransform: "uppercase" }}
                >
                  {cluster.name}
                </text>
              </g>
            );
          })}

          {/* Active lasso path */}
          {drawing && drawing.length > 1 && (
            <path
              d={"M " + drawing.map((p) => `${p.x},${p.y}`).join(" L ") + " Z"}
              fill="hsl(var(--accent) / 0.08)"
              stroke="hsl(var(--accent))"
              strokeWidth={1.25}
              strokeDasharray="3 3"
              style={{ pointerEvents: "none" }}
            />
          )}

          {/* Points: reference first, then shelf on top */}
          {scaled
            .filter((p) => !p.isShelf)
            .map((p) => {
              const isHovered = hover?.cache_key === p.cache_key;
              const dotR = isNarrow ? 2.5 : 3;
              const hitR = isNarrow ? 12 : 14;
              return (
                <g
                  key={p.cache_key}
                  onMouseEnter={() => setHover(p)}
                  onMouseLeave={() => setHover((h) => (h?.cache_key === p.cache_key ? null : h))}
                  onClick={(e) => {
                    if (clusterMode) return;
                    e.stopPropagation();
                    onSelect?.(p.cache_key, p.title, p.author);
                  }}
                  style={{ cursor: clusterMode ? "crosshair" : "pointer" }}
                >
                  <circle cx={p.sx} cy={p.sy} r={hitR} fill="transparent" />
                  <circle
                    cx={p.sx}
                    cy={p.sy}
                    r={dotR}
                    fill={`hsl(var(--foreground) / ${isHovered ? 0.7 : 0.35})`}
                    stroke={isHovered ? "hsl(var(--background))" : "none"}
                    strokeWidth={1}
                  />
                </g>
              );
            })}
          {scaled
            .filter((p) => p.isShelf)
            .map((p) => {
              const isHovered = hover?.cache_key === p.cache_key;
              const label = p.title.length > 20 ? p.title.slice(0, 18) + "…" : p.title;
              const dotR = isNarrow ? 5 : 6;
              const haloR = isNarrow ? 10 : 13;
              const hitR = isNarrow ? 18 : 22;
              return (
                <g
                  key={p.cache_key}
                  onMouseEnter={() => setHover(p)}
                  onMouseLeave={() => setHover((h) => (h?.cache_key === p.cache_key ? null : h))}
                  onClick={(e) => {
                    if (clusterMode) return;
                    e.stopPropagation();
                    onSelect?.(p.cache_key, p.title, p.author);
                  }}
                  style={{ cursor: clusterMode ? "crosshair" : "pointer" }}
                >
                  {/* Large transparent hit / hover area */}
                  <circle cx={p.sx} cy={p.sy} r={hitR} fill="transparent" />
                  {/* Halo */}
                  <circle
                    cx={p.sx} cy={p.sy} r={haloR}
                    fill={`hsl(var(--primary) / ${isHovered ? 0.32 : 0.18})`}
                  />
                  {/* Core dot */}
                  <circle
                    cx={p.sx} cy={p.sy} r={dotR}
                    fill="hsl(var(--primary))"
                    stroke="hsl(var(--background))"
                    strokeWidth={1.5}
                  />
                  {/* Title label — always visible, bolder on hover */}
                  {!isNarrow && (
                    <text
                      x={p.sx}
                      y={p.sy + haloR + 5}
                      textAnchor="middle"
                      dominantBaseline="hanging"
                      fontFamily="'JetBrains Mono', ui-monospace, monospace"
                      fontSize={9}
                      fill={`hsl(var(--foreground) / ${isHovered ? 0.9 : 0.55})`}
                      style={{ letterSpacing: "0.04em", pointerEvents: "none" } as React.CSSProperties}
                    >
                      {label}
                    </text>
                  )}
                </g>
              );
            })}

          {/* Reading fingerprint */}
          {scaledFingerprint && (
            <g
              onMouseEnter={() => setHoverFingerprint(true)}
              onMouseLeave={() => setHoverFingerprint(false)}
              className="cursor-help"
            >
              <circle
                cx={scaledFingerprint.sx}
                cy={scaledFingerprint.sy}
                r={isNarrow ? 14 : 18}
                fill="hsl(var(--accent) / 0.08)"
                stroke="hsl(var(--accent) / 0.4)"
                strokeDasharray="2 3"
              />
              <line x1={scaledFingerprint.sx - 8} y1={scaledFingerprint.sy} x2={scaledFingerprint.sx + 8} y2={scaledFingerprint.sy} stroke="hsl(var(--accent))" strokeWidth={1.25} />
              <line x1={scaledFingerprint.sx} y1={scaledFingerprint.sy - 8} x2={scaledFingerprint.sx} y2={scaledFingerprint.sy + 8} stroke="hsl(var(--accent))" strokeWidth={1.25} />
              <circle cx={scaledFingerprint.sx} cy={scaledFingerprint.sy} r={2.5} fill="hsl(var(--accent))" />
            </g>
          )}

          {/* Axis labels — SVG text so rotation is exact and never clipped */}
          {size.w > 0 && size.h > 0 && (
            <>
              <text
                x={size.w / 2}
                y={size.h - (isNarrow ? 5 : 7)}
                textAnchor="middle"
                fill="hsl(var(--muted-foreground))"
                fontFamily="'JetBrains Mono', ui-monospace, monospace"
                fontSize={isNarrow ? 9 : 10}
                style={{ letterSpacing: "0.18em", textTransform: "uppercase" } as React.CSSProperties}
                pointerEvents="none"
              >
                {`← ${basis.x_axis_label} →`}
              </text>
              <text
                x={isNarrow ? 10 : 14}
                y={size.h / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="hsl(var(--muted-foreground))"
                fontFamily="'JetBrains Mono', ui-monospace, monospace"
                fontSize={isNarrow ? 9 : 10}
                style={{ letterSpacing: "0.18em", textTransform: "uppercase" } as React.CSSProperties}
                transform={`rotate(-90, ${isNarrow ? 10 : 14}, ${size.h / 2})`}
                pointerEvents="none"
              >
                {`← ${basis.y_axis_label} →`}
              </text>
            </>
          )}
        </svg>

        {/* Hover card */}
        {hover && !clusterMode && (() => {
          const pt = scaled.find((p) => p.cache_key === hover.cache_key);
          if (!pt) return null;
          const cardW = isNarrow ? Math.min(220, size.w - 16) : 240;
          const left = Math.max(8, Math.min(Math.max(8, size.w - cardW - 8), pt.sx + 12));
          const top = Math.max(8, Math.min(Math.max(8, size.h - 90), pt.sy - 48));
          return (
            <div
              className="pointer-events-none absolute z-10 ink-border bg-background px-3 py-2 shadow-none"
              style={{ left, top, width: cardW }}
            >
              <div className="meta text-muted-foreground">
                {hover.isShelf ? "On your shelf" : "Canonical · click to analyse"}
              </div>
              <div className="font-serif text-base italic leading-tight">{hover.title}</div>
              <div className="meta mt-0.5 text-muted-foreground">
                {hover.author && hover.author !== "Unknown" ? hover.author : "—"}
              </div>
            </div>
          );
        })()}

        {/* Fingerprint hover card */}
        {hoverFingerprint && scaledFingerprint && !clusterMode && (() => {
          const cardW = isNarrow ? Math.min(220, size.w - 16) : 240;
          const left = Math.max(8, Math.min(Math.max(8, size.w - cardW - 8), scaledFingerprint.sx + 12));
          const top = Math.max(8, Math.min(Math.max(8, size.h - 90), scaledFingerprint.sy - 56));
          return (
            <div
              className="pointer-events-none absolute z-10 ink-border bg-background px-3 py-2"
              style={{ left, top, width: cardW }}
            >
              <div className="meta text-accent">Your reading fingerprint</div>
              <div className="font-serif text-base italic leading-tight">
                Centroid of {scaledFingerprint.sourceCount} {scaledFingerprint.sourceCount === 1 ? "book" : "books"}
              </div>
              <div className="meta mt-0.5 text-muted-foreground">
                Drag DNA sliders on any analysis to shift this dot.
              </div>
            </div>
          );
        })()}

        {/* Naming modal — appears after lasso captures dots */}
        {pendingMembers && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-foreground/30 p-4">
            <div className="ink-border w-full max-w-sm bg-background">
              <div className="ink-border-b flex items-center justify-between px-4 py-2">
                <div className="meta text-muted-foreground">New cluster</div>
                <button
                  onClick={() => setPendingMembers(null)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3 px-4 py-3">
                <p className="font-serif text-sm italic">
                  Grouping {pendingMembers.length} {pendingMembers.length === 1 ? "book" : "books"} from your lasso.
                </p>
                <div>
                  <label className="meta block text-muted-foreground">Name</label>
                  <input
                    autoFocus
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveCluster();
                      if (e.key === "Escape") setPendingMembers(null);
                    }}
                    placeholder="e.g. Cold modernists"
                    className="mt-1 w-full border border-foreground bg-background px-2 py-1.5 font-serif italic outline-none focus:bg-card"
                  />
                </div>
                <div>
                  <label className="meta block text-muted-foreground">Color</label>
                  <div className="mt-1 flex gap-1.5">
                    {CLUSTER_COLORS.map((col, i) => (
                      <button
                        key={col}
                        onClick={() => setDraftColorIdx(i)}
                        className={cn(
                          "h-6 w-6 border transition-all",
                          draftColorIdx === i ? "border-foreground scale-110" : "border-foreground/30",
                        )}
                        style={{ backgroundColor: col }}
                        aria-label={`Color ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="ink-border-t flex justify-end gap-0">
                <button
                  onClick={() => setPendingMembers(null)}
                  className="meta border-r border-foreground bg-background px-3 py-2 hover:bg-foreground/10"
                >
                  Cancel
                </button>
                <button
                  onClick={saveCluster}
                  className="meta bg-foreground px-3 py-2 text-background hover:bg-ink-blue"
                >
                  Save cluster
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer / legend */}
      <div className="ink-border-t grid grid-cols-12 gap-0 text-foreground">
        <div className="col-span-12 px-4 py-3 md:col-span-6 md:border-r md:border-foreground">
          <div className="meta text-muted-foreground">How to read this</div>
          <p className="mt-1 font-serif text-sm italic text-muted-foreground">
            Each dot is one book, projected from{" "}
            {activeTab === "nonfiction" ? "12 non-fiction" : "12 literary"} DNA axes onto a fixed 2D map.
            Distance ≈ formal kinship.
          </p>
        </div>
        <div className="col-span-12 px-4 py-3 md:col-span-6">
          <div className="meta text-muted-foreground">Axes</div>
          <p className="mt-1 font-serif text-sm italic">
            Horizontal: <span className="not-italic">{basis.x_axis_label}</span> · Vertical:{" "}
            <span className="not-italic">{basis.y_axis_label}</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Constellation;
