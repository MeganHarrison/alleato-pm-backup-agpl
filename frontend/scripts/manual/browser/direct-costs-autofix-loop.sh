#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/Users/meganharrison/Documents/github/alleato-pm"
FRONTEND_DIR="$ROOT_DIR/frontend"
WORKFLOW_SCRIPT="$FRONTEND_DIR/scripts/manual/browser/direct-costs-workflow.js"
OUTPUT_ROOT="$ROOT_DIR/output/playwright/direct-costs-workflow"
LAST_REPORT="$OUTPUT_ROOT/last-run.json"

# Save CLI overrides before sourcing .env files
_CLI_BASE_URL="${BASE_URL:-}"
_CLI_PROJECT_ID="${PROJECT_ID:-}"
_CLI_HEADLESS="${HEADLESS:-}"
_CLI_LOGIN_EMAIL="${LOGIN_EMAIL:-}"
_CLI_LOGIN_PASSWORD="${LOGIN_PASSWORD:-}"
_CLI_CODEX_MODEL="${CODEX_MODEL:-}"
_CLI_STORAGE_STATE="${STORAGE_STATE:-}"
_CLI_MAX_ATTEMPTS="${MAX_ATTEMPTS:-}"

set -a
[[ -f "$FRONTEND_DIR/.env" ]] && . "$FRONTEND_DIR/.env"
[[ -f "$FRONTEND_DIR/.env.local" ]] && . "$FRONTEND_DIR/.env.local"
set +a

# Restore CLI overrides (CLI takes precedence over .env files)
[[ -n "$_CLI_BASE_URL" ]] && BASE_URL="$_CLI_BASE_URL"
[[ -n "$_CLI_PROJECT_ID" ]] && PROJECT_ID="$_CLI_PROJECT_ID"
[[ -n "$_CLI_HEADLESS" ]] && HEADLESS="$_CLI_HEADLESS"
[[ -n "$_CLI_LOGIN_EMAIL" ]] && LOGIN_EMAIL="$_CLI_LOGIN_EMAIL"
[[ -n "$_CLI_LOGIN_PASSWORD" ]] && LOGIN_PASSWORD="$_CLI_LOGIN_PASSWORD"
[[ -n "$_CLI_CODEX_MODEL" ]] && CODEX_MODEL="$_CLI_CODEX_MODEL"
[[ -n "$_CLI_STORAGE_STATE" ]] && STORAGE_STATE="$_CLI_STORAGE_STATE"
[[ -n "$_CLI_MAX_ATTEMPTS" ]] && MAX_ATTEMPTS="$_CLI_MAX_ATTEMPTS"

BASE_URL="${BASE_URL:-}"
PROJECT_ID="${PROJECT_ID:-}"
HEADLESS="${HEADLESS:-true}"
LOGIN_EMAIL="${LOGIN_EMAIL:-}"
LOGIN_PASSWORD="${LOGIN_PASSWORD:-}"
STORAGE_STATE="${STORAGE_STATE:-$FRONTEND_DIR/tests/.auth/user.json}"
CODEX_MODEL="${CODEX_MODEL:-}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-5}" # set 0 for infinite

required_vars=(BASE_URL PROJECT_ID LOGIN_EMAIL LOGIN_PASSWORD CODEX_MODEL)
for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name}" ]]; then
    echo "Missing required environment variable: $var_name"
    echo "Set it in $FRONTEND_DIR/.env or $FRONTEND_DIR/.env.local, or export it in shell."
    exit 1
  fi
done

mkdir -p "$OUTPUT_ROOT"

attempt=1
while true; do
  echo
  echo "=============================="
  echo "Direct Costs Auto-Fix Attempt $attempt"
  echo "=============================="

  set +e
  (
    cd "$FRONTEND_DIR"
    BASE_URL="$BASE_URL" \
    PROJECT_ID="$PROJECT_ID" \
    HEADLESS="$HEADLESS" \
    LOGIN_EMAIL="$LOGIN_EMAIL" \
    LOGIN_PASSWORD="$LOGIN_PASSWORD" \
    STORAGE_STATE="$STORAGE_STATE" \
    RUN_LABEL="attempt-$attempt" \
    node "$WORKFLOW_SCRIPT"
  ) | tee "$OUTPUT_ROOT/attempt-$attempt.log"
  status="${PIPESTATUS[0]}"
  set -e

  if [[ "$status" -eq 0 ]]; then
    echo "✅ Workflow passed on attempt $attempt"
    exit 0
  fi

  echo "❌ Workflow failed on attempt $attempt"
  if [[ -f "$LAST_REPORT" ]]; then
    echo "Failure report:"
    jq -r '.status, .error, .outputDir' "$LAST_REPORT" || true
  fi

  if [[ "$MAX_ATTEMPTS" -ne 0 && "$attempt" -ge "$MAX_ATTEMPTS" ]]; then
    echo "🛑 Reached MAX_ATTEMPTS=$MAX_ATTEMPTS. Stopping."
    exit 1
  fi

  FIX_PROMPT_FILE="$OUTPUT_ROOT/fix-prompt-$attempt.txt"
  cat > "$FIX_PROMPT_FILE" <<EOF
Fix the failing Direct Costs Playwright workflow and re-verify.

Context:
- Repository: $ROOT_DIR
- Workflow script: /Users/meganharrison/Documents/github/alleato-pm/frontend/scripts/manual/browser/direct-costs-workflow.js
- Last report JSON: $LAST_REPORT
- Attempt log: $OUTPUT_ROOT/attempt-$attempt.log

Tasks:
1) Read the report/log and failure screenshot directory.
2) Identify root cause.
3) Apply code/script fixes in repo.
4) Re-run the exact workflow command to confirm pass:
   cd /Users/meganharrison/Documents/github/alleato-pm/frontend &&
   BASE_URL="$BASE_URL" PROJECT_ID="$PROJECT_ID" HEADLESS="$HEADLESS" LOGIN_EMAIL="$LOGIN_EMAIL" LOGIN_PASSWORD="$LOGIN_PASSWORD" STORAGE_STATE="$STORAGE_STATE" node scripts/manual/browser/direct-costs-workflow.js
5) If it still fails, continue fixing until it passes in your execution for this iteration.
6) Return a concise summary of what was changed and verification result.
EOF
  FIX_PROMPT="$(cat "$FIX_PROMPT_FILE")"

  echo "🤖 Invoking Codex auto-fix..."
  set +e
  codex exec \
    -m "$CODEX_MODEL" \
    --full-auto \
    -C "$ROOT_DIR" \
    "$FIX_PROMPT" | tee "$OUTPUT_ROOT/codex-attempt-$attempt.log"
  codex_status="${PIPESTATUS[0]}"
  set -e

  if [[ "$codex_status" -ne 0 ]]; then
    echo "🛑 Codex auto-fix invocation failed (exit $codex_status). Stopping."
    exit 1
  fi

  if rg -n "does not exist or you do not have access|^\\[.*\\] ERROR:|stream disconnected before completion" "$OUTPUT_ROOT/codex-attempt-$attempt.log" >/dev/null 2>&1; then
    echo "🛑 Codex auto-fix returned provider/model error. Stopping."
    exit 1
  fi

  echo "✅ Codex completed successfully"

  attempt=$((attempt + 1))
done
