# NovelViz — Visualize Any Book

Type a book title; get an interactive map of it. Fiction unfolds into characters,
relationships, and narrative timelines; non-fiction into concepts, arguments, and
chapter breakdowns. Every book also gets a 12-axis "literary DNA" profile, a
kindred-book recommendation, personal takeaway journaling, and shelf-based
recommendations.

**Stack:** React 18 + Vite + TypeScript + Tailwind/shadcn · Supabase (Postgres,
Auth, Edge Functions) · Google Gemini (`gemini-3.5-flash` with a fallback chain).

## Quick start (testers)

Prereqs: Node 20+ and npm.

```sh
git clone https://github.com/therestofeden/novel_viz.git
cd "novel_viz/Novel Weaver"
npm install
cp .env.example .env   # then fill in the Supabase values (see below)
npm run dev            # http://localhost:8080
```

Get the three `.env` values from the project owner, or from your own Supabase
project under **Settings → API** (URL, project ref, publishable/anon key).
They are client-side keys — no service-role or Gemini key belongs in `.env`.

## Scripts

| Command          | What it does                       |
| ---------------- | ---------------------------------- |
| `npm run dev`    | Dev server with hot reload         |
| `npm run build`  | Production build to `dist/`        |
| `npm test`       | Run unit tests (Vitest)            |
| `npm run lint`   | ESLint                             |

## What to test

1. **Analyze a book** — search any title (e.g. *Cloud Atlas* for fiction,
   *Sapiens* for non-fiction). Fiction shows Timeline / Network / DNA /
   Takeaways tabs; non-fiction shows Concepts / Chapters / DNA / Takeaways.
2. **Spoiler shield** (fiction) — set a reading-progress %, late events stay masked.
3. **Shelf** — sign in, add books, view the DNA constellation, compare networks.
4. **Anti-Shelf** — recommendations in "similar" and "stretch" modes.
5. **Takeaways** — answer the reflection questions, get a synthesized note.

If analysis fails with "AI service is overloaded", that's upstream Gemini
load-shedding — the backend already retries across three models; just try again.

## Architecture

```
src/                      React app (pages, components, hooks)
supabase/functions/       Edge functions (Deno)
  analyze-novel/          Book → structured analysis (SSE stream, cached)
  takeaways/              Reflection questions + synthesis (auth required)
  recommend-anti-shelf/   Shelf-based recommendations (auth required)
  search-books/           Open Library autocomplete proxy
  popular-books/          Local typeahead index of analyzed titles
  resolve-buy-link/       Purchase-link resolution
supabase/migrations/      Postgres schema
```

Server-side secrets (`GEMINI_API_KEY`, service role) live in Supabase function
secrets, never in this repo.

### Gemini model policy

Google retired `gemini-2.0-*` on 2026-06-01. Functions call `gemini-3.5-flash`
and fall back through `gemini-2.5-flash` → `gemini-2.5-flash-lite` on 429/503.
The preamble model `gemini-2.5-flash-lite` retires 2026-10-16 — swap it when a
3.5 lite tier ships.

## Deploying edge functions

The live Supabase project ref is in `supabase/.temp/linked-project.json`.

```sh
supabase login
supabase link --project-ref <live-project-ref>
supabase db push
supabase functions deploy analyze-novel --no-verify-jwt
supabase functions deploy takeaways --no-verify-jwt
supabase functions deploy recommend-anti-shelf --no-verify-jwt
```

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs install → test → build on
every push and PR to `main`.
