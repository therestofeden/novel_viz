import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

// Matches the various "the JS chunk this route needs no longer exists"
// errors thrown by Vite/Rollup dynamic import() across browsers.
const CHUNK_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk [\w.-]+ failed/i;

const RELOAD_FLAG = "novelviz:chunk-reload-attempted";

/**
 * Fallback for the ErrorBoundary wrapping every lazy-loaded route (see
 * App.tsx). Every route past "/" is code-split (`lazy(() => import(...))`),
 * and every Vercel deploy renames those chunk files (content-hashed
 * filenames). A tab that's been open since before a deploy still has the
 * OLD index.html's chunk map in memory — the first time it navigates to a
 * route it hasn't loaded yet (e.g. clicking "My shelf"), the dynamic
 * import() 404s. Nothing caught that before this: no ErrorBoundary wrapped
 * the router's Suspense at all, so React's default behavior silently
 * unmounted the tree — the exact "click Shelf → nothing happens → refresh
 * fixes it" symptom.
 *
 * Fix: detect this specific error shape and do ONE automatic hard reload
 * (which re-fetches the current index.html and its correct chunk hashes).
 * Guarded by sessionStorage so a genuinely broken deploy can't reload-loop
 * the tab forever — a second failure falls through to a manual retry UI.
 */
export const ChunkErrorRecovery = ({ error, reset }: { error: Error; reset: () => void }) => {
  const isChunkError = CHUNK_ERROR_PATTERN.test(error.message);
  const alreadyTried = isChunkError && sessionStorage.getItem(RELOAD_FLAG) === "1";

  useEffect(() => {
    if (isChunkError && !alreadyTried) {
      sessionStorage.setItem(RELOAD_FLAG, "1");
      window.location.reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          sessionStorage.removeItem(RELOAD_FLAG);
          reset();
        }}
        className="meta flex items-center gap-2 border border-foreground px-4 py-2 transition-colors hover:bg-foreground/10"
      >
        <RefreshCw className="h-3 w-3" /> Try again
      </button>
    </div>
  );
};
