#!/usr/bin/env bash
# land.sh — take verified work from "done on my machine" to "merged into main",
# then clean up after itself. One command, zero babysitting.
#
#   scripts/git/land.sh "commit message"
#
# main cannot take a direct push: a GitHub ruleset requires a PR plus the
# changed-quality / guardrails / design-system-guardrails checks. But it
# requires ZERO approvals, so a PR with auto-merge enabled lands on its own the
# moment those checks go green. This script is that path, automated:
#
#   sync main -> branch -> commit -> push -> PR -> auto-merge -> delete branch
#
# Nothing is left behind: the branch deletes itself on merge (remote via
# --delete-branch, local via `sync.sh --prune`).
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

MESSAGE="${1:-}"
if [[ -z "$MESSAGE" ]]; then
  echo "usage: scripts/git/land.sh \"commit message\"" >&2
  exit 1
fi

if [[ -z "$(git status --porcelain)" ]] && git diff --quiet origin/main...HEAD 2>/dev/null; then
  echo "Nothing to land — no uncommitted changes and nothing ahead of main."
  exit 0
fi

git fetch origin --quiet

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" == "main" ]]; then
  # Slugify the message into a branch name so the caller never has to name one.
  SLUG="$(printf '%s' "$MESSAGE" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' \
    | cut -c1-48)"
  BRANCH="auto/${SLUG:-change}-$(git rev-parse --short HEAD)"
  git checkout -q -b "$BRANCH"
  echo "→ branched: $BRANCH"
fi

if [[ -n "$(git status --porcelain)" ]]; then
  git add -A
  git commit -q -m "$MESSAGE" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
  echo "→ committed"
fi

# Rebase before pushing so the PR is never stale on arrival.
git rebase origin/main
git push -q -u origin "$BRANCH" --force-with-lease
echo "→ pushed: $BRANCH"

URL="$(gh pr view --json url -q .url 2>/dev/null || true)"
if [[ -z "$URL" ]]; then
  URL="$(gh pr create --base main --head "$BRANCH" --title "$MESSAGE" --fill)"
fi
gh pr ready "$URL" >/dev/null 2>&1 || true
gh pr merge "$URL" --squash --auto --delete-branch >/dev/null
echo "→ auto-merge armed: $URL"
echo
echo "It will merge into main by itself once checks pass. Nothing else to do."
