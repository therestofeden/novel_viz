import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "NovelViz",
        short_name: "NovelViz",
        description: "Visualize any book's characters, concepts & timelines",
        theme_color: "#0f0f0f",
        background_color: "#0f0f0f",
        display: "standalone",
        orientation: "portrait-primary",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        // Cache Google Fonts and app shell; everything else network-first
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    rollupOptions: {
      output: {
        // The whole app used to ship as one ~850KB chunk that blocked first
        // paint for every visitor, cached or not. Splitting the heavy,
        // rarely-changing/lazily-needed vendor libs out means the browser
        // can fetch them in parallel (HTTP/2) instead of one giant serial
        // blob, and they cache independently of app code that changes daily.
        // Deliberately NOT splitting react/react-dom/@radix-ui out — they're
        // imported from nearly everywhere (including the other vendor
        // chunks below), and doing so produced circular chunk warnings from
        // Rollup plus duplicated code. Splitting these three instead is
        // safe because they're each a self-contained leaf dependency tree
        // that's genuinely optional on first paint (charts/markdown aren't
        // needed until a user opens the DNA or Takeaways tab; motion is
        // used widely but is still a clean, non-circular leaf).
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("framer-motion")) return "vendor-motion";
          if (id.includes("recharts") || id.includes("/d3-")) return "vendor-charts";
          if (
            id.includes("react-markdown") ||
            id.includes("remark") ||
            id.includes("micromark") ||
            id.includes("unified") ||
            id.includes("mdast") ||
            id.includes("hast") ||
            id.includes("unist") ||
            id.includes("vfile") ||
            id.includes("property-information") ||
            id.includes("space-separated-tokens") ||
            id.includes("comma-separated-tokens")
          ) {
            // Only needed on the Takeaways tab, not the initial app shell.
            return "vendor-markdown";
          }
          // Everything else (react, react-dom, @radix-ui, react-router, supabase-js)
          // goes in one shared vendor chunk — it changes far less often than
          // app code, so it's still a net caching win even unsplit further.
          return "vendor";
        },
      },
    },
  },
}));
