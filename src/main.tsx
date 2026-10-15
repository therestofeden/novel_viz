import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installChunkReloadHandlers } from "@/lib/chunkReload";
import { installErrorReporting } from "@/lib/reportError";

// Must run before the first dynamic import can fail. Covers the stale-chunk
// failures that never reach the ErrorBoundary in App.tsx — Vite's own
// modulepreload errors and import() rejections raised from event handlers.
installChunkReloadHandlers();
installErrorReporting();

createRoot(document.getElementById("root")!).render(<App />);
