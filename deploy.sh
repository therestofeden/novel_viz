#!/usr/bin/env bash
# Novel Weaver — one-shot deploy script
# Run from the project root: bash deploy.sh
set -e

PROJECT_REF="ecsublyvcvzdkvggxwlh"
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
# All functions in supabase/functions (previously only 4 of 14 were listed
# here, which is how production drifted behind main). verify_jwt = false for
# each comes from supabase/config.toml; --no-verify-jwt kept as belt and braces.
for dir in supabase/functions/*/; do
  name="$(basename "$dir")"
  case "$name" in _*) continue ;; esac
  [ -f "$dir/index.ts" ] || continue
  echo "▸ Deploying $name..."
  supabase functions deploy "$name" --project-ref "$PROJECT_REF" --no-verify-jwt
done

echo ""
echo "✓ All done! Functions are live."
echo "  App: http://localhost:8080  (or npm run dev to restart)"
echo ""
