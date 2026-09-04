import { describe, expect, it } from "vitest";
import { isChunkLoadError } from "@/lib/chunkReload";

/**
 * The failure this guards against shipped once already: the original matcher
 * only knew Chrome/Firefox wording, so on Safari and iOS — where a stale
 * chunk surfaces as "'text/html' is not a valid JavaScript MIME type." — the
 * automatic reload never fired and every book page dead-ended on the
 * "Something went wrong loading this page" screen. Each string below is a
 * real message from the engine named beside it.
 */
const STALE_CHUNK_MESSAGES: Array<[string, string]> = [
  ["Safari / iOS", "'text/html' is not a valid JavaScript MIME type."],
  ["Safari / iOS", "Importing a module script failed."],
  [
    "Chrome / Edge",
    'Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of "text/html". Strict MIME type checking is enforced for module scripts per HTML spec.',
  ],
  [
    "Chrome / Edge",
    "Failed to fetch dynamically imported module: https://novelviz.app/assets/BookPage-D4BCmVgd.js",
  ],
  ["Firefox", "error loading dynamically imported module"],
  [
    "Firefox",
    "Loading module from “https://novelviz.app/assets/TimelineView-DaaYIu68.js” was blocked because of a disallowed MIME type (“text/html”).",
  ],
  ["Webpack-era wording", "Loading chunk vendor-charts failed."],
  ["HTML parsed as JS", "Unexpected token '<'"],
];

describe("isChunkLoadError", () => {
  it.each(STALE_CHUNK_MESSAGES)("recognises the %s message", (_engine, message) => {
    expect(isChunkLoadError(new Error(message))).toBe(true);
  });

  it("accepts a bare string as well as an Error", () => {
    expect(isChunkLoadError("'text/html' is not a valid JavaScript MIME type.")).toBe(true);
  });

  it("does not swallow genuine application errors", () => {
    const realBugs = [
      "Cannot read properties of undefined (reading 'title')",
      "analyze-novel returned 500",
      "NetworkError when attempting to fetch resource.",
      "Maximum update depth exceeded",
    ];
    for (const message of realBugs) {
      expect(isChunkLoadError(new Error(message)), message).toBe(false);
    }
  });

  it("is safe with null/undefined/odd input", () => {
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(isChunkLoadError({})).toBe(false);
    expect(isChunkLoadError(42)).toBe(false);
  });
});
