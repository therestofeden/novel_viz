import type { NovelAnalysis } from "@/lib/novel-types";
import { CREAM, NAVY, bookInk, definingAxes, glyphAxes, hasEnoughDna, petalPath } from "@/lib/dna-glyph";

/**
 * The share card: a 540x960 portrait image of a book's DNA glyph on its own
 * ink, from the approved "Share card" canvas board. Built as a plain SVG
 * string (no foreignObject, no external assets) so it rasterises reliably in
 * every browser and can be tested without a DOM.
 */

export const CARD_W = 540;
export const CARD_H = 960;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Greedy word wrap by character budget; the last line is ellipsised if text overflows. */
export function wrapLines(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur && (cur + " " + w).length > maxChars) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? cur + " " + w : w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = kept[maxLines - 1].replace(/[\s.,;:]*$/, "") + "…";
  return kept;
}

export function shareCardSvg(analysis: NovelAnalysis, host: string): string | null {
  const axes = glyphAxes(analysis);
  if (!hasEnoughDna(axes)) return null;
  const ink = bookInk(analysis);
  const fg = ink.onInk;
  const petals = petalPath(axes.map((a) => a.score));
  const title = wrapLines(analysis.title ?? "", 22, 3);
  const author = analysis.author ? esc(analysis.author) : "";
  const signature = wrapLines(analysis.dna?.signature ?? "", 40, 3);
  const stats = definingAxes(analysis, 3);

  const SERIF = "Fraunces, Georgia, 'Times New Roman', serif";
  const SANS = "'Space Grotesk', system-ui, -apple-system, 'Segoe UI', sans-serif";
  const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";

  let y = 622;
  const titleTspans = title
    .map((l, i) => `<tspan x="40" dy="${i === 0 ? 0 : 46}">${esc(l)}</tspan>`)
    .join("");
  y += 46 * Math.max(0, title.length - 1) + 30;
  const authorY = y;
  y += author ? 34 : 0;
  const sigTspans = signature
    .map((l, i) => `<tspan x="40" dy="${i === 0 ? 0 : 26}">${esc(l)}</tspan>`)
    .join("");
  const sigY = y + 4;
  const statsY = 768;
  const col = (CARD_W - 80) / 3;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}" width="${CARD_W}" height="${CARD_H}" role="img" aria-label="DNA share card for ${esc(analysis.title ?? "this book")}">
<rect width="${CARD_W}" height="${CARD_H}" fill="${ink.ink}"/>
<g fill="${fg}" font-family="${SANS}">
<text x="40" y="66" font-size="17" font-weight="600">NovelViz</text>
<text x="${CARD_W - 40}" y="66" font-size="12" letter-spacing="1.7" text-anchor="end" font-family="${MONO}">BOOK DNA</text>
</g>
<g transform="translate(70 96) scale(2)">
<circle cx="100" cy="100" r="94" fill="none" stroke="${fg}" stroke-opacity="0.35" stroke-width="0.6" stroke-dasharray="1.5 2.5"/>
<path d="${petals}" fill="${fg === NAVY ? CREAM : NAVY}" stroke="${fg}" stroke-width="0.9"/>
<circle cx="100" cy="100" r="3.6" fill="${fg}"/>
</g>
<g fill="${fg}">
<text x="40" y="622" font-family="${SERIF}" font-style="italic" font-size="42">${titleTspans}</text>
${author ? `<text x="40" y="${authorY}" font-family="${SANS}" font-size="16" font-weight="500">${author}</text>` : ""}
${signature.length ? `<text x="40" y="${sigY + 22}" font-family="${SERIF}" font-size="19">${sigTspans}</text>` : ""}
</g>
<g fill="${fg}" stroke="${fg}" stroke-width="1">
<line x1="40" x2="${CARD_W - 40}" y1="${statsY}" y2="${statsY}"/>
<line x1="40" x2="${CARD_W - 40}" y1="${statsY + 74}" y2="${statsY + 74}"/>
</g>
<g fill="${fg}">
${stats
  .map(
    (a, i) =>
      `<text x="${40 + i * col + (i ? 14 : 0)}" y="${statsY + 40}" font-family="${MONO}" font-size="28" font-weight="500">${a.score}</text><text x="${40 + i * col + (i ? 14 : 0)}" y="${statsY + 62}" font-family="${SANS}" font-size="13">${esc(a.short)}</text>`,
  )
  .join("\n")}
</g>
<rect y="${CARD_H - 74}" width="${CARD_W}" height="74" fill="${NAVY}"/>
<text x="40" y="${CARD_H - 30}" font-family="${SANS}" font-size="14" fill="#C9D6E4">Map any book at ${esc(host)}</text>
</svg>`;
}

/** Rasterise a card SVG to a PNG at 2x (1080x1920). Browser only. */
export function svgToPng(svg: string, scale = 2): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = CARD_W * scale;
      canvas.height = CARD_H * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas unavailable"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("could not encode PNG"))), "image/png");
    };
    img.onerror = () => reject(new Error("could not render card"));
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
}
