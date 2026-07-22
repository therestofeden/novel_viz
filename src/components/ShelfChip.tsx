import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookmarkPlus, Library, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { RatingControl } from "@/components/RatingControl";
import { NovelAnalysis } from "@/lib/novel-types";
import { cn, normalizeForSearch } from "@/lib/utils";

type ReadingStatus = "want" | "reading" | "finished";

type ShelfRow = {
  id: string;
  status: ReadingStatus;
  rating: number | null;
  started_at: string | null;
  finished_at: string | null;
  note: string | null;
};

type ShelfBookLookupRow = ShelfRow & { cache_key: string; title: string; author: string };

const authorSurname = (name: string): string => {
  const parts = normalizeForSearch(name).split(" ");
  return parts[parts.length - 1] ?? "";
};

/**
 * Finds this book's existing row on the shelf, if any. Matches by
 * normalized title (+ author surname when both sides have one) instead of
 * an exact cache_key match — cache_key embeds whatever author string a
 * given analysis run happened to return, and that can drift for the same
 * book across separate analyses (e.g. "" vs "John Steinbeck"), which used
 * to let the same title silently get added to the shelf twice. Falls back
 * to an exact cache_key match first, since it's the most precise signal
 * when available.
 */
function findShelfRow(
  rows: ShelfBookLookupRow[],
  title: string,
  author: string | null | undefined,
  cacheKey: string | null,
): ShelfBookLookupRow | null {
  if (cacheKey) {
    const byCacheKey = rows.find((r) => r.cache_key === cacheKey);
    if (byCacheKey) return byCacheKey;
  }

  const normTitle = normalizeForSearch(title);
  const candidates = rows.filter((r) => normalizeForSearch(r.title) === normTitle);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // Multiple rows share this normalized title — disambiguate by author
  // surname when we have one on both sides; otherwise just take the first.
  if (author && author.trim() && author !== "Unknown") {
    const authorMatch = candidates.find((r) => normalizeForSearch(r.author).includes(authorSurname(author)));
    if (authorMatch) return authorMatch;
  }
  return candidates[0];
}

interface Props {
  analysis: NovelAnalysis;
  cacheKey: string | null;
}

// Reading-status word choices — shared with Shelf.tsx's list view (imports
// STATUS_WORD) so the label can never drift between the two places a status
// is shown, the way "Finished" vs a separately-hardcoded copy once could.
export const STATUS_WORD: Record<ReadingStatus, string> = {
  want: "Want to read",
  reading: "Reading",
  finished: "Read",
};

const STATUS_LABEL: Record<ReadingStatus, string> = {
  want: `○ ${STATUS_WORD.want}`,
  reading: `● ${STATUS_WORD.reading}`,
  finished: `✓ ${STATUS_WORD.finished}`,
};

