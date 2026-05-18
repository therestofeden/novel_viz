import { useState } from "react";
import { Share2, Check, Link2, Twitter } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ease } from "@/lib/motion";

interface ShareButtonProps {
  title: string;
  author?: string;
  signature?: string;
  className?: string;
}

/**
 * Editorial share control.
 * - Mobile: opens the native share sheet (Web Share API) on tap.
 * - Desktop / unsupported: opens an inline panel with copy-link + X share.
 */
export function ShareButton({ title, author, signature, className }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const buildUrl = () => {
    if (typeof window === "undefined") return "";
    const u = new URL(window.location.origin + "/");
    u.searchParams.set("book", title);
    return u.toString();
  };

  const shareText = signature
    ? `${title}${author ? ` — ${author}` : ""}: "${signature}"`
    : `${title}${author ? ` — ${author}` : ""}`;

  const handleClick = async () => {
    const url = buildUrl();
    const canNative =
      typeof navigator !== "undefined" &&
      typeof (navigator as Navigator & { share?: unknown }).share === "function";
    if (canNative) {
      try {
        await navigator.share({ title, text: shareText, url });
        return;
      } catch {
        // User dismissed or share failed — fall through to panel
      }
    }
    setOpen((o) => !o);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(buildUrl());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* noop */
    }
  };

  const tweet = () => {
    const u = new URL("https://twitter.com/intent/tweet");
    u.searchParams.set("text", shareText);
    u.searchParams.set("url", buildUrl());
    window.open(u.toString(), "_blank", "noopener,noreferrer");
  };

  return (
    <div className={cn("relative inline-block", className)}>
      <button
        onClick={handleClick}
        aria-label="Share this book"
        aria-expanded={open}
        className="meta inline-flex min-h-[44px] items-center gap-2 border border-foreground bg-card px-3 py-2 transition-colors hover:bg-foreground hover:text-background"
      >
        <Share2 className="h-3.5 w-3.5" />
        <span>Share</span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <button
              aria-hidden
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 cursor-default bg-transparent"
            />
            <motion.div
              role="dialog"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: ease.out }}
              className="absolute right-0 top-[calc(100%+6px)] z-50 w-[min(92vw,320px)] border border-foreground bg-background"
            >
              <div className="border-b border-foreground px-3 py-2">
                <div className="meta text-muted-foreground">Share</div>
                <div className="mt-1 truncate font-serif text-sm italic">{title}</div>
              </div>
              <div className="flex flex-col">
                <button
                  onClick={copy}
                  className="meta flex min-h-[44px] items-center justify-between gap-3 border-b border-foreground/30 px-3 py-2 text-left transition-colors hover:bg-foreground hover:text-background"
                >
                  <span className="inline-flex items-center gap-2">
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                    {copied ? "Link copied" : "Copy link"}
                  </span>
                  <span className="font-mono text-[10px] opacity-60">↵</span>
                </button>
                <button
                  onClick={tweet}
                  className="meta flex min-h-[44px] items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-foreground hover:text-background"
                >
                  <span className="inline-flex items-center gap-2">
                    <Twitter className="h-3.5 w-3.5" />
                    Share on X
                  </span>
                  <span className="font-mono text-[10px] opacity-60">↗</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
