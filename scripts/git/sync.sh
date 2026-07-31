#!/usr/bin/env bash
# sync.sh — pull main and delete everything that has already landed.
#
#   scripts/git/sync.sh            # update main, report what is stale
#   scripts/git/sync.sh --prune    # ...and actually delete the stale things
#
# "Stale" means provably safe to delete:
#   - a local branch whose commits are all already in main
#   - a worktree whose branch is merged AND whose tree has no uncommitted files
#
# Anything with unmerged commits or uncommitted files is REPORTED, never
# deleted. Removing a worktree does not delete its branch, so disk is always
# recoverable; deleting a merged branch loses nothing, because main has it.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
PRUNE=false
[[ "${1:-}" == "--prune" ]] && PRUNE=true
GIT_COMMON_DIR="$(git rev-parse --git-common-dir)"
ACTIVE_WORKSPACE_REGISTRY="$(cd "$GIT_COMMON_DIR" && pwd)/codex-isolated-workspaces.json"

# An isolated workspace can intentionally start from main with a clean tree.
# It is still owned until the workspace registry marks it retired, so cleanup
# must not infer that it is disposable merely because it has no commits yet.
is_active_registered_workspace() {
  local field="$1"
  local value="$2"
  [[ -f "$ACTIVE_WORKSPACE_REGISTRY" ]] || return 1
  node - "$ACTIVE_WORKSPACE_REGISTRY" "$field" "$value" <<'NODE'
const fs = require("node:fs");
const [registryPath, field, value] = process.argv.slice(2);
try {
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const now = Date.now();
  const matches = (registry.workspaces || []).some((workspace) => {
    if (workspace.status !== "active" || workspace[field] !== value) return false;
    const expiresAt = Date.parse(workspace.expiresAt);
    return !Number.isFinite(expiresAt) || expiresAt > now;
  });
  process.exit(matches ? 0 : 1);
} catch {
  // A malformed registry must not make routine Git sync fail. It remains
  // visible through the workspace status command for repair.
  process.exit(1);
}
NODE
}

git fetch origin --prune --quiet

# Remove a worktree, then make sure the directory is actually gone.
#
# `git worktree remove` refuses with "Directory not empty" whenever ignored
# files survive in the tree — which on this repo means node_modules/ and .next/,
# i.e. every worktree that is actually big. Left unhandled, the checkouts that
# waste the most disk are the only ones never reclaimed. Callers reach this only
# after proving the tree is clean and the work has landed, so deleting the
# remaining ignored build output loses nothing.
remove_worktree() {
  local wt="$1"
  # De-register first. This can report success while leaving ignored files on
  # disk, so the directory is always swept afterwards regardless of the result —
  # otherwise git looks clean while gigabytes quietly remain.
  git worktree remove --force "$wt" 2>/dev/null || true
  rm -rf "$wt" 2>/dev/null || true
  git worktree prune
  [[ ! -d "$wt" ]]
}

# Fast-forward main without disturbing whatever is checked out right now.
# A diverged main is reported, never force-moved — that would discard commits.
if [[ "$(git rev-parse --abbrev-ref HEAD)" == "main" ]]; then
  git merge --ff-only origin/main 2>/dev/null || true
else
  git fetch origin main:main --quiet 2>/dev/null || true
fi

BEHIND=$(git rev-list --count main..origin/main)
AHEAD=$(git rev-list --count origin/main..main)
if [[ "$AHEAD" != "0" ]]; then
  echo "! main has $AHEAD local commit(s) NOT on GitHub, and is $BEHIND behind."
  echo "  Land them with:  scripts/git/land.sh \"<what they do>\""
  git log --oneline origin/main..main | sed 's/^/    /'
elif [[ "$BEHIND" != "0" ]]; then
  echo "! main is $BEHIND behind origin/main and did not fast-forward."
else
  echo "main is up to date with GitHub."
fi
echo "main is at: $(git log --oneline -1 main)"
echo

# Is this branch's work already on main?
#
# The ancestor test alone is WRONG here: this repo squash-merges, so a merged
# branch's commits never become ancestors of main and every branch would look
# unmerged forever — the script would then never clean anything, which is the
# exact sprawl it exists to prevent. So ask GitHub whether the branch had a
# merged PR, and fall back to the ancestor test for branches that never had one.
is_landed() {
  local br="$1"
  [[ "$(git rev-list --count origin/main.."$br" 2>/dev/null || echo 1)" == "0" ]] && return 0
  # Patch-equivalence: `git cherry` marks a commit "-" when its patch is already
  # upstream (cherry-picked or rebased onto main). Without this, a branch whose
  # every change is already in main looks unmerged forever and its ~450MB
  # checkout is never reclaimed.
  if [[ -z "$(git cherry origin/main "$br" 2>/dev/null | grep '^+')" ]]; then
    return 0
  fi
  [[ -n "$(gh pr list --head "${br#refs/heads/}" --state merged --limit 1 --json number -q '.[].number' 2>/dev/null)" ]]
}

echo "== WORKTREES =="
# Emit one line per worktree block, including DETACHED ones. Keying only off
# `branch` lines (as this did originally) silently skipped every detached
# worktree — and those are the biggest offenders, since a verification or
# review checkout is left detached and then never reclaimed.
git worktree list --porcelain \
| awk '/^worktree /{if(w!="")print w"|"b; w=$2; b="DETACHED"} /^branch /{b=$2} END{if(w!="")print w"|"b}' \
| while IFS='|' read -r wt br; do
  short=${br#refs/heads/}
  [[ "$short" == "main" ]] && continue
  if is_active_registered_workspace worktree "$wt"; then
    echo "  KEEP     $short  (active registered workspace)"
    continue
  fi
  dirty=$(git -C "$wt" status --porcelain 2>/dev/null | wc -l | tr -d ' ')

  # A detached worktree owns no branch, so nothing can reference its commits;
  # with a clean tree there is no work to lose and the disk is pure waste.
  if [[ "$short" == "DETACHED" ]]; then
    label="(detached) $(basename "$wt")"
    if [[ "$dirty" == "0" ]]; then
      if $PRUNE; then
        remove_worktree "$wt" && echo "  deleted  $label" || echo "  FAILED   $label (in use?)"
      else
        echo "  stale    $label  (detached, clean)"
      fi
    else
      echo "  KEEP     $label  ($dirty uncommitted)"
    fi
    continue
  fi

  ahead=$(git rev-list --count origin/main.."$br" 2>/dev/null || echo 0)
  if is_landed "$br" && [[ "$dirty" == "0" ]]; then
    if $PRUNE; then
      remove_worktree "$wt" && echo "  deleted  $short" || echo "  FAILED   $short (in use?)"
    else
      echo "  stale    $short  (merged, clean)"
    fi
  else
    echo "  KEEP     $short  ($ahead unmerged, $dirty uncommitted)"
  fi
done
git worktree prune

echo
echo "== BRANCHES =="
git for-each-ref --format='%(refname:short)' refs/heads \
| while read -r br; do
  [[ "$br" == "main" ]] && continue
  if is_active_registered_workspace branch "$br"; then
    echo "  KEEP     $br  (active registered workspace)"
    continue
  fi
  git worktree list --porcelain | grep -q "^branch refs/heads/$br$" && continue
  if is_landed "$br"; then
    if $PRUNE; then
      git branch -D "$br" >/dev/null && echo "  deleted  $br"
    else
      echo "  stale    $br  (fully merged)"
    fi
  fi
done

echo
$PRUNE || echo "Run with --prune to delete the stale entries above."
