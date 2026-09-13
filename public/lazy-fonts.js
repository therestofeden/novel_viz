// Non-blocking Google Fonts loader.
//
// The <link id="lazy-fonts"> in index.html is fetched with media="print" so
// it never blocks first paint, then this script flips it to media="all"
// once the stylesheet has actually loaded. This used to be a single inline
// onload="this.media='all'" attribute on the link tag — moved here
// (2026-09-13, CSP hardening) because an inline event-handler attribute
// requires 'unsafe-inline' in a script-src CSP, and this app's
// Content-Security-Policy (see vercel.json) deliberately omits it so a
// future stored/reflected-HTML bug can't execute injected <script> or
// on*="" attributes. Same visible behavior, zero inline JS.
(function () {
  var link = document.getElementById("lazy-fonts");
  if (!link) return;
  if (link.media === "all") return; // already applied (e.g. bfcache restore)
  link.addEventListener("load", function () {
    link.media = "all";
  });
})();
