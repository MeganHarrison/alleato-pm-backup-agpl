#!/usr/bin/env bash
# Capture all tutorial workflows. Refreshes auth before each (fresh session
# avoids refresh-token rotation), runs the recorder against the local dev server.
# Usage: scripts/tutorials/run-all.sh
set -uo pipefail
cd "$(cd "$(dirname "$0")/../.." && pwd)"

BASE_URL="${TUTORIAL_BASE_URL:-http://localhost:3001}"
STATE="frontend/tests/.auth/user.json"
WF_DIR="scripts/tutorials/workflows"

pass=0; fail=0; failed=()
for wf in "$WF_DIR"/*.workflow.ts; do
  name="$(basename "$wf" .workflow.ts)"
  node scripts/tutorials/refresh-auth.mjs >/dev/null 2>&1
  echo "── capturing $name"
  if npm run --silent tutorial:capture -- "$wf" --base-url "$BASE_URL" --storage-state "$STATE" >/tmp/tut-$name.log 2>&1; then
    echo "   ✓ $name"
    pass=$((pass+1))
  else
    echo "   ✗ $name — $(grep -m1 -iE 'error|wrong screen|not found' /tmp/tut-$name.log | head -c 160)"
    fail=$((fail+1)); failed+=("$name")
  fi
done
echo ""
echo "DONE: $pass captured, $fail failed"
[ "$fail" -gt 0 ] && printf 'failed: %s\n' "${failed[*]}"
exit 0
