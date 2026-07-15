import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { NovelVizLogo } from "@/components/NovelVizLogo";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";

const Auth = () => {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/shelf";

  useEffect(() => {
    if (!loading && session) navigate(next, { replace: true });
  }, [loading, session, next, navigate]);

  const handleEmail = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${next}`,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setOauthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${next}`,
        },
      });
      if (error) {
        toast.error("Google sign-in failed: " + error.message);
        setOauthLoading(false);
      }
      // On success Supabase redirects the browser — no further action needed here.
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setOauthLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Masthead */}
      <header className="ink-border-b">
        <div className="container mx-auto flex items-stretch">
          <Link
            to="/"
            className="group flex items-center gap-3 border-r border-foreground px-4 py-4 transition-colors hover:bg-foreground/10"
          >
            <NovelVizLogo size={48} className="text-foreground transition-colors group-hover:text-[#5ba3d9]" />
            <div className="leading-none">
              <div className="font-sans text-xl font-bold tracking-tight">NovelViz</div>
              <div className="meta mt-1 text-muted-foreground">← Back to home</div>
            </div>
          </Link>
        </div>
      </header>

      <main className="container mx-auto grid grid-cols-12 gap-0">
        <aside className="col-span-12 ink-border-b border-foreground px-4 py-6 md:col-span-2 md:border-b-0 md:border-r md:py-12">
          <div className="meta text-muted-foreground">No. 002</div>
          <div className="display-num mt-2 text-5xl md:text-7xl">02</div>
          <div className="meta mt-3 text-muted-foreground">Section</div>
          <div className="mt-1 font-serif text-sm italic">The Reader's Shelf</div>
        </aside>

        <div className="col-span-12 px-4 py-10 md:col-span-10 md:px-10 md:py-16">
          <div className="meta mb-6 flex items-center gap-3 text-muted-foreground">
            <span className="inline-block h-2 w-2 bg-primary" />
            {mode === "signup" ? "Open a Reader's Account" : "Return to Your Shelf"}
            <span className="inline-block h-px w-12 bg-foreground/40" />
            Field Guide No. 001
          </div>

          <h1 className="text-balance font-sans text-4xl font-bold leading-[0.95] tracking-tight md:text-6xl">
            {mode === "signup" ? (
              <>
                Save the books<br />
                <span className="italic font-serif font-normal">you read</span> into a<br />
                <span className="text-primary">single shelf.</span>
              </>
            ) : (
              <>
                Welcome<br />
                <span className="italic font-serif font-normal">back</span> to your<br />
                <span className="text-primary">shelf.</span>
              </>
            )}
          </h1>

          <p className="mt-6 max-w-xl font-serif text-base leading-relaxed text-muted-foreground md:text-lg">
            {mode === "signup"
              ? "Sign in to keep every book you analyse, plot them on the constellation map, and compare their DNA strands."
              : "Sign in to access your saved books, your DNA constellation, and side-by-side comparisons."}
          </p>

          <div className="mt-10 grid max-w-2xl grid-cols-12 gap-0">
            {/* Google */}
            <div className="col-span-12 ink-border bg-card">
              <button
                onClick={handleGoogle}
                disabled={oauthLoading || submitting}
                className="meta flex w-full items-center justify-center gap-3 px-6 py-4 transition-colors hover:bg-foreground/10 disabled:opacity-50"
              >
                {oauthLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden>
                    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
                    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                    <path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.7-5.3l-6.3-5.3C29.5 35.1 26.9 36 24 36c-5.3 0-9.7-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
                    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.4l6.3 5.3C41.7 35.6 44 30.2 44 24c0-1.3-.1-2.3-.4-3.5z"/>
                  </svg>
                )}
                Continue with Google
              </button>
            </div>

            <div className="col-span-12 my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-foreground/30" />
              <span className="meta text-muted-foreground">or with email</span>
              <div className="h-px flex-1 bg-foreground/30" />
            </div>

            {/* Email form */}
            <form onSubmit={handleEmail} className="col-span-12 ink-border bg-card">
              {mode === "signup" && (
                <div className="border-b border-foreground/30">
                  <label className="block px-4 pt-3">
                    <span className="meta text-muted-foreground">Display name</span>
                  </label>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="What should we call you?"
                    className="w-full bg-transparent px-4 pb-3 pt-1 font-serif text-base italic placeholder:text-muted-foreground/60 focus:outline-none"
                  />
                </div>
              )}
              <div className="border-b border-foreground/30">
                <label className="block px-4 pt-3">
                  <span className="meta text-muted-foreground">Email</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="reader@example.com"
                  className="w-full bg-transparent px-4 pb-3 pt-1 font-sans text-base placeholder:text-muted-foreground/60 focus:outline-none"
                />
              </div>
              <div>
                <label className="block px-4 pt-3">
                  <span className="meta text-muted-foreground">Password</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-transparent px-4 pb-3 pt-1 font-sans text-base placeholder:text-muted-foreground/60 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={submitting || oauthLoading}
                className="meta flex w-full items-center justify-center gap-2 border-t border-foreground bg-foreground px-6 py-4 text-background transition-colors hover:bg-ink-blue disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : mode === "signup" ? "→ Open Account" : "→ Sign In"}
              </button>
            </form>

            <div className="col-span-12 mt-6">
              <button
                onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
                className={cn(
                  "meta inline-flex items-center gap-2 border border-foreground bg-card px-3 py-2",
                  "hover:bg-foreground/10",
                )}
              >
                {mode === "signin" ? "→ Open a new account" : "→ I already have an account"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Auth;
