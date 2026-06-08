#!/usr/bin/env bash
# Novel Weaver — one-shot deploy script
# Run from the project root: bash deploy.sh
set -e

PROJECT_REF="iycncdnondipjcqwrtkn"
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Novel Weaver — Deploy                  ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── 1. Ensure Supabase CLI is available ──────────────────────────────────────
if ! command -v supabase &>/dev/null; then
  echo "▸ Installing Supabase CLI via Homebrew..."
  if command -v brew &>/dev/null; then
    brew install supabase/tap/supabase
  else
    echo "  Homebrew not found — installing via npm instead..."
    npm install -g supabase
  fi
fi

echo "▸ Supabase CLI: $(supabase --version)"
echo ""

# ── 2. Login (opens browser — approve MFA when prompted) ─────────────────────
echo "▸ Logging in to Supabase (a browser tab will open for MFA)..."
supabase login
echo ""

# ── 3. Link project ───────────────────────────────────────────────────────────
echo "▸ Linking to project $PROJECT_REF..."
supabase link --project-ref "$PROJECT_REF"
echo ""

# ── 4. Push DB migration ──────────────────────────────────────────────────────
echo "▸ Applying migration: 20260605000000_book_takeaways..."
supabase db push
echo ""

# ── 5. Deploy edge functions ──────────────────────────────────────────────────
echo "▸ Deploying analyze-novel..."
supabase functions deploy analyze-novel --no-verify-jwt

echo "▸ Deploying takeaways..."
supabase functions deploy takeaways

echo ""
echo "✓ All done! Both functions are live."
echo "  App: http://localhost:8080  (or npm run dev to restart)"
echo ""
