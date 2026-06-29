import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeftRight, ChevronDown, Loader2, X } from "lucide-react";
import { NovelVizLogo } from "@/components/NovelVizLogo";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  DNA_AXIS_IDS,
  DNA_AXIS_META,
  NF_DNA_AXIS_IDS,
  NF_DNA_AXIS_META,
  type DnaAxisId,
  type NfDnaAxisId,
  type FictionAnalysis,
  type NovelAnalysis,
  normalizeAnalysis,
  isFiction,
} from "@/lib/novel-types";
import { CompareNetworks } from "@/components/CompareNetworks";

type ShelfBook = {
  id: string;
  cache_key: string;
  title: string;
  author: string;
};

type Loaded = {
  cache_key: string;
  title: string;
  author: string;
  analysis: NovelAnalysis;
};

const Compare = () => {
  const { session, user, loading } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [shelf, setShelf] = useState<ShelfBook[]>([]);
  const [busy, setBusy] = useState(true);
  const [a, setA] = useState<Loaded | null>(null);
  const [b, setB] = useState<Loaded | null>(null);
  const [loadingSlot, setLoadingSlot] = useState<"a" | "b" | null>(null);

  // Auth gate
  useEffect(() => {
    if (!loading && !session) navigate("/auth?next=/compare", { replace: true });
  }, [loading, session, navigate]);

  // Load shelf
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      const { data } = await supabase
        .from("shelf_books")
        .select("id, cache_key, title, author")
        .order("added_at", { ascending: false });
      if (cancelled) return;
      setShelf(data ?? []);
      setBusy(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const loadInto = async (slot: "a" | "b", cacheKey: string) => {
    setLoadingSlot(slot);
    const { data, error } = await supabase
      .from("novel_analyses")
      .select("cache_key, title, author, analysis")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    setLoadingSlot(null);
    if (error || !data) {
      toast.error("Couldn't load analysis");
      return;
    }
    const loaded: Loaded = {
      cache_key: data.cache_key,
      title: data.title,
      author: data.author,
      analysis: normalizeAnalysis(data.analysis as Record<string, unknown>),
    };
    if (slot === "a") setA(loaded);
    else setB(loaded);

    // Sync URL
    const next = new URLSearchParams(params);
    next.set(slot, cacheKey);
    setParams(next, { replace: true });
  };

  const clearSlot = (slot: "a" | "b") => {
    if (slot === "a") setA(null);
    else setB(null);
    const next = new URLSearchParams(params);
    next.delete(slot);
    setParams(next, { replace: true });
  };

  // Hydrate from URL once shelf is loaded
  useEffect(() => {
    if (busy) return;
    const aKey = params.get("a");
    const bKey = params.get("b");
    if (aKey && !a && !loadingSlot) loadInto("a", aKey);
    if (bKey && !b && !loadingSlot) loadInto("b", bKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Dateline strip */}
      <div className="dateline-strip">
        <span>NovelViz</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>Visualize any book</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>Est. 2024</span>
      </div>
      {/* Masthead */}
      <header className="ink-border-b">
        <div className="container mx-auto flex items-stretch justify-between">
          <Link
            to="/shelf"
            className="group flex items-center gap-3 border-r border-foreground px-4 py-4 transition-colors hover:bg-foreground hover:text-background"
          >
            <NovelVizLogo size={48} className="text-foreground transition-colors group-hover:text-[#5ba3d9]" />
            <div className="leading-none">
              <div className="font-sans text-xl font-bold tracking-tight">NovelViz</div>
              <div className="meta mt-1 text-muted-foreground">← My shelf</div>
            </div>
          </Link>
          <div className="meta flex items-center gap-2 border-l border-foreground px-4 py-4">
            <ArrowLeftRight className="h-3.5 w-3.5" /> Compare
          </div>
        </div>
      </header>

      <main className="container mx-auto grid grid-cols-12 gap-0">
        <aside className="col-span-12 ink-border-b border-foreground px-4 py-6 md:col-span-2 md:border-b-0 md:border-r md:py-12">
          <div className="meta text-muted-foreground">Books in view</div>
          <div className="display-num mt-2 text-5xl md:text-7xl">
            {String([a, b].filter(Boolean).length).padStart(2, "0")}
          </div>
        </aside>

        <div className="col-span-12 px-4 py-10 md:col-span-10 md:px-10 md:py-16">
          <div className="meta mb-6 flex items-center gap-3 text-muted-foreground">
            <span className="inline-block h-2 w-2 bg-primary" />
            Compare two readings
          </div>

          <h1 className="text-balance font-sans text-4xl font-bold leading-[0.95] tracking-tight md:text-6xl">
            Two books,<br />
            <span className="italic font-serif font-normal">side by side.</span><br />
            <span className="text-primary">Where they meet, where they split.</span>
          </h1>

          {/* Slot pickers */}
          <div className="mt-12 grid grid-cols-1 gap-0 ink-border md:grid-cols-2">
            <SlotPicker
              label="A"
              shelf={shelf}
              loaded={a}
              busy={busy}
              loading={loadingSlot === "a"}
              onPick={(ck) => loadInto("a", ck)}
              onClear={() => clearSlot("a")}
              border="md:border-r md:border-foreground"
            />
            <SlotPicker
              label="B"
              shelf={shelf}
              loaded={b}
              busy={busy}
              loading={loadingSlot === "b"}
              onPick={(ck) => loadInto("b", ck)}
              onClear={() => clearSlot("b")}
              border="border-t border-foreground md:border-t-0"
            />
          </div>

          {/* Diff body */}
          <div className="mt-10">
            {a && b ? (
              <DiffBody a={a} b={b} />
            ) : (
              <div className="ink-border bg-card p-8">
                <div className="meta text-muted-foreground">Awaiting selection</div>
                <p className="mt-3 max-w-xl font-serif italic text-muted-foreground">
                  Pick one book on each side. The DNA, characters and lanes will diff in place — no
                  reload, no spoilers introduced.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

// --------------- Slot picker -----------------------------------------------

interface SlotPickerProps {
  label: string;
  shelf: ShelfBook[];
  loaded: Loaded | null;
  busy: boolean;
  loading: boolean;
  onPick: (cacheKey: string) => void;
  onClear: () => void;
  border: string;
}

const SlotPicker = ({ label, shelf, loaded, busy, loading, onPick, onClear, border }: SlotPickerProps) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("relative bg-card", border)}>
      <div className="flex items-center justify-between border-b border-foreground/30 px-4 py-3">
        <div className="meta text-muted-foreground">Slot {label}</div>
        {loaded && (
          <button
            onClick={onClear}
            className="meta inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>
      <div className="px-4 py-5">
        {loaded ? (
          <div>
            <div className="font-serif text-2xl italic leading-tight">{loaded.title}</div>
            <div className="meta mt-2 text-muted-foreground">
              {loaded.author && loaded.author !== "Unknown" ? loaded.author : "—"}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setOpen((o) => !o)}
            disabled={busy || loading || shelf.length === 0}
            className={cn(
              "meta flex w-full items-center justify-between border border-foreground bg-background px-3 py-2 text-foreground hover:bg-foreground hover:text-background",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            <span>
              {loading
                ? "Loading…"
                : shelf.length === 0
                ? "Shelf empty — add books first"
                : `Choose from your shelf (${shelf.length})`}
            </span>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {open && !loaded && shelf.length > 0 && (
        <div className="absolute left-0 right-0 z-20 mx-4 mb-4 max-h-72 overflow-y-auto ink-border bg-background">
          {shelf.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                onPick(s.cache_key);
                setOpen(false);
              }}
              className="block w-full border-b border-foreground/20 px-3 py-2 text-left last:border-b-0 hover:bg-foreground hover:text-background"
            >
              <div className="font-serif text-base italic">{s.title}</div>
              <div className="meta mt-0.5 text-muted-foreground">
                {s.author && s.author !== "Unknown" ? s.author : "—"}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// --------------- Diff body -------------------------------------------------

interface DiffBodyProps {
  a: Loaded;
  b: Loaded;
}

// Lookup axis meta from either fiction or NF dictionaries
function getAxisMeta(id: string) {
  return (
    DNA_AXIS_META[id as DnaAxisId] ??
    NF_DNA_AXIS_META[id as NfDnaAxisId] ?? { name: id, low: "", high: "", description: "" }
  );
}

const DiffBody = ({ a, b }: DiffBodyProps) => {
  const aAxes = useMemo(() => indexAxes(a.analysis), [a]);
  const bAxes = useMemo(() => indexAxes(b.analysis), [b]);

  // Build ordered axis list from both books' actual DNA axes
  // (preserves canonical order: fiction axes first, then NF)
  const allAxisIds = useMemo(() => {
    const ids = new Set<string>();
    for (const ax of a.analysis.dna?.axes ?? []) ids.add(ax.id);
    for (const ax of b.analysis.dna?.axes ?? []) ids.add(ax.id);
    const canonical = [...DNA_AXIS_IDS, ...NF_DNA_AXIS_IDS] as string[];
    const ordered = canonical.filter((id) => ids.has(id));
    // Append any unrecognised axis IDs at the end
    for (const id of ids) if (!ordered.includes(id)) ordered.push(id);
    return ordered;
  }, [a, b]);

  // Per-axis deltas
  const rows = allAxisIds.map((id) => {
    const av = aAxes.get(id)?.score ?? null;
    const bv = bAxes.get(id)?.score ?? null;
    const delta = av != null && bv != null ? Math.abs(av - bv) : null;
    return { id, meta: getAxisMeta(id), a: av, b: bv, delta };
  });

  const validDeltas = rows.filter((r) => r.delta != null) as Array<typeof rows[number] & { delta: number }>;
  const meanDelta =
    validDeltas.length > 0
      ? validDeltas.reduce((s, r) => s + r.delta, 0) / validDeltas.length
      : 0;
  const kinship = Math.max(0, Math.min(100, Math.round(100 - meanDelta)));

  const sharedAxes = [...validDeltas].sort((x, y) => x.delta - y.delta).slice(0, 3);
  const divergentAxes = [...validDeltas].sort((x, y) => y.delta - x.delta).slice(0, 3);

  return (
    <div className="space-y-10">
      {/* Verdict bar */}
      <div className="ink-border bg-card">
        <div className="grid grid-cols-12">
          <div className="col-span-12 border-b border-foreground px-4 py-4 md:col-span-4 md:border-b-0 md:border-r">
            <div className="meta text-muted-foreground">Kinship score</div>
            <div className="display-num mt-1 text-6xl text-primary">{kinship}</div>
            <div className="meta mt-1 text-muted-foreground">/100 · 12-axis mean closeness</div>
          </div>
          <div className="col-span-12 border-b border-foreground px-4 py-4 md:col-span-4 md:border-b-0 md:border-r">
            <div className="meta text-muted-foreground">Closest on</div>
            <ul className="mt-2 space-y-1 font-serif text-base italic">
              {sharedAxes.map((r) => (
                <li key={r.id}>
                  {r.meta.name} <span className="meta not-italic text-muted-foreground">· Δ{r.delta}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="col-span-12 px-4 py-4 md:col-span-4">
            <div className="meta text-muted-foreground">Furthest on</div>
            <ul className="mt-2 space-y-1 font-serif text-base italic">
              {divergentAxes.map((r) => (
                <li key={r.id}>
                  {r.meta.name} <span className="meta not-italic text-accent">· Δ{r.delta}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Side-by-side networks + archetype matches */}
      <CompareNetworks a={a} b={b} />

      {/* DNA diff table */}
      <div>
        <div className="meta mb-4 flex items-center gap-3 text-muted-foreground">
          <span className="inline-block h-2 w-2 bg-foreground" />
          Axis by axis
        </div>
        <div className="ink-border bg-card">
          <div className="grid grid-cols-12 border-b border-foreground bg-foreground text-background">
            <div className="meta col-span-4 px-3 py-2">Axis</div>
            <div className="meta col-span-3 px-3 py-2 text-right">A · {a.title}</div>
            <div className="meta col-span-3 px-3 py-2 text-right">B · {b.title}</div>
            <div className="meta col-span-2 px-3 py-2 text-right">Δ</div>
          </div>
          {rows.map((r, i) => {
            const isShared = sharedAxes.some((s) => s.id === r.id);
            const isDivergent = divergentAxes.some((s) => s.id === r.id);
            return (
              <div
                key={r.id}
                className={cn(
                  "grid grid-cols-12 items-center",
                  i > 0 && "border-t border-foreground/30",
                )}
              >
                <div className="col-span-4 px-3 py-3">
                  <div className="font-sans text-sm font-medium">{r.meta.name}</div>
                  <div className="meta mt-1 text-muted-foreground">
                    {r.meta.low} ↔ {r.meta.high}
                  </div>
                </div>
                <ScoreCell value={r.a} />
                <ScoreCell value={r.b} />
                <div
                  className={cn(
                    "meta col-span-2 px-3 py-3 text-right",
                    isDivergent && "text-accent",
                    isShared && "text-primary",
                  )}
                >
                  {r.delta != null ? r.delta : "—"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cast & lanes */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <SidePanel side="A" loaded={a} />
        <SidePanel side="B" loaded={b} />
      </div>
    </div>
  );
};

const ScoreCell = ({ value }: { value: number | null }) => {
  if (value == null) return <div className="meta col-span-3 px-3 py-3 text-right text-muted-foreground">—</div>;
  return (
    <div className="col-span-3 px-3 py-3">
      <div className="flex items-center justify-end gap-3">
        <div className="relative h-1 w-24 bg-muted md:w-40">
          <div
            className="absolute inset-y-0 left-0 bg-foreground"
            style={{ width: `${value}%` }}
          />
        </div>
        <div className="meta w-8 text-right">{value}</div>
      </div>
    </div>
  );
};

const SidePanel = ({ side, loaded }: { side: string; loaded: Loaded }) => {
  const fiction = isFiction(loaded.analysis) ? loaded.analysis : null;
  const chars = fiction?.characters ?? [];
  const lanes = fiction?.lanes ?? [];
  const events = fiction?.events ?? [];
  return (
    <div className="ink-border bg-card">
      <div className="border-b border-foreground px-4 py-3">
        <div className="meta text-muted-foreground">Side {side}</div>
        <div className="font-serif text-xl italic leading-tight">{loaded.title}</div>
      </div>
      <div className="grid grid-cols-3 border-b border-foreground/30">
        <Stat label="Characters" value={chars.length} />
        <Stat label="Lanes" value={lanes.length} bordered />
        <Stat label="Events" value={events.length} bordered />
      </div>
      <div className="px-4 py-3">
        <div className="meta text-muted-foreground">Lanes</div>
        <ul className="mt-2 space-y-1 font-serif text-sm italic">
          {lanes.slice(0, 6).map((l) => (
            <li key={l.id}>{l.name}</li>
          ))}
          {lanes.length === 0 && <li className="text-muted-foreground not-italic meta">—</li>}
        </ul>
      </div>
    </div>
  );
};

const Stat = ({ label, value, bordered }: { label: string; value: number; bordered?: boolean }) => (
  <div className={cn("px-4 py-3", bordered && "border-l border-foreground/30")}>
    <div className="meta text-muted-foreground">{label}</div>
    <div className="display-num mt-1 text-3xl">{String(value).padStart(2, "0")}</div>
  </div>
);

function indexAxes(an: NovelAnalysis) {
  const m = new Map<string, { score: number; evidence: string }>();
  for (const a of an.dna?.axes ?? []) m.set(a.id, { score: a.score, evidence: a.evidence });
  return m;
}

export default Compare;
