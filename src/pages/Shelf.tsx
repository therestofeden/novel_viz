import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeftRight, Loader2, LogOut, Sparkles, Trash2 } from "lucide-react";
import { NovelVizLogo } from "@/components/NovelVizLogo";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import Constellation from "@/components/Constellation";

type ReadingStatus = "want" | "reading" | "finished";

type ShelfBook = {
  id: string;
  cache_key: string;
  title: string;
  author: string;
  note: string | null;
  added_at: string;
  status: ReadingStatus;
  finished_at: string | null;
  rating: number | null;
};

const Shelf = () => {
  const { session, user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [books, setBooks] = useState<ShelfBook[]>([]);
  const [busy, setBusy] = useState(true);
  const [displayName, setDisplayName] = useState<string>("");
  const [defaultShelfId, setDefaultShelfId] = useState<string | null>(null);
  // cache_key -> slug, so clicking a book (list or graph) can jump straight to
  // its own /book/:slug page instead of routing through the home page's
  // title-based re-analysis flow (which visually looked like "jumping back
  // home" and re-ran a fresh lookup instead of opening the already-cached
  // analysis directly).
  const [slugByCacheKey, setSlugByCacheKey] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!loading && !session) navigate("/auth?next=/shelf", { replace: true });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      const [{ data: shelfBooks }, { data: profile }, { data: shelfRow }] = await Promise.all([
        supabase
          .from("shelf_books")
          .select("id, cache_key, title, author, note, added_at, status, finished_at, rating")
          .order("added_at", { ascending: false }),
        supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
        supabase
          .from("shelves")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_default", true)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setBooks((shelfBooks ?? []) as ShelfBook[]);
      setDisplayName(profile?.display_name || user.email?.split("@")[0] || "Reader");
      setDefaultShelfId(shelfRow?.id ?? null);
      setBusy(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Resolve each shelf book's slug so we can link straight to /book/:slug.
  // Keyed on the cache_key set (not `books` itself) so a status change or
  // removal doesn't re-trigger this — only an actual change in which books
  // are on the shelf does. A book missing a slug (rare — only pre-slug
  // legacy rows or a non-validated analysis) falls back to the old
  // title-based route.
  const cacheKeysSignature = books.map((b) => b.cache_key).sort().join(",");
  useEffect(() => {
    if (books.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("novel_analyses")
        .select("cache_key, slug")
        .in("cache_key", books.map((b) => b.cache_key))
        .eq("is_validated", true);
      if (cancelled || !data) return;
      const m = new Map<string, string>();
      for (const row of data) {
        if (row.slug) m.set(row.cache_key, row.slug);
      }
      setSlugByCacheKey(m);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKeysSignature]);

  // Single source of truth for "open this book" from either the graph or the
  // list — prefers the direct /book/:slug route (opens the cached analysis
  // immediately) and only falls back to the home page's re-analysis flow
  // when we don't have a resolved slug for this cache_key.
  const openBook = (cacheKey: string, title: string) => {
    const slug = slugByCacheKey.get(cacheKey);
    navigate(slug ? `/book/${slug}` : `/?book=${encodeURIComponent(title)}`);
  };

  const removeBook = async (id: string) => {
    const prev = books;
    setBooks((b) => b.filter((x) => x.id !== id));
    const { error } = await supabase.from("shelf_books").delete().eq("id", id);
    if (error) {
      setBooks(prev);
      toast.error("Couldn't remove book");
    } else {
      toast.success("Removed from shelf");
    }
  };

  const cycleStatus = async (book: ShelfBook) => {
    const order: ReadingStatus[] = ["want", "reading", "finished"];
    const next = order[(order.indexOf(book.status) + 1) % order.length];
    const finished_at = next === "finished" ? new Date().toISOString() : null;
    const prev = books;
    setBooks((bs) => bs.map((b) => (b.id === book.id ? { ...b, status: next, finished_at } : b)));
    const { error } = await supabase
      .from("shelf_books")
      .update({ status: next, finished_at })
      .eq("id", book.id);
    if (error) {
      setBooks(prev);
      toast.error("Couldn't update status");
    }
  };

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
            to="/"
            className="group flex items-center gap-3 border-r border-foreground px-4 py-4 transition-colors hover:bg-foreground hover:text-background"
          >
            <NovelVizLogo size={48} className="text-foreground transition-colors group-hover:text-[#5ba3d9]" />
            <div className="leading-none">
              <div className="font-sans text-xl font-bold tracking-tight">NovelViz</div>
              <div className="meta mt-1 text-muted-foreground">Visualize any book</div>
            </div>
          </Link>
          <div className="flex items-stretch">
            <Link
              to="/anti-shelf"
              className="meta flex items-center gap-2 border-l border-foreground px-4 py-4 hover:bg-primary hover:text-primary-foreground"
            >
              <Sparkles className="h-3.5 w-3.5" /> Anti-Shelf
            </Link>
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
          <div className="meta text-muted-foreground">No. 002</div>
          <div className="display-num mt-2 text-5xl md:text-7xl">
            {String(books.length).padStart(2, "0")}
          </div>
          <div className="meta mt-3 text-muted-foreground">Books on shelf</div>
        </aside>

        <div className="col-span-12 px-4 py-10 md:col-span-10 md:px-10 md:py-16">
          <div className="meta mb-6 flex items-center gap-3 text-muted-foreground">
            <span className="inline-block h-2 w-2 bg-primary" />
            The Reader's Shelf
            <span className="inline-block h-px w-12 bg-foreground/40" />
            {displayName}
          </div>

          <h1 className="text-balance font-sans text-4xl font-bold leading-[0.95] tracking-tight md:text-6xl">
            Your<br />
            <span className="italic font-serif font-normal">collected</span><br />
            <span className="text-primary">readings.</span>
          </h1>

          {busy ? (
            <div className="mt-12 flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="meta text-muted-foreground">Loading shelf…</span>
            </div>
          ) : books.length === 0 ? (
            <div className="mt-12 ink-border bg-card p-8">
              <div className="meta text-muted-foreground">Empty shelf</div>
              <p className="mt-3 max-w-xl font-serif text-base italic text-muted-foreground">
                You haven't saved anything yet. Analyse a book and click <em>+ Add to shelf</em>.
              </p>
              <Link
                to="/"
                className="meta mt-6 inline-flex items-center border border-foreground bg-foreground px-4 py-2 text-background hover:bg-primary"
              >
                → Find a book
              </Link>
            </div>
          ) : (
            <>
              <div className="mt-12">
                <div className="ink-border border-b-0 flex items-center justify-between bg-card px-4 py-2.5">
                  <div className="meta text-muted-foreground">
                    Tip: click a dot to open it · use <span className="text-foreground">Compare</span> in the nav to compare two books side by side
                  </div>
                </div>
                <Constellation
                  shelfId={defaultShelfId}
                  shelfBooks={books.map((b) => ({
                    id: b.id,
                    cache_key: b.cache_key,
                    title: b.title,
                    author: b.author,
                  }))}
                  onSelect={(cacheKey, title) => openBook(cacheKey, title)}
                />
              </div>

              <div className="meta mt-12 mb-4 flex items-center gap-3 text-muted-foreground">
                <span className="inline-block h-2 w-2 bg-foreground" />
                The list
                <span className="inline-block h-px w-12 bg-foreground/40" />
                {books.length} {books.length === 1 ? "title" : "titles"}
              </div>
              <div className="ink-border">
              {books.map((b, i) => (
                <div
                  key={b.id}
                  className={cn(
                    "group grid grid-cols-12 items-baseline gap-4 px-4 py-4 transition-colors hover:bg-foreground hover:text-background",
                    i > 0 && "border-t border-foreground/30",
                  )}
                >
                  <div className="meta col-span-2 md:col-span-1 text-muted-foreground group-hover:text-background/60">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="col-span-10 md:col-span-7">
                    <div className="font-serif text-lg italic">{b.title}</div>
                    <div className="meta mt-1 flex flex-wrap items-center gap-2 text-muted-foreground group-hover:text-background/70">
                      <span>{b.author && b.author !== "Unknown" ? b.author : "—"}</span>
                      <span className="text-foreground/30 group-hover:text-background/30">·</span>
                      <button
                        onClick={(e) => { e.preventDefault(); cycleStatus(b); }}
                        className={cn(
                          "meta border px-1.5 py-0.5 transition-colors",
                          b.status === "finished" && "border-primary text-primary group-hover:border-background group-hover:text-background",
                          b.status === "reading" && "border-accent text-accent group-hover:border-background group-hover:text-background",
                          b.status === "want" && "border-foreground/40 text-foreground/60 group-hover:border-background/60 group-hover:text-background/60",
                        )}
                        title="Click to cycle status"
                      >
                        {b.status === "finished" ? "✓ Finished" : b.status === "reading" ? "● Reading" : "○ Want to read"}
                      </button>
                      {b.status === "finished" && b.finished_at && (
                        <span className="text-foreground/40 group-hover:text-background/50">
                          {new Date(b.finished_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="col-span-12 flex items-center justify-end gap-2 md:col-span-4">
                    <Link
                      to={
                        slugByCacheKey.get(b.cache_key)
                          ? `/book/${slugByCacheKey.get(b.cache_key)}`
                          : `/?book=${encodeURIComponent(b.title)}`
                      }
                      className="meta border border-foreground bg-card px-3 py-1.5 text-foreground hover:bg-primary hover:text-primary-foreground"
                    >
                      → Open
                    </Link>
                    <button
                      onClick={() => removeBook(b.id)}
                      className="meta inline-flex items-center gap-1 border border-foreground bg-card px-3 py-1.5 text-foreground hover:bg-accent hover:text-accent-foreground"
                      aria-label="Remove from shelf"
                    >
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  </div>
                </div>
              ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Shelf;
