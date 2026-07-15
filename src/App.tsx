import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index.tsx";
import { SmoothScroll } from "@/components/SmoothScroll";
import { PageScrollRule } from "@/lib/motion";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ChunkErrorRecovery } from "@/components/ChunkErrorRecovery";

// Route-split: only Index ships in the initial bundle. The rest load on navigation.
const BookPage = lazy(() => import("./pages/BookPage.tsx"));
const Auth = lazy(() => import("./pages/Auth.tsx"));
const Shelf = lazy(() => import("./pages/Shelf.tsx"));
const AntiShelf = lazy(() => import("./pages/AntiShelf.tsx"));
const Compare = lazy(() => import("./pages/Compare.tsx"));
const Privacy = lazy(() => import("./pages/Privacy.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="meta text-muted-foreground">Loading…</div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <SmoothScroll>
            <PageScrollRule />
            {/* Catches lazy-route chunk-load failures (stale tab after a
                new deploy) and auto-recovers with a single reload instead
                of silently unmounting to a blank page — see
                ChunkErrorRecovery for the full story. Keyed on nothing in
                particular; it just needs to wrap every lazy route. */}
            <ErrorBoundary fallback={(error, reset) => <ChunkErrorRecovery error={error} reset={reset} />}>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/book/:slug" element={<BookPage />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/shelf" element={<Shelf />} />
                  <Route path="/anti-shelf" element={<AntiShelf />} />
                  <Route path="/compare" element={<Compare />} />
                  <Route path="/privacy" element={<Privacy />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </SmoothScroll>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
