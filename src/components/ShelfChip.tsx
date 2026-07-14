import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookmarkPlus, Library, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { RatingControl } from "@/components/RatingControl";
import { NovelAnalysis } from "@/lib/novel-types";
import { cn } from "@/lib/utils";

type ReadingStatus = "want" | "reading" | "finished";

type ShelfRow = {
  id: string;
  status: ReadingStatus;
  rating: number | null;
  started_at: string | null;
  finished_at: string | null;
  note: string | null;
};

interface Props {
  analysis: NovelAnalysis;
  cacheKey: string | null;
}

const STATUS_LABEL: Record<ReadingStatus, string> = {
  want: "○ Want to read",
  reading: "● Reading",
  finished: "✓ Finished",
};

/**
 * Shelf chip: shown on an analysed book.
 * - Signed-out → "Save to shelf" (routes to /auth?next=/)
 * - Signed-in & not saved → "+ Add to shelf"
 * - Signed-in & saved → status cycle (want → reading → finished) + 0–10
 *   rating (once finished) + shelf link + remove.
 */
export const ShelfChip = ({ analysis, cacheKey }: Props) => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [row, setRow] = useState<ShelfRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [shelfId, setShelfId] = useState<string | null>(null);

  // Look up the user's default shelf and this book's row on it
  useEffect(() => {
    if (!user || !cacheKey) {
      setRow(null);
      setShelfId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: shelves } = await supabase
        .from("shelves")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_default", true)
        .limit(1);
      const sid = shelves?.[0]?.id ?? null;
      if (cancelled) return;
      setShelfId(sid);
      if (!sid) {
        setRow(null);
        return;
      }
      const { data: existing } = await supabase
        .from("shelf_books")
        .select("id, status, rating, started_at, finished_at, note")
        .eq("shelf_id", sid)
        .eq("cache_key", cacheKey)
        .maybeSingle();
      if (!cancelled) setRow((existing as ShelfRow | null) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, cacheKey]);

  const addToShelf = async () => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth?next=/");
      return;
    }
    if (!cacheKey || !shelfId) {
      toast.error("Couldn't add to shelf yet — try again in a moment.");
      return;
    }
    setBusy(true);
    try {
      const { data: inserted, error } = await supabase
        .from("shelf_books")
        .insert({
          user_id: user.id,
          shelf_id: shelfId,
          cache_key: cacheKey,
          title: analysis.title,
          author: analysis.author || "",
        })
        .select("id, status, rating, started_at, finished_at, note")
        .maybeSingle();
      if (error) throw error;
      setRow((inserted as ShelfRow | null) ?? null);
      toast.success("Added to your shelf");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update shelf");
    } finally {
      setBusy(false);
    }
  };

  const removeFromShelf = async () => {
    if (!user || !cacheKey || !shelfId || !row) return;
    const removed = row;
    setBusy(true);
    try {
      const { error } = await supabase.from("shelf_books").delete().eq("id", removed.id);
      if (error) throw error;
      setRow(null);
      toast.success("Removed from your shelf", {
        description: removed.note ? "Your note was removed too." : undefined,
        action: {
          label: "Undo",
          onClick: async () => {
            const { data: restored, error: restoreError } = await supabase
              .from("shelf_books")
              .insert({
                user_id: user.id,
                shelf_id: shelfId,
                cache_key: cacheKey,
                title: analysis.title,
                author: analysis.author || "",
                note: removed.note,
                status: removed.status,
                started_at: removed.started_at,
                finished_at: removed.finished_at,
                rating: removed.rating,
              })
              .select("id, status, rating, started_at, finished_at, note")
              .maybeSingle();
            if (restoreError || !restored) {
              toast.error("Couldn't restore");
              return;
            }
            setRow(restored as ShelfRow);
            toast.success("Restored to your shelf");
          },
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update shelf");
    } finally {
      setBusy(false);
    }
  };

  const cycleStatus = async () => {
    if (!row) return;
    const order: ReadingStatus[] = ["want", "reading", "finished"];
    const next = order[(order.indexOf(row.status) + 1) % order.length];
    const started_at =
      next === "reading" ? (row.started_at ?? new Date().toISOString())
      : next === "want" ? null
      : row.started_at;
    const finished_at = next === "finished" ? new Date().toISOString() : null;
    const prev = row;
    setRow({ ...row, status: next, started_at, finished_at });
    const { error } = await supabase
      .from("shelf_books")
      .update({ status: next, started_at, finished_at })
      .eq("id", row.id);
    if (error) {
      setRow(prev);
      toast.error("Couldn't update status");
    }
  };

  const setRating = async (rating: number | null) => {
    if (!row) return;
    const prev = row;
    setRow({ ...row, rating });
    const { error } = await supabase.from("shelf_books").update({ rating }).eq("id", row.id);
    if (error) {
      setRow(prev);
      toast.error("Couldn't save rating");
    }
  };

  // ── Not saved (or signed out): single add button + shelf link ────────────
  if (!row) {
    return (
      <div className="flex items-stretch border border-foreground">
        <button
          onClick={addToShelf}
          disabled={busy}
          className="meta flex items-center gap-2 bg-card px-3 py-2 transition-colors hover:bg-foreground hover:text-background disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookmarkPlus className="h-3 w-3" />}
          {!user ? "Save to shelf" : "Add to shelf"}
        </button>
        {user && (
          <Link
            to="/shelf"
            className="meta flex items-center gap-1 border-l border-foreground bg-card px-3 py-2 hover:bg-foreground hover:text-background"
            aria-label="Open shelf"
          >
            <Library className="h-3 w-3" /> Shelf
          </Link>
        )}
      </div>
    );
  }

  // ── Saved: status · rating (finished only) · shelf · remove ──────────────
  return (
    <div className="flex items-stretch border border-foreground">
      <button
        onClick={cycleStatus}
        disabled={busy}
        title="Click to cycle: want → reading → finished"
        className={cn(
          "meta flex items-center gap-2 px-3 py-2 transition-colors disabled:opacity-50",
          row.status === "finished" && "bg-primary text-primary-foreground hover:bg-foreground hover:text-background",
          row.status === "reading" && "bg-accent text-accent-foreground hover:bg-foreground hover:text-background",
          row.status === "want" && "bg-card hover:bg-foreground hover:text-background",
        )}
      >
        {STATUS_LABEL[row.status]}
      </button>
      {row.status === "finished" && (
        <div className="flex items-center border-l border-foreground bg-card px-2">
          <RatingControl value={row.rating} onChange={setRating} disabled={busy} className="border-0 px-1" />
        </div>
      )}
      <Link
        to="/shelf"
        className="meta flex items-center gap-1 border-l border-foreground bg-card px-3 py-2 hover:bg-foreground hover:text-background"
        aria-label="Open shelf"
      >
        <Library className="h-3 w-3" /> Shelf
      </Link>
      <button
        onClick={removeFromShelf}
        disabled={busy}
        aria-label="Remove from shelf"
        title="Remove from shelf"
        className="flex items-center border-l border-foreground bg-card px-2 transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
};
