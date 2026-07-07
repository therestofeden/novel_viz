import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookmarkPlus, BookmarkCheck, Loader2, Library } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { NovelAnalysis } from "@/lib/novel-types";
import { cn } from "@/lib/utils";

interface Props {
  analysis: NovelAnalysis;
  cacheKey: string | null;
}

/**
 * Shelf chip: shown on an analysed book.
 * - Signed-out → "Save to shelf" (routes to /auth?next=/)
 * - Signed-in & not saved → "+ Add to shelf"
 * - Signed-in & saved → "✓ On your shelf"
 */
export const ShelfChip = ({ analysis, cacheKey }: Props) => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shelfId, setShelfId] = useState<string | null>(null);

  // Look up the user's default shelf and whether this book is on it
  useEffect(() => {
    if (!user || !cacheKey) {
      setSaved(false);
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
        setSaved(false);
        return;
      }
      const { data: existing } = await supabase
        .from("shelf_books")
        .select("id")
        .eq("shelf_id", sid)
        .eq("cache_key", cacheKey)
        .limit(1);
      if (!cancelled) setSaved(!!existing?.length);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, cacheKey]);

  const handleClick = async () => {
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
      if (saved) {
        // Fetch what's on the row before deleting it — the shelf_books row is
        // also where the reader's note (and status/rating) live, so a single
        // click here would otherwise destroy them silently with no recourse.
        const { data: existingRow } = await supabase
          .from("shelf_books")
          .select("note, status, finished_at, rating")
          .eq("shelf_id", shelfId)
          .eq("cache_key", cacheKey)
          .maybeSingle();
        const { error } = await supabase
          .from("shelf_books")
          .delete()
          .eq("shelf_id", shelfId)
          .eq("cache_key", cacheKey);
        if (error) throw error;
        setSaved(false);
        toast.success("Removed from your shelf", {
          description: existingRow?.note ? "Your note was removed too." : undefined,
          action: {
            label: "Undo",
            onClick: async () => {
              const { error: restoreError } = await supabase.from("shelf_books").insert({
                user_id: user.id,
                shelf_id: shelfId,
                cache_key: cacheKey,
                title: analysis.title,
                author: analysis.author || "",
                note: existingRow?.note ?? null,
                status: existingRow?.status ?? "want",
                finished_at: existingRow?.finished_at ?? null,
                rating: existingRow?.rating ?? null,
              });
              if (restoreError) {
                toast.error("Couldn't restore");
                return;
              }
              setSaved(true);
              toast.success("Restored to your shelf");
            },
          },
        });
      } else {
        const { error } = await supabase.from("shelf_books").insert({
          user_id: user.id,
          shelf_id: shelfId,
          cache_key: cacheKey,
          title: analysis.title,
          author: analysis.author || "",
        });
        if (error) throw error;
        setSaved(true);
        toast.success("Added to your shelf");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update shelf");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-stretch border border-foreground">
      <button
        onClick={handleClick}
        disabled={busy}
        className={cn(
          "meta flex items-center gap-2 px-3 py-2 transition-colors disabled:opacity-50",
          saved
            ? "bg-foreground text-background hover:bg-accent hover:text-accent-foreground"
            : "bg-card hover:bg-foreground hover:text-background",
        )}
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : saved ? (
          <BookmarkCheck className="h-3 w-3" />
        ) : (
          <BookmarkPlus className="h-3 w-3" />
        )}
        {!user ? "Save to shelf" : saved ? "On your shelf" : "Add to shelf"}
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
};
