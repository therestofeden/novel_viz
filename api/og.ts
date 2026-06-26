/**
 * Vercel Edge Function — /og?book=Cloud+Atlas
 *
 * Social crawlers (Twitter/X, iMessage, Slack, LinkedIn) hit this URL and see
 * per-book OG meta tags. Real users see an instant JS redirect to the SPA.
 *
 * Why a separate /og route instead of injecting into index.html?
 * The app is a static SPA — Vercel serves index.html for every path, with no
 * server-side templating. This edge function is the only way to return
 * dynamically-generated <meta> tags for a specific book without moving to SSR.
 */

export const config = { runtime: "edge" };

const DEFAULT_IMAGE =
  "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/af52b75f-8a56-4b28-b3aa-e8a49dfb0b4c/id-preview-85ee75f8--e57fd034-cebd-490e-b5aa-76db1aae38ee.lovable.app-1778804999276.png";

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default function handler(request: Request): Response {
  const url = new URL(request.url);
  const book = (url.searchParams.get("book") ?? "").trim().slice(0, 120);
  const appUrl = book
    ? `${url.origin}/?book=${encodeURIComponent(book)}`
    : url.origin;

  const title = book ? `${book} — NovelViz` : "NovelViz — Visualize Any Book";
  const description = book
    ? `See the structure of "${book}" — characters, timelines, literary DNA, and key insights. Powered by NovelViz.`
    : "Type any book and instantly see it mapped: characters, timelines, concepts, and literary DNA.";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>

  <!-- Open Graph -->
  <meta property="og:type"        content="website" />
  <meta property="og:url"         content="${esc(appUrl)}" />
  <meta property="og:title"       content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:image"       content="${esc(DEFAULT_IMAGE)}" />

  <!-- Twitter / X -->
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image"       content="${esc(DEFAULT_IMAGE)}" />

  <!-- Instant redirect for real browsers -->
  <meta http-equiv="refresh" content="0;url=${esc(appUrl)}" />
  <script>window.location.replace(${JSON.stringify(appUrl)});</script>
</head>
<body style="font-family:sans-serif;padding:2rem;background:#fff;color:#111">
  <p>Redirecting to <a href="${esc(appUrl)}">${esc(title)}</a>…</p>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Cache for 1 hour — short enough to pick up any title corrections.
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
