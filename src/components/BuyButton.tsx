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

// ── Client-side country guess (bug fix) ───────────────────────────────────
// resolve-buy-link's server-side geo detection turns out to be unreliable on
// Supabase's hosted Edge Functions: Cloudflare's cf-ipcountry header is never
// forwarded to the function runtime (verified live — even a spoofed
// cf-ipcountry request header is ignored, and Supabase's own docs show a
// sample Edge Function header dump that omits cf-ipcountry entirely). With
// that gone, the server falls through to parsing Accept-Language — a
// LANGUAGE preference, not a location signal — which mis-routes any visitor
// whose browser reports a bare "en" or "en-GB" (an extremely common default
// for non-US English UI, e.g. most Chrome installs outside North America) to
// Amazon UK regardless of where they actually are. This is the "always
// redirects to Amazon UK" bug.
//
// IANA timezone is a much better, still-zero-network-latency proxy for
// country than UI language — Intl.DateTimeFormat is synchronous and built
// into every JS engine, so this preserves the endpoint's "<100ms p50, no
// upstream calls" design goal. We send it as an explicit `country` override,
// which the server already accepts and prioritizes above any header-based
// guess (see resolve-buy-link's `countryOverride` handling) — only the
// client was never actually using it.
const TIMEZONE_COUNTRY: Record<string, string> = {
  // Americas
  "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US",
  "America/Los_Angeles": "US", "America/Anchorage": "US", "America/Phoenix": "US",
  "America/Detroit": "US", "America/Boise": "US", "America/Indianapolis": "US",
  "Pacific/Honolulu": "US", "America/Puerto_Rico": "US",
  "America/Toronto": "CA", "America/Vancouver": "CA", "America/Edmonton": "CA",
  "America/Winnipeg": "CA", "America/Halifax": "CA", "America/St_Johns": "CA",
  "America/Regina": "CA",
  "America/Mexico_City": "MX", "America/Tijuana": "MX", "America/Cancun": "MX",
  "America/Monterrey": "MX",
  "America/Sao_Paulo": "BR", "America/Bahia": "BR", "America/Fortaleza": "BR",
  "America/Manaus": "BR", "America/Recife": "BR", "America/Belem": "BR",
  // Europe
  "Europe/London": "GB", "Europe/Dublin": "IE", "Europe/Berlin": "DE",
  "Europe/Vienna": "AT", "Europe/Zurich": "CH", "Europe/Paris": "FR",
  "Europe/Brussels": "BE", "Europe/Luxembourg": "LU", "Europe/Rome": "IT",
  "Europe/Madrid": "ES", "Atlantic/Canary": "ES", "Europe/Lisbon": "PT",
  "Atlantic/Madeira": "PT", "Atlantic/Azores": "PT", "Europe/Amsterdam": "NL",
  "Europe/Stockholm": "SE", "Europe/Oslo": "NO", "Europe/Copenhagen": "DK",
  "Europe/Helsinki": "FI",
  // Asia-Pacific
  "Asia/Tokyo": "JP", "Asia/Seoul": "KR", "Asia/Kolkata": "IN",
  "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "Australia/Brisbane": "AU",
  "Australia/Perth": "AU", "Australia/Adelaide": "AU", "Australia/Darwin": "AU",
  "Australia/Hobart": "AU", "Pacific/Auckland": "NZ", "Pacific/Chatham": "NZ",
};

function guessCountryFromTimezone(): string | undefined {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIMEZONE_COUNTRY[tz];
  } catch {
    return undefined;
  }
}

async function resolve(title: string, author: string): Promise<Resolved> {
  const k = cacheKey(title, author);
  const hit = memo.get(k);
  if (hit) return hit;
  const pending = inflight.get(k);
  if (pending) return pending;

  const p = (async () => {
    const country = guessCountryFromTimezone();
    const { data, error } = await supabase.functions.invoke("resolve-buy-link", {
      body: { title, author, ...(country ? { country } : {}) },
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

  // 2026-07-16: this is the app's monetization action (affiliate buy
  // links) — Stefano wants it visually louder than the rest of the ink/
  // paper editorial furniture, not just another meta chip. "md" (used for
  // the single-book hero contexts: BookPage/Index result header, BookDNA
  // recommendation panel) gets a real button treatment: bigger type,
  // bolder weight, a hover lift. "sm" (AntiShelf's dense recommendation
  // list — many cards on screen at once) keeps the compact .meta chip
  // sizing so a long list doesn't turn into a wall of huge blue buttons,
  // but still gets a livelier color at rest than the old plain-ink ghost.
  const base = "inline-flex items-center font-mono uppercase transition-all disabled:cursor-not-allowed disabled:opacity-50";
  const sizing =
    size === "md"
      ? "gap-2 px-4 py-2.5 text-[11px] font-bold tracking-[0.14em]"
      : "meta gap-1.5 px-2 py-1";
  const skin =
    variant === "primary"
      ? "border-2 border-foreground bg-primary text-primary-foreground hover:bg-primary-dark hover:text-white hover:-translate-y-[1px]"
      : "border border-primary text-primary hover:bg-primary hover:text-primary-foreground";

  const hasMultiple = resolved && resolved.options.length > 1;
  const iconSize = size === "md" ? "h-3.5 w-3.5" : "h-3 w-3";

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
          <Loader2 className={cn(iconSize, "animate-spin")} />
        ) : (
          <ShoppingBag className={iconSize} />
        )}
        <span>Find at a shop</span>
        {hasMultiple ? (
          <ChevronDown className={cn(iconSize, "opacity-60 transition-transform", open && "rotate-180")} />
        ) : (
          <ExternalLink className={cn(iconSize, "opacity-60")} />
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
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-foreground/10 transition-colors group"
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
