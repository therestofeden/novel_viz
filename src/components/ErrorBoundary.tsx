import { Component, ErrorInfo, ReactNode } from "react";
import { RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Optional custom fallback renderer. Defaults to a simple message + retry. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

// There was no error boundary anywhere in the app before this. That means any
// uncaught render error in ANY tab (Timeline/Network/DNA/Takeaways/etc.) took
// down the entire analysis view — React's default behavior without a boundary
// is to unmount the whole subtree, leaving a silent blank page with no message,
// no retry, and (worse) nothing logged unless the browser console happened to
// be open. Found this the hard way: clicking into Takeaways intermittently
// blanked the whole page with no visible error. Rather than chase that one
// specific, hard-to-reproduce race, this closes the general gap so ANY future
// render crash in this section degrades to a message + retry instead of a
// silent blank screen.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // No backend error-reporting pipeline wired up yet — this console.error is
    // the only record today. Worth piping to real monitoring (Sentry or
    // similar) later so intermittent crashes like this are actually visible
    // instead of relying on a user noticing and reporting a blank screen.
    console.error("[ErrorBoundary] caught render error:", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (error) {
      if (this.props.fallback) return this.props.fallback(error, this.reset);
      return (
        <div className="flex flex-col items-start gap-3 px-4 py-8 md:px-8 md:py-12">
          <p className="meta text-destructive">Something went wrong displaying this</p>
          <p className="max-w-xl font-serif text-sm leading-relaxed text-muted-foreground">
            {error.message || "An unexpected error occurred."}
          </p>
          <button
            type="button"
            onClick={this.reset}
            className="meta flex items-center gap-2 border border-foreground px-4 py-2 transition-colors hover:bg-foreground hover:text-background"
          >
            <RefreshCw className="h-3 w-3" /> Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
