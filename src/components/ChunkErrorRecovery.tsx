import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import {
  attemptChunkReload,
  clearChunkReloadFlag,
  hasAttemptedChunkReload,
  isChunkLoadError,
} from "@/lib/chunkReload";

/**
 * Fallback for the ErrorBoundary wrapping every lazy-loaded route (see
 * App.tsx). Every route past "/" is code-split (`lazy(() => import(...))`),
 * and every deploy renames those chunk files (content-hashed filenames). A
 * tab that's been open since before a deploy — or a PWA shell whose service
 * worker has just swept the previous precache — still has the OLD chunk map
 * in memory, so the first dynamic import it hasn't already loaded fails.
 *
 * Fix: detect that specific error shape and do ONE automatic hard reload,
 * which re-fetches the current index.html and its correct chunk hashes.
 * Guarded by sessionStorage so a genuinely broken deploy can't reload-loop
 * the tab forever — a second failure falls through to the manual retry UI.
 *
 * The detection itself lives in @/lib/chunkReload because the same match has
 * to run outside React too (Vite preload errors and import() rejections from
 * event handlers never reach an error boundary). It previously matched only
 * Chrome/Firefox wording, which is why Safari and iOS — where the message is
 * "'text/html' is not a valid JavaScript MIME type." — skipped the reload and
 * dead-ended on the error screen below on every book page.
 */
export const ChunkErrorRecovery = ({ error, reset }: { error: Error; reset: () => void }) => {
  const isChunkError = isChunkLoadError(error);
  const alreadyTried = isChunkError && hasAttemptedChunkReload();

  useEffect(() => {
    if (isChunkError && !alreadyTried) attemptChunkReload();
  }, [isChunkError, alreadyTried]);

  if (isChunkError && !alreadyTried) {
    // Reload is already in flight — avoid flashing an error message the
    // user would never have time to read.
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="meta text-muted-foreground">Updating…</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4 text-center">
      <p className="meta text-destructive">Something went wrong loading this page</p>
      <p className="max-w-xl font-serif text-sm leading-relaxed text-muted-foreground">
        {isChunkError
          ? "This page couldn't load a fresh update. Try again, or reload the tab."
          : error.message || "An unexpected error occurred."}
      </p>
      <button
        type="button"
        onClick={() => {
          clearChunkReloadFlag();
          reset();
        }}
        className="meta flex items-center gap-2 border border-foreground px-4 py-2 transition-colors hover:bg-foreground/10"
      >
        <RefreshCw className="h-3 w-3" /> Try again
      </button>
    </div>
  );
};
