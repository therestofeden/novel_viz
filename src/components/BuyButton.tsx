import { useState, useCallback, useRef, useEffect } from "react";
import { ShoppingBag, Loader2, ExternalLink, ChevronDown, Leaf, Store, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Option = {
  vendor: string;
  name: string;
  kind: "indie" | "chain" | "amazon";
  url: string;
  affiliated: boolean;
};

type Resolved = {
  country: string;
  primary: Option;
  options: Option[];
};

// In-memory cache, scoped per (title|author).
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

function KindIcon({ kind }: { kind: Option["kind"] }) {
  if (kind === "indie") return <Leaf className="h-3 w-3 text-green-600" />;
  if (kind === "chain") return <Store className="h-3 w-3 text-muted-foreground" />;
  return <Package className="h-3 w-3 text-muted-foreground" />;
}

function KindLabel({ kind }: { kind: Option["kind"] }) {
  if (kind === "indie") return <span className="text-green-700 dark:text-green-400">indie</span>;
  if (kind === "chain") return <span className="text-muted-foreground">chain</span>;
  return <span className="text-muted-foreground">amazon</span>;
}

type Props = {
  title: string;
  author: string;
  variant?: "primary" | "ghost";
  size?: "sm" | "md";
  className?: string;
};

export const BuyButton = ({ title, author, variant = "primary", size = "sm", className }: Props) => {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [resolved, setResolved] = useState<Resolved | null>(() => memo.get(cacheKey(title, author)) ?? null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Pre-resolve on hover — so the first click is always instant.
  const onMouseEnter = useCallback(() => {
    if (!resolved) {
      resolve(title, author).then(setResolved).catch(() => {});
    }
  }, [title, author, resolved]);

  // Close dropdown when clicking outside.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const onClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      let r = resolved;
      if (!r) {
        setLoading(true);
        try {
          r = await resolve(title, author);
          setResolved(r);
        } finally {
          setLoading(false);
        }
      }

      // Single option → navigate immediately. Multiple → open picker.
      if (!r.options || r.options.length <= 1) {
        window.open(r.primary.url, "_blank", "noopener,noreferrer");
      } else {
        setOpen((o) => !o);
      }
    },
    [title, author, resolved],
  );

  const base = "meta inline-flex items-center gap-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const sizing = size === "md" ? "px-3 py-1.5" : "px-2 py-1";
  const skin =
    variant === "primary"
      ? "border border-foreground bg-foreground text-background hover:bg-primary hover:border-primary"
      : "border border-foreground/40 text-foreground hover:bg-foreground hover:text-background";

  const hasMultiple = resolved && resolved.options.length > 1;

  return (
    <div ref={dropdownRef} className="relative inline-block">
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        disabled={loading}
        title={
          resolved
            ? `Find at a bookshop (${resolved.country})`
            : "Find this book at a local or independent shop"
        }
        className={cn(base, sizing, skin, className)}
        aria-label="Find at a shop"
        aria-expanded={open}
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <ShoppingBag className="h-3 w-3" />
        )}
        <span>Find at a shop</span>
        {hasMultiple ? (
          <ChevronDown className={cn("h-3 w-3 opacity-60 transition-transform", open && "rotate-180")} />
        ) : (
          <ExternalLink className="h-3 w-3 opacity-60" />
        )}
      </button>

      {open && resolved && resolved.options.length > 1 && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[220px] border border-foreground bg-background shadow-lg">
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground border-b border-foreground/10">
            Shops in {resolved.country}
          </div>
          {resolved.options.map((opt) => (
            <a
              key={opt.vendor}
              href={opt.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-foreground hover:text-background transition-colors group"
            >
              <span className="flex items-center gap-2">
                <KindIcon kind={opt.kind} />
                <span className="font-medium">{opt.name}</span>
              </span>
              <span className="flex items-center gap-1.5 text-[10px]">
                <KindLabel kind={opt.kind} />
                <ExternalLink className="h-2.5 w-2.5 opacity-40 group-hover:opacity-70" />
              </span>
            </a>
          ))}
          <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-t border-foreground/10">
            🌱 Indie shops support local bookstores
          </div>
        </div>
      )}
    </div>
  );
};

// Warm the resolver for a list of books (called after recommendations render).
export function prewarmBuyLinks(books: Array<{ title: string; author: string }>) {
  for (const b of books) {
    if (!b?.title) continue;
    const k = cacheKey(b.title, b.author || "");
    if (memo.has(k) || inflight.has(k)) continue;
    resolve(b.title, b.author || "").catch(() => {});
  }
}
