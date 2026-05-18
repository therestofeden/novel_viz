import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface Pin {
  id: string;
  cache_key: string;
  character_id: string;
  character_name: string;
  note: string;
  created_at: string;
  updated_at: string;
}

/**
 * Per-book pin store. Loads pins for the current user + cacheKey,
 * exposes upsert and delete with optimistic updates.
 */
export function usePins(cacheKey: string | null) {
  const { user } = useAuth();
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !cacheKey) {
      setPins([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("pinned_characters")
        .select("id, cache_key, character_id, character_name, note, created_at, updated_at")
        .eq("cache_key", cacheKey)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      setLoading(false);
      if (!error && data) setPins(data as Pin[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, cacheKey]);

  const upsertPin = useCallback(
    async (characterId: string, characterName: string, note: string) => {
      if (!user) {
        toast.error("Sign in to pin characters");
        return null;
      }
      if (!cacheKey) return null;
      const existing = pins.find((p) => p.character_id === characterId);
      // optimistic
      if (existing) {
        setPins((prev) =>
          prev.map((p) => (p.id === existing.id ? { ...p, note, updated_at: new Date().toISOString() } : p)),
        );
        const { error } = await supabase
          .from("pinned_characters")
          .update({ note })
          .eq("id", existing.id);
        if (error) {
          toast.error("Couldn't update pin");
          return null;
        }
        return existing.id;
      }
      const optimistic: Pin = {
        id: `tmp-${Date.now()}`,
        cache_key: cacheKey,
        character_id: characterId,
        character_name: characterName,
        note,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setPins((prev) => [optimistic, ...prev]);
      const { data, error } = await supabase
        .from("pinned_characters")
        .insert({
          user_id: user.id,
          cache_key: cacheKey,
          character_id: characterId,
          character_name: characterName,
          note,
        })
        .select("id, cache_key, character_id, character_name, note, created_at, updated_at")
        .maybeSingle();
      if (error || !data) {
        // rollback
        setPins((prev) => prev.filter((p) => p.id !== optimistic.id));
        toast.error("Couldn't pin");
        return null;
      }
      setPins((prev) => prev.map((p) => (p.id === optimistic.id ? (data as Pin) : p)));
      return (data as Pin).id;
    },
    [user, cacheKey, pins],
  );

  const removePin = useCallback(
    async (characterId: string) => {
      const existing = pins.find((p) => p.character_id === characterId);
      if (!existing) return;
      setPins((prev) => prev.filter((p) => p.id !== existing.id));
      const { error } = await supabase.from("pinned_characters").delete().eq("id", existing.id);
      if (error) {
        toast.error("Couldn't remove pin");
        // restore
        setPins((prev) => [existing, ...prev]);
      }
    },
    [pins],
  );

  return { pins, loading, upsertPin, removePin, isAuthed: !!user };
}
