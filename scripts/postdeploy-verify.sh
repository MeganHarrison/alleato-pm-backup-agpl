#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${POSTDEPLOY_BASE_URL:-${API_SMOKE_BASE_URL:-}}"
if [[ -z "${BASE_URL}" ]]; then
  echo "POSTDEPLOY_BASE_URL or API_SMOKE_BASE_URL is required"
  exit 1
fi

echo "== Post-deploy Verification =="
echo "Base URL: ${BASE_URL}"

check_status() {
  local name="$1"
  local expected="$2"
  local method="$3"
  local path="$4"
  local status
  status=$(curl -s -o /tmp/postdeploy-body.json -w "%{http_code}" -X "$method" "${BASE_URL}${path}")
  if [[ "${status}" != "${expected}" ]]; then
    echo "FAIL ${name}: expected ${expected}, got ${status} (${path})"
    cat /tmp/postdeploy-body.json || true
    exit 1
  fi
  echo "PASS ${name}: ${status} (${path})"
}

check_status "App health" "200" "GET" "/api/health"
check_status "Protected route auth check" "401" "GET" "/api/projects"
check_status "Cron auth check" "401" "POST" "/api/cron/daily-flags"
check_status "Monitoring route auth check" "401" "GET" "/api/monitoring/notify"

echo "== Render Provider Env Verification =="
RENDER_ENV_STRICT=true node scripts/verify/verify_deep_agents_docs_wiki_render_env.mjs

echo "== Render Backend Runtime Contract Verification =="
RENDER_ENV_STRICT=true node scripts/verify/verify-render-backend-runtime-contract.mjs

echo "Post-deploy verification passed."
