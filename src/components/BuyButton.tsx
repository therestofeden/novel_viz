import { useState, useCallback, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { ShoppingBag, Loader2, ExternalLink, ChevronDown, Leaf, Store, Package, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { track } from "@/lib/track";

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

// 2026-09-18 (daily backend audit): resolve-buy-link's own design goal is
// <100ms p50 with zero DB round-trips and zero upstream calls (see that
// function's header comment) — but this call site, like every other
// `supabase.functions.invoke()` in the app until today, had no `signal` at
// all, unlike every raw `fetch()` here which has carried an
// `AbortSignal.timeout()` since 09-14/09-15/09-16. A wedged connection
// (dropped wifi mid-request, a stalled edge-runtime cold start) left
// `resolve()`'s promise unsettled forever: `onClick`'s `loading` state never
// clears, the hover/touch prewarm never populates `memo`, and there's no
// path back to the Amazon fallback short of a page reload. 8s matches
// LOCAL_INDEX_TIMEOUT_MS/SEARCH_SUGGEST_TIMEOUT_MS in Index.tsx — the
// established client-side ceiling for "network round trip, no AI call"
// edge functions in this codebase — generous headroom over the <100ms
// server-side budget for mobile/high-latency networks, still short enough
// that a stall degrades to the existing Amazon-fallback branch below well
// within a user's patience for a single tap.
const RESOLVE_TIMEOUT_MS = 8_000;

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
      signal: AbortSignal.timeout(RESOLVE_TIMEOUT_MS),
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
  /** narrow slots (a 148px poster on a phone): no trailing icon, no wrapping */
  compact?: boolean;
};

// Phones get the shop list as a bottom sheet; wider screens as a popover.
const SHEET_QUERY = "(max-width: 639px)";
const POPOVER_WIDTH = 260;

export const BuyButton = ({ title, author, variant = "primary", size = "sm", className, compact = false }: Props) => {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [resolved, setResolved] = useState<Resolved | null>(() => memo.get(cacheKey(title, author)) ?? null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // 2026-11-18: the shop list renders in a portal on <body>. It used to be an
  // absolutely positioned child of the button, so inside a horizontally
  // scrolling row (the "If you loved this shape" posters on a phone) it was
  // clipped by the row's overflow and never visible.
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const [asSheet, setAsSheet] = useState(false);

  const place = useCallback(() => {
    const r = buttonRef.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - POPOVER_WIDTH - 8));
    setAnchor({ top: r.bottom + 4, left });
  }, []);

  // Pre-resolve on hover — so the first click is always instant.
  const onMouseEnter = useCallback(() => {
    if (!resolved) {
      resolve(title, author).then(setResolved).catch(() => {});
    }
  }, [title, author, resolved]);

  // Mobile has no hover — onMouseEnter never fires before a tap, so touch
  // readers always paid the full resolve-buy-link round trip on first tap
  // (either a raw navigation delay, or a delay before the vendor picker
  // opens). touchstart fires ~100-300ms before the click that follows a
  // tap, giving this fire-and-forget warm-up time to land in `memo` before
  // onClick runs. Mirrors the same touchstart-prefetch fix already applied
  // to Index.tsx's autocomplete/suggestion prefetch (2026-08-31).
  const onTouchStart = useCallback(() => {
    if (!resolved) {
      resolve(title, author).then(setResolved).catch(() => {});
    }
  }, [title, author, resolved]);

  // Position on open; close on outside tap, Escape, or (popover only) when
  // the page scrolls or resizes underneath it.
  useLayoutEffect(() => {
    if (!open) return;
    setAsSheet(window.matchMedia(SHEET_QUERY).matches);
    place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const outside = (e: Event) => {
      const t = e.target as Node;
      if (dropdownRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onMove = () => { if (!window.matchMedia(SHEET_QUERY).matches) setOpen(false); };
    document.addEventListener("mousedown", outside);
    document.addEventListener("touchstart", outside, { passive: true });
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, { passive: true, capture: true });
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("touchstart", outside);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, { capture: true });
      window.removeEventListener("resize", onMove);
    };
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

      // Single plain option → navigate immediately. Several options, or any
      // commission link, → open the picker, so the reader sees the shops and
      // the disclosure before leaving (2026-11-18).
      const anyAffiliated = r.options?.some((o) => o.affiliated) || r.primary.affiliated;
      if ((!r.options || r.options.length <= 1) && !anyAffiliated) {
        track("buy_click", { vendor: r.primary.vendor, affiliated: false, country: r.country });
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
      : compact
        ? "meta min-h-[36px] gap-1.5 whitespace-nowrap px-2 py-1 !tracking-[0.06em]"
        : "meta gap-1.5 whitespace-nowrap px-2 py-1";
  const skin =
    variant === "primary"
      ? "border-2 border-foreground bg-primary text-primary-foreground hover:bg-primary-dark hover:text-white hover:-translate-y-[1px]"
      : "border border-primary text-primary hover:bg-primary hover:text-primary-foreground";

  const pickerOptions = resolved ? (resolved.options.length ? resolved.options : [resolved.primary]) : [];
  const anyAffiliated = pickerOptions.some((o) => o.affiliated);
  const hasMultiple = resolved && (resolved.options.length > 1 || anyAffiliated);
  const iconSize = size === "md" ? "h-3.5 w-3.5" : "h-3 w-3";

  const options = (
    <>
      {pickerOptions.map((opt) => (
        <a
          key={opt.vendor}
          href={opt.url}
          target="_blank"
          rel={opt.affiliated ? "noopener noreferrer sponsored" : "noopener noreferrer"}
          onClick={() => {
            track("buy_click", { vendor: opt.vendor, affiliated: opt.affiliated, country: resolved?.country ?? null });
            setOpen(false);
          }}
          className="group flex min-h-[48px] items-center justify-between gap-3 px-4 py-2 text-sm transition-colors hover:bg-foreground/10 sm:min-h-0 sm:px-3"
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
      <div className="border-t border-foreground/10 px-4 py-2 text-[11px] text-muted-foreground sm:px-3 sm:py-1.5 sm:text-[10px]">
        🌱 Indie shops support local bookstores
      </div>
      {anyAffiliated && (
        <div className="px-4 pb-3 text-[11px] leading-snug text-muted-foreground sm:px-3 sm:pb-2 sm:text-[10px]">
          Some of these links earn NovelViz a small commission, at no extra cost to you.{" "}
          <a href="/privacy#shops" className="underline underline-offset-2">More</a>
        </div>
      )}
    </>
  );

  const panel =
    open && resolved && pickerOptions.length > 0
      ? asSheet
        ? (
          <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={`Shops in ${resolved.country}`}>
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <div
              ref={panelRef}
              className="absolute inset-x-0 bottom-0 border-t-2 border-foreground bg-background"
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              <div className="flex items-center justify-between border-b border-foreground/10 pl-4">
                <div className="min-w-0 py-3">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Shops in {resolved.country}</div>
                  <div className="truncate font-serif text-base italic">{title}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="flex h-12 w-12 shrink-0 items-center justify-center"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {options}
            </div>
          </div>
        )
        : anchor && (
          <div
            ref={panelRef}
            className="fixed z-[70] border border-foreground bg-background shadow-lg"
            style={{ top: anchor.top, left: anchor.left, width: POPOVER_WIDTH }}
          >
            <div className="border-b border-foreground/10 px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
              Shops in {resolved.country}
            </div>
            {options}
          </div>
        )
      : null;

  return (
    <div ref={dropdownRef} className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onTouchStart={onTouchStart}
        disabled={loading}
        title={
          resolved
            ? `Find at a bookshop (${resolved.country})`
            : "Find this book at a local or independent shop"
        }
        className={cn(base, sizing, skin, className)}
        aria-label="Find at a shop"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        {loading ? (
          <Loader2 className={cn(iconSize, "animate-spin")} />
        ) : (
          <ShoppingBag className={iconSize} />
        )}
        <span>Find at a shop</span>
        {!compact &&
          (hasMultiple ? (
            <ChevronDown className={cn(iconSize, "opacity-60 transition-transform", open && "rotate-180")} />
          ) : (
            <ExternalLink className={cn(iconSize, "opacity-60")} />
          ))}
      </button>
      {panel && createPortal(panel, document.body)}
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
