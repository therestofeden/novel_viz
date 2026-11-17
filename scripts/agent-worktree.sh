#!/usr/bin/env bash
# Give each scheduled agent its own git worktree so concurrent runs never share
# an index, HEAD or working tree.
#
#   scripts/agent-worktree.sh <backend|feat|launch|canon>
#       Creates or refreshes ../.worktrees/<name> on branch agent/<name>,
#       rebased onto origin/main, and prints its absolute path.
#   scripts/agent-worktree.sh push
#       Run from inside a worktree: re-fetch, rebase onto origin/main, push
#       HEAD to main. Retries once if another agent pushed in between.
#
# The Cowork VM mounts this folder at a different path every session, so the
# absolute paths git stores for worktrees go stale between runs; every call
# runs `git worktree repair` to re-link them. node_modules is a relative
# symlink to the main checkout's, so worktrees cost no extra install.
set -euo pipefail

push() {
  git rev-parse --is-inside-work-tree >/dev/null
  for attempt in 1 2; do
    git fetch -q origin main
    git rebase -q origin/main
    if git push -q origin HEAD:main; then
      echo "pushed $(git rev-parse --short HEAD) to main"; return 0
    fi
    echo "push rejected (attempt $attempt), retrying after re-fetch" >&2
  done
  echo "ERROR: push failed twice" >&2; return 1
}

[ "${1:-}" = push ] && { push; exit; }

name="${1:?usage: agent-worktree.sh <backend|feat|launch|canon> | push}"
case "$name" in backend|feat|launch|canon) ;; *) echo "unknown agent: $name" >&2; exit 2 ;; esac

main="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
root="$(dirname "$main")/.worktrees"
wt="$root/$name"
branch="agent/$name"

cd "$main"
mkdir -p "$root"
# 2026-11-16 (daily_backend): repair EVERY agent worktree before pruning, not
# just our own. Each Cowork session mounts this folder at its own
# /sessions/<id>/ path, so from one session every other agent's worktree looks
# missing; a bare `prune` deleted their .git/worktrees/<name> metadata, and the
# `rm -rf "$wt"` below then wiped any uncommitted work on their next start
# (lost the backend worktree mid-run on 2026-11-16).
for d in "$root"/*/; do
  [ -e "$d.git" ] && git worktree repair "$d" >/dev/null 2>&1 || true
done
git fetch -q origin main
# 2026-11-17 (daily_backend): agents start this script from the shared
# checkout, which nobody pulls, so they kept running a stale copy (the 11-17
# backend start ran the pre-f3a75af version and pruned + tried to rm -rf its
# own worktree). Fast-forward the shared checkout when it is clean and on
# main, then re-exec the fresh script once.
if [ -z "${AGENT_WT_REEXEC:-}" ] && [ "$(git symbolic-ref -q --short HEAD)" = main ] \
   && [ -z "$(git status --porcelain --untracked-files=no)" ] \
   && git merge -q --ff-only origin/main 2>/dev/null; then
  AGENT_WT_REEXEC=1 exec "$main/scripts/agent-worktree.sh" "$@"
fi
git worktree prune

if ! git -C "$wt" rev-parse --git-dir >/dev/null 2>&1; then
  # Never discard files an earlier run left behind: park them first.
  [ -d "$wt" ] && [ -n "$(ls -A "$wt" 2>/dev/null)" ] && mv "$wt" "$root/.orphan-$name-$(date +%Y%m%d-%H%M%S)"
  rm -rf "$wt"
  git worktree add -q --detach "$wt" origin/main
fi

cd "$wt"
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "WARN: uncommitted changes left by a previous run; stashed" >&2
  git stash push -q -m "agent-$name-$(date +%Y%m%d-%H%M%S)"
fi

if git show-ref -q --verify "refs/heads/$branch"; then
  git checkout -q "$branch"
  if [ "$(git rev-list --count origin/main..HEAD)" -gt 0 ]; then
    if ! git rebase -q origin/main; then
      git rebase --abort
      keep="$branch-unpushed-$(date +%Y%m%d-%H%M%S)"
      git branch -m "$keep"
      echo "WARN: unpushed commits conflict with origin/main; kept as $keep" >&2
      git checkout -q -b "$branch" origin/main
    fi
  else
    git reset -q --hard origin/main
  fi
else
  git checkout -q -b "$branch" origin/main
fi

# Share the main checkout's dependencies and (gitignored) env files; Vite
# needs .env to fill the %VITE_*% placeholders in index.html.
for f in node_modules .env .env.local .env.production; do
  [ -e "$main/$f" ] && [ ! -e "$f" ] && ln -s "../../$(basename "$main")/$f" "$f" || true
done
echo "$wt"
