#!/usr/bin/env bash
# Run eve with a Node 24 runtime, portably.
#
# eve requires Node >= 24. On macOS this project uses an isolated, keg-only
# Homebrew node@24 so the global Node can stay on another version; if that
# install is present we prepend it to PATH. In CI/Linux (where Node 24 is
# already the default) the brew lookup is skipped and eve runs directly.
#
# Usage (via package.json scripts): `npm run eve -- <args>` / `npm run eve:dev`.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
agent_root="$repo_root/agents/app-expert-eve-lab"

if command -v brew >/dev/null 2>&1; then
  node24_bin="$(brew --prefix node@24 2>/dev/null)/bin"
  if [ -d "$node24_bin" ]; then
    PATH="$node24_bin:$PATH"
  fi
fi

if [ ! -x "$agent_root/node_modules/.bin/eve" ]; then
  echo "Eve dependencies are not installed for agents/app-expert-eve-lab/. Run npm install at the repo root, then retry." >&2
  exit 1
fi

cd "$agent_root"
exec ./node_modules/.bin/eve "$@"
