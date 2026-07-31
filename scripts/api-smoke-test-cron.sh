#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Cron wrapper for API smoke test
# Checks if dev server is running before testing. Silent when server is down.
# Add to crontab: */5 * * * * /path/to/scripts/api-smoke-test-cron.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BASE_URL="${API_SMOKE_BASE_URL:-http://localhost:3000}"

# Only run if dev server is actually up
status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "${BASE_URL}/api/health" 2>/dev/null || echo "000")
if [[ "$status" == "000" ]]; then
  exit 0  # Server not running — silently skip
fi

# Run the smoke test in quiet mode (only show failures)
"${SCRIPT_DIR}/api-smoke-test.sh" --quiet
