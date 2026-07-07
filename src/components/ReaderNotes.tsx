import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, Loader2, LogIn, PenLine, Save } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  cacheKey: string | null;
  bookTitle: string;
  bookAuthor?: string;
}

/**
 * Collapsible reading notes panel.
 *
 * States:
 *  - Guest      → nudge to sign in
 *  - Signed in, book not shelved → offer to add to shelf first
 *  - Signed in, book shelved    → editable textarea, auto-saves on blur
 */
export function ReaderNotes({ cacheKey, bookTitle, bookAuthor }: Props) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [shelfId, setShelfId] = useState<string | null>(null);   // shelf_books.id
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Jump to the notes panel from anywhere on the page (mobile FAB) and open it.
  const jumpToNotes = useCallback(() => {
    containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setOpen(true);
  }, []);

  // ── Load note when panel opens ──────────────────────────────────────────────
  useEffect(() => {
    if (!open || !user || !cacheKey) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from("shelf_books")
      .select("id, note")
      .eq("cache_key", cacheKey)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setShelfId(data?.id ?? null);
        setNote(data?.note ?? "");
        setDirty(false);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, user, cacheKey]);

  // ── Debounced auto-save ─────────────────────────────────────────────────────
  const scheduleAutosave = useCallback((value: string) => {
    if (!shelfId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      const { error } = await supabase
        .from("shelf_books")
        .update({ note: value })
        .eq("id", shelfId);
      setSaving(false);
      if (error) toast.error("Couldn't save note");
      else setDirty(false);
    }, 1200);
  }, [shelfId]);

  const handleChange = (value: string) => {
    setNote(value);
    setDirty(true);
    scheduleAutosave(value);
  };

  // ── Save on blur (flush pending debounce) ───────────────────────────────────
  const handleBlur = async () => {
    if (!shelfId || !dirty) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaving(true);
    const { error } = await supabase
      .from("shelf_books")
      .update({ note })
      .eq("id", shelfId);
    setSaving(false);
    if (error) toast.error("Couldn't save note");
    else setDirty(false);
  };

  // ── Add to shelf then enable notes ─────────────────────────────────────────
  const addToShelf = async () => {
    if (!user || !cacheKey) return;
    setLoading(true);
    // Ensure default shelf exists
    const { data: shelfRow } = await supabase
      .from("shelves")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_default", true)
      .maybeSingle();

    const { data: inserted, error } = await supabase
      .from("shelf_books")
      .insert({
        user_id: user.id,
        cache_key: cacheKey,
        title: bookTitle,
        author: bookAuthor || "",
        shelf_id: shelfRow?.id ?? null,
      })
      .select("id")
      .maybeSingle();

    setLoading(false);
    if (error) {
      toast.error("Couldn't add to shelf");
    } else {
      setShelfId(inserted?.id ?? null);
      toast.success("Added to shelf — you can now take notes");
    }
  };

  return (
    <div ref={containerRef} className="ink-border-b scroll-mt-20">
      {/* ── Mobile FAB: thumb-reachable entry point, visible from anywhere ─── */}
      {isMobile && !open && (
        <button
          onClick={jumpToNotes}
          aria-label="Open my notes"
          className="fixed bottom-5 right-4 z-50 flex items-center gap-2 rounded-full border border-foreground bg-foreground px-4 py-3 text-background shadow-lg transition-transform active:scale-95"
          style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
        >
          <PenLine className="h-4 w-4" />
          <span className="meta">Notes</span>
          {note && (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" title="Note saved" />
          )}
        </button>
      )}

      {/* ── Toggle header ─────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-card"
        aria-expanded={open}
      >
        <span className="meta flex items-center gap-2 text-muted-foreground">
          <PenLine className="h-3.5 w-3.5" />
          My Notes
          {note && !open && (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" title="Note saved" />
          )}
        </span>
        <span className="meta flex items-center gap-2 text-muted-foreground">
          {saving && <Loader2 className="h-3 w-3 animate-spin" />}
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </span>
      </button>

      {/* ── Panel body ────────────────────────────────────────────── */}
      {open && (
        <div className="border-t border-foreground/20 bg-card px-4 py-4">

          {/* Guest */}
          {!user && (
            <div className="flex items-start gap-3">
              <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-sans text-sm text-foreground">Sign in to keep reading notes for this book.</p>
                <Link
                  to={`/auth?next=${encodeURIComponent(window.location.pathname + window.location.search)}`}
                  className="meta mt-2 inline-flex items-center gap-1.5 border border-foreground bg-foreground px-3 py-1.5 text-background hover:bg-primary hover:border-primary"
                >
                  <LogIn className="h-3 w-3" /> Sign in
                </Link>
              </div>
            </div>
          )}

          {/* Signed in, loading */}
          {user && loading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="meta">Loading…</span>
            </div>
          )}

          {/* Signed in, not shelved */}
          {user && !loading && shelfId === null && (
            <div className="flex items-start gap-3">
              <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-sans text-sm text-foreground">Add this book to your shelf to take notes.</p>
                <button
                  onClick={addToShelf}
                  className="meta mt-2 inline-flex items-center gap-1.5 border border-foreground bg-foreground px-3 py-1.5 text-background hover:bg-primary hover:border-primary"
                >
                  <Save className="h-3 w-3" /> Add to shelf
                </button>
              </div>
            </div>
          )}

          {/* Signed in, shelved — show editable notes */}
          {user && !loading && shelfId !== null && (
            <div className="space-y-2">
              <textarea
                value={note}
                onChange={(e) => handleChange(e.target.value)}
                onBlur={handleBlur}
                placeholder="Your thoughts, favourite quotes, questions to revisit…"
                rows={5}
                className={cn(
                  "w-full resize-y bg-background font-serif text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-none",
                  "border border-foreground/30 px-3 py-2 focus:border-foreground",
                )}
              />
              <div className="meta flex items-center gap-2 text-muted-foreground">
                {saving ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>
                ) : dirty ? (
                  <><span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block" /> Unsaved</>
                ) : note ? (
                  <><span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" /> Saved</>
                ) : (
                  "Auto-saves as you type"
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
