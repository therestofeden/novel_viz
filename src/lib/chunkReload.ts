/**
 * Stale-chunk detection and one-shot recovery.
 *
 * Every route past "/" is code-split, and since the tab-view split
 * (TimelineView/CharacterNetwork/BookDNA/ConceptMap/IdeasTab/
 * ChapterBreakdown/TakeawaysTab) a book page pulls in up to seven more
 * chunks on demand. Chunk filenames are content-hashed, so every deploy
 * renames them — and with canon curation shipping most days, that is
 * several renames a week.
 *
 * A client running a previous build (an old tab, or a PWA shell whose
 * service worker just activated a new precache and swept the old one) will
 * therefore ask for chunk filenames that no longer exist. What comes back
 * depends on the host config, and the message the browser throws depends on
 * the engine — which is why matching on a couple of Chrome-flavoured strings
 * was not enough:
 *
 *   Safari / iOS      'text/html' is not a valid JavaScript MIME type.
 *                     Importing a module script failed.
 *   Chrome / Edge     Failed to load module script: Expected a JavaScript
 *                     module script but the server responded with a MIME
 *                     type of "text/html". …
 *                     Failed to fetch dynamically imported module: …
 *   Firefox           error loading dynamically imported module
 *                     Loading module from “…” was blocked because of a
 *                     disallowed MIME type (“text/html”).
 *
 * All of them mean the same thing and all of them are fixed the same way:
 * reload once, which re-fetches index.html and with it the current chunk
 * map. Anything not on this list is a real error and must be left alone.
 */
export const CHUNK_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|dynamically imported module|Importing a module script failed|Failed to load module script|Expected a JavaScript(?:-or-Wasm)? module script|is not a valid JavaScript MIME type|disallowed MIME type|Loading chunk [\w.-]+ failed|ChunkLoadError|Unexpected token '<'/i;

const RELOAD_FLAG = "novelviz:chunk-reload-attempted";

const messageOf = (error: unknown): string => {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  const maybe = error as { message?: unknown };
  return typeof maybe.message === "string" ? maybe.message : "";
};

/** True when `error` is a stale-build chunk failure rather than a real bug. */
export const isChunkLoadError = (error: unknown): boolean =>
  CHUNK_ERROR_PATTERN.test(messageOf(error));

/** True once this tab has already burned its single automatic reload. */
export const hasAttemptedChunkReload = (): boolean => {
  try {
    return sessionStorage.getItem(RELOAD_FLAG) === "1";
  } catch {
    // Private mode / storage disabled — treat as "not yet tried". Worst
    // case the tab reloads once more than it strictly needed to.
    return false;
  }
};

export const clearChunkReloadFlag = () => {
  try {
    sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    /* no-op */
  }
};

/**
 * Reload the tab exactly once per session to pick up the current build.
 * The sessionStorage guard is what stops a genuinely broken deploy from
 * putting the tab in a reload loop — a second failure falls through to the
 * manual retry UI instead.
 *
 * Returns true if a reload was started.
 */
export const attemptChunkReload = (): boolean => {
  if (hasAttemptedChunkReload()) return false;
  try {
    sessionStorage.setItem(RELOAD_FLAG, "1");
  } catch {
    /* no-op — proceed anyway, see comment above */
  }
  window.location.reload();
  return true;
};

/**
 * Catches the stale-chunk failures that never reach a React error boundary:
 * Vite's own modulepreload failures (`vite:preloadError`), and rejected
 * import() promises fired from event handlers rather than from render.
 * Without this, those paths ended as an unhandled rejection and a page that
 * simply never finished loading.
 */
export const installChunkReloadHandlers = () => {
  window.addEventListener("vite:preloadError", (event) => {
    const payload = (event as Event & { payload?: unknown }).payload;
    if (attemptChunkReload()) event.preventDefault();
    else console.error("[chunkReload] preload failed after reload attempt:", payload);
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (!isChunkLoadError(event.reason)) return;
    if (attemptChunkReload()) event.preventDefault();
  });

  window.addEventListener(
    "error",
    (event) => {
      // Classic <script> / module load failures surface here, not as a rejection.
      if (isChunkLoadError(event.error ?? event.message)) attemptChunkReload();
    },
    true,
  );
};
