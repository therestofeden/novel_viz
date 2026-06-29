import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeftRight, Loader2, LogOut, RefreshCw, Sparkles, ThumbsUp, ThumbsDown, Ban, X } from "lucide-react";
import { NovelVizLogo } from "@/components/NovelVizLogo";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { BuyButton, prewarmBuyLinks } from "@/components/BuyButton";

// Stable identifier for a recommended book (matches edge function side).
const recKeyOf = (title: string, author: string) =>
  `${(title || "").toLowerCase().trim()}|${(author || "").toLowerCase().trim()}`;

type Mode = "similar" | "stretch";

type Recommendation = {
  title: string;
  author: string;
  one_liner: string;
  tags: string[];
  echoes: string[];
};

type Payload = {
  mode: Mode;
  rationale: string;
  recommendations: Recommendation[];
};

type LoadState = {
  loading: boolean;
  payload: Payload | null;
  generated_at: string | null;
  cached: boolean;
  error: string | null;
};

const initial: LoadState = {
  loading: false,
  payload: null,
  generated_at: null,
  cached: false,
  error: null,
};

const AntiShelf = () => {
  const { session, loading: authLoading, signOut, geminiKey } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("similar");
  const [shelfCount, setShelfCount] = useState<number | null>(null);
  const [byMode, setByMode] = useState<Record<Mode, LoadState>>({
    similar: initial,
    stretch: initial,
  });

  // Per-rec-key 👍/👎 signal (1 or -1). Keyed by recKeyOf(title, author).
  const [feedback, setFeedback] = useState<Record<string, 1 | -1>>({});
  // Persistent blocks: authors and tags the user never wants to see again.
  const [blockedAuthors, setBlockedAuthors] = useState<Set<string>>(new Set());
  const [blockedTags, setBlockedTags] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading && !session) navigate("/auth?next=/anti-shelf", { replace: true });
  }, [authLoading, session, navigate]);

  // Get shelf count for the gating message
  useEffect(() => {
    if (!session) return;
    supabase
      .from("shelf_books")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => setShelfCount(count ?? 0));
  }, [session]);

  // Hydrate feedback + blocks from DB
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const [fbRes, blRes] = await Promise.all([
        supabase.from("recommendation_feedback").select("rec_key, signal"),
        supabase.from("recommendation_blocks").select("block_type, value"),
      ]);
      if (cancelled) return;
      const fb: Record<string, 1 | -1> = {};
      for (const r of (fbRes.data ?? []) as { rec_key: string; signal: number }[]) {
        fb[r.rec_key] = r.signal === 1 ? 1 : -1;
      }
      setFeedback(fb);
      const a = new Set<string>(), t = new Set<string>();
      for (const b of (blRes.data ?? []) as { block_type: string; value: string }[]) {
        if (b.block_type === "author") a.add(b.value);
        else if (b.block_type === "tag") t.add(b.value);
      }
      setBlockedAuthors(a);
      setBlockedTags(t);
    })();
    return () => { cancelled = true; };
  }, [session]);

  const setRecFeedback = async (rec: Recommendation, signal: 1 | -1) => {
    if (!session?.user) return;
    const key = recKeyOf(rec.title, rec.author);
    const prev = feedback[key];
    setFeedback((f) => {
      const next = { ...f };
      if (prev === signal) delete next[key]; else next[key] = signal;
      return next;
    });
    if (prev === signal) {
      await supabase
        .from("recommendation_feedback")
        .delete()
        .eq("user_id", session.user.id)
        .eq("rec_key", key);
    } else {
      await supabase
        .from("recommendation_feedback")
        .upsert(
          { user_id: session.user.id, rec_key: key, title: rec.title, author: rec.author, signal },
          { onConflict: "user_id,rec_key" },
        );
    }
  };

  const blockAuthor = async (author: string) => {
    if (!session?.user || !author || author === "Unknown") return;
    setBlockedAuthors((s) => new Set(s).add(author));
    await supabase
      .from("recommendation_blocks")
      .upsert(
        { user_id: session.user.id, block_type: "author", value: author },
        { onConflict: "user_id,block_type,value" },
      );
    toast(`Blocked author: ${author}`, { description: "Hidden from future picks." });
  };

  const unblock = async (type: "author" | "tag", value: string) => {
    if (!session?.user) return;
    if (type === "author") {
      setBlockedAuthors((s) => { const n = new Set(s); n.delete(value); return n; });
    } else {
      setBlockedTags((s) => { const n = new Set(s); n.delete(value); return n; });
    }
    await supabase
      .from("recommendation_blocks")
      .delete()
      .eq("user_id", session.user.id)
      .eq("block_type", type)
      .eq("value", value);
  };

  const fetchMode = async (m: Mode, force = false) => {
    setByMode((s) => ({ ...s, [m]: { ...s[m], loading: true, error: null } }));
    try {
      // Send feedback + blocks so the prompt can incorporate them; included in cache signature too.
      const liked = Object.entries(feedback).filter(([, v]) => v === 1).map(([k]) => k);
      const disliked = Object.entries(feedback).filter(([, v]) => v === -1).map(([k]) => k);
      const { data, error } = await supabase.functions.invoke("recommend-anti-shelf", {
        body: {
          mode: m,
          force,
          liked,
          disliked,
          blocked_authors: Array.from(blockedAuthors),
          blocked_tags: Array.from(blockedTags),
          ...(geminiKey ? { gemini_key: geminiKey } : {}),
        },
      });
      if (error) {
        // supabase-js wraps non-2xx as error; try to surface server message
        const msg =
          (error as any)?.context?.body?.error || error.message || "Request failed";
        throw new Error(msg);
      }
      setByMode((s) => ({
        ...s,
        [m]: {
          loading: false,
          payload: data?.payload ?? null,
          generated_at: data?.generated_at ?? null,
          cached: !!data?.cached,
          error: null,
        },
      }));
    } catch (err: any) {
      setByMode((s) => ({
        ...s,
        [m]: { ...s[m], loading: false, error: err.message || "Failed to load" },
      }));
      toast.error(err.message || "Couldn't load recommendations");
    }
  };

  // Auto-fetch the active tab on first view
  useEffect(() => {
    if (!session || shelfCount === null || shelfCount === 0) return;
    if (!byMode[mode].payload && !byMode[mode].loading && !byMode[mode].error) {
      fetchMode(mode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, shelfCount, mode]);

  // Pre-warm buy-link resolution as soon as picks render so every click is instant.
  useEffect(() => {
    const recs = byMode[mode].payload?.recommendations;
    if (recs?.length) {
      prewarmBuyLinks(recs.map((r) => ({ title: r.title, author: r.author })));
    }
  }, [byMode, mode]);

  const current = byMode[mode];

  const generatedLabel = useMemo(() => {
    if (!current.generated_at) return null;
    const d = new Date(current.generated_at);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }, [current.generated_at]);

  if (authLoading || !session) {
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
          <div className="flex items-stretch">
            <Link
              to="/compare"
              className="meta flex items-center gap-2 border-l border-foreground px-4 py-4 hover:bg-foreground hover:text-background"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" /> Compare
            </Link>
            <button
              onClick={async () => {
                await signOut();
                navigate("/");
              }}
              className="meta flex items-center gap-2 border-l border-foreground px-4 py-4 hover:bg-foreground hover:text-background"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto grid grid-cols-12 gap-0">
        <aside className="col-span-12 ink-border-b border-foreground px-4 py-6 md:col-span-2 md:border-b-0 md:border-r md:py-12">
          <div className="meta text-muted-foreground">No. 003</div>
          <div className="display-num mt-2 text-5xl md:text-7xl">
            {String(current.payload?.recommendations?.length ?? 0).padStart(2, "0")}
          </div>
          <div className="meta mt-3 text-muted-foreground">
            {mode === "similar" ? "Kindred picks" : "Stretch picks"}
          </div>
        </aside>

        <div className="col-span-12 px-4 py-10 md:col-span-10 md:px-10 md:py-16">
          <div className="meta mb-6 flex items-center gap-3 text-muted-foreground">
            <span className="inline-block h-2 w-2 bg-primary" />
            The Anti-Shelf
            <span className="inline-block h-px w-12 bg-foreground/40" />
            Generated from your shelf's DNA
          </div>

          <h1 className="text-balance font-sans text-4xl font-bold leading-[0.95] tracking-tight md:text-6xl">
            Books<br />
            <span className="italic font-serif font-normal">you haven't</span><br />
            <span className="text-primary">read yet.</span>
          </h1>

          {/* Tabs */}
          <div className="mt-12 ink-border flex">
            {(["similar", "stretch"] as Mode[]).map((m, i) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "meta flex-1 px-5 py-4 transition-colors",
                  i === 1 && "border-l border-foreground",
                  mode === m
                    ? "bg-foreground text-background"
                    : "bg-card text-foreground hover:bg-foreground/10",
                )}
              >
                {m === "similar" ? "01 / More like this" : "02 / Stretch picks"}
              </button>
            ))}
          </div>

          {/* Status row */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <div className="meta text-muted-foreground">
              {current.loading
                ? "Generating…"
                : current.payload
                ? generatedLabel
                  ? `Generated ${generatedLabel}${current.cached ? " · cached" : ""}`
                  : "Ready"
                : "Idle"}
            </div>
            <button
              onClick={() => fetchMode(mode, true)}
              disabled={current.loading || shelfCount === 0}
              className="meta inline-flex items-center gap-2 border border-foreground bg-card px-3 py-1.5 text-foreground hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3 w-3", current.loading && "animate-spin")} />
              Regenerate
            </button>
          </div>

          {/* Body */}
          {shelfCount === 0 ? (
            <div className="mt-10 ink-border bg-card p-8">
              <div className="meta text-muted-foreground">Empty shelf</div>
              <p className="mt-3 max-w-xl font-serif text-base italic text-muted-foreground">
                The Anti-Shelf reads from your shelf's DNA. Add at least one analysed book first.
              </p>
              <Link
                to="/"
                className="meta mt-6 inline-flex items-center border border-foreground bg-foreground px-4 py-2 text-background hover:bg-primary"
              >
                → Find a book
              </Link>
            </div>
          ) : current.loading && !current.payload ? (
            <div className="mt-10 ink-border bg-card p-8">
              <div className="flex items-center gap-3">
                <Sparkles className="h-4 w-4 animate-pulse text-primary" />
                <span className="meta text-muted-foreground">
                  Reading the shape of your shelf…
                </span>
              </div>
            </div>
          ) : current.error ? (
            <div className="mt-10 ink-border bg-card p-8">
              <div className="meta text-accent">Error</div>
              <p className="mt-3 font-serif text-base italic">{current.error}</p>
            </div>
          ) : current.payload ? (
            <>
              {current.payload.rationale && (
                <p className="mt-10 max-w-3xl font-serif text-xl italic leading-snug">
                  &ldquo;{current.payload.rationale}&rdquo;
                </p>
              )}

              {/* Active blocks strip */}
              {(blockedAuthors.size > 0 || blockedTags.size > 0) && (
                <div className="mt-8 ink-border bg-card px-4 py-3">
                  <div className="meta mb-2 flex items-center gap-2 text-muted-foreground">
                    <Ban className="h-3 w-3" /> Blocked from future picks
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(blockedAuthors).map((a) => (
                      <button
                        key={`a-${a}`}
                        onClick={() => unblock("author", a)}
                        className="meta inline-flex items-center gap-1 border border-accent bg-background px-2 py-0.5 text-accent hover:bg-accent hover:text-accent-foreground"
                      >
                        ✕ Author: {a}
                      </button>
                    ))}
                    {Array.from(blockedTags).map((t) => (
                      <button
                        key={`t-${t}`}
                        onClick={() => unblock("tag", t)}
                        className="meta inline-flex items-center gap-1 border border-accent bg-background px-2 py-0.5 text-accent hover:bg-accent hover:text-accent-foreground"
                      >
                        ✕ Tag: {t}
                      </button>
                    ))}
                  </div>
                  <div className="meta mt-2 text-muted-foreground">
                    Hit <span className="text-foreground">Regenerate</span> to apply changes.
                  </div>
                </div>
              )}

              <div className="meta mt-10 mb-4 flex items-center gap-3 text-muted-foreground">
                <span className="inline-block h-2 w-2 bg-foreground" />
                The picks
                <span className="inline-block h-px w-12 bg-foreground/40" />
                {current.payload.recommendations.length} titles
                <span className="text-foreground/30">·</span>
                <span className="text-foreground/60">
                  Your taste signal feeds the next regeneration
                </span>
              </div>

              <div className="ink-border grid grid-cols-1 md:grid-cols-2">
                {current.payload.recommendations.map((rec, i) => {
                  const key = recKeyOf(rec.title, rec.author);
                  const sig = feedback[key];
                  return (
                    <div
                      key={`${rec.title}-${i}`}
                      className={cn(
                        "group relative block p-6",
                        i % 2 === 1 && "md:border-l md:border-foreground",
                        i >= 2 && "border-t border-foreground",
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="meta text-muted-foreground">
                          {String(i + 1).padStart(2, "0")}
                        </div>
                        <div className="flex items-center gap-2">
                          <BuyButton title={rec.title} author={rec.author} variant="ghost" />
                          <Link
                            to={`/?book=${encodeURIComponent(rec.title)}`}
                            className="meta border border-foreground bg-card px-2 py-1 hover:bg-foreground hover:text-background"
                          >
                            → Analyse
                          </Link>
                        </div>
                      </div>
                      <div className="mt-3 font-serif text-2xl italic leading-tight">
                        {rec.title}
                      </div>
                      <div className="meta mt-2 text-muted-foreground">{rec.author}</div>
                      <p className="mt-4 font-serif text-base leading-snug">{rec.one_liner}</p>
                      {rec.tags?.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-1.5">
                          {rec.tags.map((t) => (
                            <span
                              key={t}
                              className="meta border border-foreground/40 px-2 py-0.5 text-foreground/70"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      {rec.echoes?.length > 0 && (
                        <div className="meta mt-4 text-muted-foreground">
                          {mode === "similar" ? "Echoes:" : "Diverges from:"}{" "}
                          <span className="italic">{rec.echoes.join(" · ")}</span>
                        </div>
                      )}
                      {/* Feedback row */}
                      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-foreground/20 pt-3">
                        <button
                          onClick={() => setRecFeedback(rec, 1)}
                          className={cn(
                            "meta inline-flex items-center gap-1 border px-2 py-1 transition-colors",
                            sig === 1
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-foreground/40 hover:border-foreground hover:bg-foreground hover:text-background",
                          )}
                          aria-label="More like this"
                        >
                          <ThumbsUp className="h-3 w-3" /> More
                        </button>
                        <button
                          onClick={() => setRecFeedback(rec, -1)}
                          className={cn(
                            "meta inline-flex items-center gap-1 border px-2 py-1 transition-colors",
                            sig === -1
                              ? "border-accent bg-accent text-accent-foreground"
                              : "border-foreground/40 hover:border-foreground hover:bg-foreground hover:text-background",
                          )}
                          aria-label="Less like this"
                        >
                          <ThumbsDown className="h-3 w-3" /> Less
                        </button>
                        {rec.author && rec.author !== "Unknown" && !blockedAuthors.has(rec.author) && (
                          <button
                            onClick={() => blockAuthor(rec.author)}
                            className="meta ml-auto inline-flex items-center gap-1 border border-foreground/30 px-2 py-1 text-foreground/60 hover:border-accent hover:bg-accent hover:text-accent-foreground"
                            aria-label="Block this author"
                            title="Never recommend this author again"
                          >
                            <Ban className="h-3 w-3" /> Block author
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
};

export default AntiShelf;
