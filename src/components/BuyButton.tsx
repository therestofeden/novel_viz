import { useState, useCallback } from "react";
import { ShoppingBag, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// Resolved-link shape returned by the resolve-buy-link edge function.
type Resolved = {
  country: string;
  primary: {
    vendor: string;
    name: string;
    kind: "indie" | "chain" | "amazon";
    url: string;
    affiliated: boolean;
  };
  options: Array<{
    vendor: string;
    name: string;
    kind: "indie" | "chain" | "amazon";
    url: string;
    affiliated: boolean;
  }>;
};

// In-memory cache, scoped per (title|author). The country itself is stable
// per session, but we still cache per book so a second click is instant.
const memo = new Map<string, Resolved>();
const inflight = new Map<string, Promise<Resolved>>();

const cacheKey = (title: string, author: string) =>
  `${(title || "").toLowerCase().trim()}|${(author || "").toLowerCase().trim()}`;

async function resolve(title: string, author: string): Promise<Resolved> {
  const k = cacheKey(title, author);
  const hit = memo.get(k);
  if (hit) return hit;
  const pending = inflight.get(k);
  if (pending) return pending;

  const p = (async () => {
    const { data, error } = await supabase.functions.invoke("resolve-buy-link", {
      body: { title, author },
    });
    if (error || !data?.primary?.url) {
      // Hard fallback so the click is never wasted.
      const fallback: Resolved = {
        country: "US",
        primary: {
          vendor: "amazon_com",
          name: "Amazon",
          kind: "amazon",
          url: `https://www.amazon.com/s?k=${encodeURIComponent(title + " " + author)}&i=stripbooks`,
          affiliated: false,
        },
        options: [],
      };
      memo.set(k, fallback);
      return fallback;
    }
    memo.set(k, data as Resolved);
    return data as Resolved;
  })();

  inflight.set(k, p);
  try {
    return await p;
  } finally {
    inflight.delete(k);
  }
}

type Props = {
  title: string;
  author: string;
  // Visual variants — match the Seoul-editorial system. Sharp corners only.
  variant?: "primary" | "ghost";
  size?: "sm" | "md";
  className?: string;
};

export const BuyButton = ({ title, author, variant = "primary", size = "sm", className }: Props) => {
  const [loading, setLoading] = useState(false);
  const [resolved, setResolved] = useState<Resolved | null>(() => memo.get(cacheKey(title, author)) ?? null);

  const onClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Prefer pre-resolved primary (instant). Otherwise resolve now.
      const r = resolved ?? (await (async () => {
        setLoading(true);
        try {
          return await resolve(title, author);
        } finally {
          setLoading(false);
        }
      })());
      setResolved(r);
      // Open in new tab — keep the user in the app.
      window.open(r.primary.url, "_blank", "noopener,noreferrer");
    },
    [title, author, resolved],
  );

  const base =
    "meta inline-flex items-center gap-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const sizing = size === "md" ? "px-3 py-1.5" : "px-2 py-1";
  const skin =
    variant === "primary"
      ? "border border-foreground bg-foreground text-background hover:bg-primary hover:border-primary"
      : "border border-foreground/40 text-foreground hover:bg-foreground hover:text-background";

  const label =
    resolved?.primary?.name
      ? `Buy · ${resolved.primary.name}`
      : "Find at a shop";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      title={
        resolved
          ? `Open ${resolved.primary.name} (${resolved.country})`
          : "Find this book at a local or independent shop"
      }
      className={cn(base, sizing, skin, className)}
      aria-label={label}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <ShoppingBag className="h-3 w-3" />
      )}
      <span>{label}</span>
      <ExternalLink className="h-3 w-3 opacity-60" />
    </button>
  );
};

// Optional: warm the resolver for a list of books (called once after the
// recommendations render). Keeps every subsequent click at 0ms.
export function prewarmBuyLinks(books: Array<{ title: string; author: string }>) {
  for (const b of books) {
    if (!b?.title) continue;
    const k = cacheKey(b.title, b.author || "");
    if (memo.has(k) || inflight.has(k)) continue;
    // Fire-and-forget; ignore errors.
    resolve(b.title, b.author || "").catch(() => {});
  }
}
