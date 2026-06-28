import { Link } from "react-router-dom";
import { NovelVizLogo } from "@/components/NovelVizLogo";

const Privacy = () => (
  <div className="min-h-screen bg-background">
    {/* Header */}
    <header className="ink-border-b">
      <div className="container mx-auto flex items-center gap-4 px-4 py-4">
        <Link
          to="/"
          className="group flex items-center gap-3 border border-foreground px-4 py-2 transition-colors hover:bg-foreground hover:text-background"
        >
          <NovelVizLogo size={28} className="text-foreground transition-colors group-hover:text-[#5ba3d9]" />
          <span className="font-sans text-sm font-bold tracking-tight">NovelViz</span>
        </Link>
        <span className="meta text-muted-foreground">/ Privacy Policy</span>
      </div>
    </header>

    <main className="container mx-auto max-w-3xl px-4 py-16">
      <div className="meta mb-4 text-muted-foreground">Legal</div>
      <h1 className="font-sans text-4xl font-bold tracking-tight leading-tight">
        Privacy Policy
      </h1>
      <p className="meta mt-3 text-muted-foreground">
        Last updated: June 27, 2026
      </p>

      <div className="mt-12 space-y-10 font-serif text-base leading-relaxed text-foreground/90">

        <section>
          <h2 className="mb-3 font-sans text-lg font-bold tracking-tight">1. Who we are</h2>
          <p>
            NovelViz is an independent app that helps readers visualise, analyse, and track books.
            We are the data controller for information collected through this app.
            You can reach us at{" "}
            <a href="mailto:privacy@novelviz.app" className="text-primary hover:underline">
              privacy@novelviz.app
            </a>.
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-sans text-lg font-bold tracking-tight">2. What data we collect and why</h2>

          <h3 className="mb-2 font-sans text-sm font-bold uppercase tracking-widest text-muted-foreground">Account data</h3>
          <p>
            When you create an account we collect your <strong>email address</strong> and a
            hashed password. This is processed by{" "}
            <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Supabase
            </a>{" "}
            (our authentication and database provider). Your email is used solely for sign-in
            and account recovery — we do not send marketing email.
          </p>

          <h3 className="mb-2 mt-6 font-sans text-sm font-bold uppercase tracking-widest text-muted-foreground">Gemini API key</h3>
          <p>
            All AI features (book analysis, recommendations) are powered by{" "}
            <strong>your own Google Gemini API key</strong>. You paste the key once and it is
            stored encrypted in your Supabase user profile so it syncs across your devices. We
            never transmit your key to any server we operate; it is sent directly from your device
            to Google's API.
          </p>

          <h3 className="mb-2 mt-6 font-sans text-sm font-bold uppercase tracking-widest text-muted-foreground">Book analysis cache</h3>
          <p>
            When you analyse a book, the resulting structured data (character lists, timelines,
            themes, etc.) is cached in our database so you and other users don't have to
            regenerate the same analysis. Cached analyses are keyed by book title — no personal
            information is stored alongside them. Shelf entries (which books you've saved and
            your reading status) are stored per-account and are only visible to you.
          </p>

          <h3 className="mb-2 mt-6 font-sans text-sm font-bold uppercase tracking-widest text-muted-foreground">Usage data</h3>
          <p>
            We do not run our own analytics or tracking. Standard server logs (IP address,
            request timestamps) are retained by our infrastructure providers (Supabase, Vercel)
            for up to 30 days for security and debugging purposes.
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-sans text-lg font-bold tracking-tight">3. Third-party services</h2>
          <p>The app connects to the following third-party services on your behalf:</p>
          <ul className="mt-3 list-disc pl-5 space-y-2">
            <li>
              <strong>Supabase</strong> — authentication, database, and edge functions.{" "}
              <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Privacy policy →
              </a>
            </li>
            <li>
              <strong>Google Gemini API</strong> — AI analysis using your own API key.
              Book titles and text prompts are sent to Google's servers when you run an analysis.{" "}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Privacy policy →
              </a>
            </li>
            <li>
              <strong>Vercel</strong> — CDN and static hosting.{" "}
              <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Privacy policy →
              </a>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 font-sans text-lg font-bold tracking-tight">4. Data retention and deletion</h2>
          <p>
            Your account data is retained until you delete your account. Shelf entries and cached
            analyses associated with your account are deleted when your account is deleted. To
            request account deletion, email{" "}
            <a href="mailto:privacy@novelviz.app" className="text-primary hover:underline">
              privacy@novelviz.app
            </a>{" "}
            and we will process your request within 30 days.
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-sans text-lg font-bold tracking-tight">5. Your rights</h2>
          <p>
            Depending on your jurisdiction you may have the right to access, correct, port, or
            erase your personal data, and to object to or restrict certain processing. To exercise
            any of these rights, contact us at{" "}
            <a href="mailto:privacy@novelviz.app" className="text-primary hover:underline">
              privacy@novelviz.app
            </a>.
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-sans text-lg font-bold tracking-tight">6. Children</h2>
          <p>
            NovelViz is not directed at children under 13 (or 16 where applicable). We do not
            knowingly collect personal information from children. If you believe a child has
            provided us with personal data, please contact us.
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-sans text-lg font-bold tracking-tight">7. Changes to this policy</h2>
          <p>
            We may update this policy from time to time. The "last updated" date at the top of
            this page will reflect any changes. Continued use of the app after changes are posted
            constitutes acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-sans text-lg font-bold tracking-tight">8. Contact</h2>
          <p>
            Questions or concerns about this policy?{" "}
            <a href="mailto:privacy@novelviz.app" className="text-primary hover:underline">
              privacy@novelviz.app
            </a>
          </p>
        </section>
      </div>
    </main>

    <footer className="ink-border-t mt-8">
      <div className="container mx-auto px-4 py-6">
        <div className="meta text-muted-foreground">
          © {new Date().getFullYear()} NovelViz ·{" "}
          <Link to="/" className="hover:text-foreground">Back to app</Link>
        </div>
      </div>
    </footer>
  </div>
);

export default Privacy;