/**
 * Shelf chip: shown on an analysed book.
 * - Signed-out → "Save to shelf" (routes to /auth?next=/)
 * - Signed-in & not saved → explicit "✓ Read" / "○ Want to read" choice —
 *   always writes status/started_at/finished_at explicitly (see the
 *   2026-07-22 note on addToShelf: never rely on the shelf_books.status
 *   column default).
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
      const { data: existingRows } = await supabase
        .from("shelf_books")
        .select("id, cache_key, title, author, status, rating, started_at, finished_at, note")
        .eq("shelf_id", sid);
      if (cancelled) return;
      const match = findShelfRow((existingRows as ShelfBookLookupRow[] | null) ?? [], analysis.title, analysis.author, cacheKey);
      setRow(match);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, cacheKey, analysis.title, analysis.author]);

  // 2026-07-22 (Stefano: "the add to library - read - want to read thing is
  // confusing"): this insert used to omit `status` entirely and rely on the
  // shelf_books.status column default — which was 'finished', a leftover
  // from before the want/reading/finished lifecycle existed (the table's
  // original migration, 002_shelf_foundations, predates rating_0_10_and_
  // started_at by over a week). Effect in production: every "Add to shelf"
  // click silently created a row marked already-read — with no
  // started_at/finished_at (a combination cycling through the UI can never
  // actually produce), the rating control exposed immediately, and no way
  // to say "I just want to read this later" without noticing afterwards and
  // clicking through the status pill. Confirmed via query: 49 of the 52
  // shelf_books rows in production carry exactly that fingerprint
  // (status='finished' AND started_at IS NULL AND finished_at IS NULL).
  // Fixed on both ends: the column default is now 'want' (see the
  // accompanying migration), and this function always passes status
  // explicitly, taken from an explicit user choice — "✓ Read" or "○ Want to
  // read" — shown at add time instead of one undifferentiated button.
  const addToShelf = async (status: ReadingStatus) => {
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
    const now = new Date().toISOString();
    try {
      const { data: inserted, error } = await supabase
        .from("shelf_books")
        .insert({
          user_id: user.id,
          shelf_id: shelfId,
          cache_key: cacheKey,
          title: analysis.title,
          author: analysis.author || "",
          status,
          started_at: status === "finished" ? now : null,
          finished_at: status === "finished" ? now : null,
        })
        .select("id, status, rating, started_at, finished_at, note")
        .maybeSingle();
      if (error) throw error;
      setRow((inserted as ShelfRow | null) ?? null);
      toast.success(status === "finished" ? "Added — marked as read" : "Added to your shelf");
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
    // A rating only makes sense on a finished book — the DB enforces this
    // (CHECK constraint + trigger, see 20260715120000 migration) but we
    // clear it optimistically here too so the UI doesn't show a stale
    // rating for the instant before the round-trip confirms it.
    const rating = next === "finished" ? row.rating : null;
    const prev = row;
    setRow({ ...row, status: next, started_at, finished_at, rating });
    const { error } = await supabase
      .from("shelf_books")
      .update({ status: next, started_at, finished_at, rating })
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

  // ── Not saved: explicit read / want-to-read choice + shelf link ──────────
  // Signed-out visitors still get a single "Save to shelf" (routes through
  // /auth first — there's no shelf to write the choice to yet); signed-in
  // readers get the real choice right away, so the very first click already
  // records what they meant instead of defaulting to anything.
  if (!row) {
    return (
      <div className="flex items-stretch border border-foreground">
        {user ? (
          <>
            <button
              onClick={() => addToShelf("finished")}
              disabled={busy}
              title="Add to shelf, marked as already read"
              className="meta flex items-center gap-2 bg-card px-3 py-2 transition-colors hover:bg-foreground/10 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <span aria-hidden="true">✓</span>} Read
            </button>
            <button
              onClick={() => addToShelf("want")}
              disabled={busy}
              title="Add to shelf, want to read later"
              className="meta flex items-center gap-2 border-l border-foreground bg-card px-3 py-2 transition-colors hover:bg-foreground/10 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <span aria-hidden="true">○</span>} Want to read
            </button>
          </>
        ) : (
          <button
            onClick={() => addToShelf("want")}
            disabled={busy}
            className="meta flex items-center gap-2 bg-card px-3 py-2 transition-colors hover:bg-foreground/10 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookmarkPlus className="h-3 w-3" />}
            Save to shelf
          </button>
        )}
        {user && (
          <Link
            to="/shelf"
            className="meta flex items-center gap-1 border-l border-foreground bg-card px-3 py-2 hover:bg-foreground/10"
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
          row.status === "finished" && "bg-primary text-primary-foreground transition-colors hover:brightness-90",
          row.status === "reading" && "bg-accent text-accent-foreground hover:bg-foreground/10",
          row.status === "want" && "bg-card hover:bg-foreground/10",
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
        className="meta flex items-center gap-1 border-l border-foreground bg-card px-3 py-2 hover:bg-foreground/10"
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
