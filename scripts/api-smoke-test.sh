#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# API Smoke Test — hits every known GET endpoint and flags 500s
#
# Usage:
#   ./scripts/api-smoke-test.sh              # run once
#   ./scripts/api-smoke-test.sh --watch      # run every 5 minutes
#   ./scripts/api-smoke-test.sh --quiet      # suppress passing endpoints
#
# Requires: curl, a running Next.js dev server on localhost:3000
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BASE_URL="${API_SMOKE_BASE_URL:-http://localhost:3000}"
PROJECT_ID="${API_SMOKE_PROJECT_ID:-67}"
LOG_FILE="/tmp/api-smoke-failures.log"
WATCH_MODE=false
QUIET=false

# Parse flags
for arg in "$@"; do
  case "$arg" in
    --watch) WATCH_MODE=true ;;
    --quiet) QUIET=true ;;
  esac
done

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ─── Fake IDs for detail endpoints ─────────────────────────────────────────
FAKE_UUID="00000000-0000-0000-0000-000000000000"
FAKE_INT="999999"

# ─── All GET endpoints to test ─────────────────────────────────────────────
# Format: "METHOD URL DESCRIPTION"
# We test GET list endpoints (should return 200 or [])
# and GET detail endpoints with fake IDs (should return 404, NOT 500)
ENDPOINTS=(
  # ─── Health ───
  "GET /api/health Health check"

  # ─── Projects ───
  "GET /api/projects Projects list"
  "GET /api/projects/${PROJECT_ID} Project detail"

  # ─── Budget ───
  "GET /api/projects/${PROJECT_ID}/budget/details Budget details"
  "GET /api/projects/${PROJECT_ID}/budget/history Budget history"
  "GET /api/projects/${PROJECT_ID}/budget/forecast Budget forecast"
  "GET /api/projects/${PROJECT_ID}/budget/snapshots Budget snapshots"
  "GET /api/projects/${PROJECT_ID}/budget/direct-costs Budget direct costs"
  "GET /api/projects/${PROJECT_ID}/budget-codes Budget codes"
  "GET /api/projects/${PROJECT_ID}/budget-codes/acumatica Acumatica budget codes"

  # ─── Change Events ───
  "GET /api/projects/${PROJECT_ID}/change-events Change events list"
  "GET /api/projects/${PROJECT_ID}/change-events/${FAKE_UUID} Change event detail"
  "GET /api/projects/${PROJECT_ID}/change-events/origin-options Change event origin options"

  # ─── Change Orders / PCOs ───
  "GET /api/projects/${PROJECT_ID}/prime-contract-pcos Prime PCOs list"
  "GET /api/projects/${PROJECT_ID}/prime-contract-pcos/${FAKE_UUID} Prime PCO detail"
  "GET /api/projects/${PROJECT_ID}/commitment-pcos Commitment PCOs list"
  "GET /api/projects/${PROJECT_ID}/commitment-pcos/${FAKE_UUID} Commitment PCO detail"
  "GET /api/projects/${PROJECT_ID}/pcos All PCOs"

  # ─── Contracts ───
  "GET /api/projects/${PROJECT_ID}/contracts Contracts list"

  # ─── Commitments ───
  "GET /api/commitments Commitments list (global)"

  # ─── Direct Costs ───
  "GET /api/projects/${PROJECT_ID}/direct-costs/export Direct costs export"

  # ─── Invoicing ───
  "GET /api/projects/${PROJECT_ID}/invoicing/subcontractor Subcontractor invoicing"
  "GET /api/projects/${PROJECT_ID}/invoicing/subcontractor/invoices Sub invoices list"
  "GET /api/projects/${PROJECT_ID}/invoicing/payments Payments list"
  "GET /api/projects/${PROJECT_ID}/invoicing/billing-periods Billing periods"
  "GET /api/projects/${PROJECT_ID}/invoicing/settings Invoicing settings"
  "GET /api/projects/${PROJECT_ID}/billing-periods Billing periods (alt)"
  "GET /api/invoices Invoices (global)"

  # ─── Estimates ───
  "GET /api/projects/${PROJECT_ID}/estimates Estimates list"
  "GET /api/projects/${PROJECT_ID}/estimates/${FAKE_UUID} Estimate detail"
  "GET /api/estimates Estimates (global)"
  "GET /api/estimates/stats Estimates stats"

  # ─── Directory (Project) ───
  "GET /api/projects/${PROJECT_ID}/directory/companies Directory companies"
  "GET /api/projects/${PROJECT_ID}/directory/people Directory people"
  "GET /api/projects/${PROJECT_ID}/directory/groups Directory groups"
  "GET /api/projects/${PROJECT_ID}/directory/vendors Directory vendors"
  "GET /api/projects/${PROJECT_ID}/directory/roles Directory roles"
  "GET /api/projects/${PROJECT_ID}/directory/permissions Directory permissions"
  "GET /api/projects/${PROJECT_ID}/directory/activity Directory activity"
  "GET /api/projects/${PROJECT_ID}/directory/filters Directory filters"
  "GET /api/projects/${PROJECT_ID}/directory/preferences Directory preferences"

  # ─── Directory (Global) ───
  "GET /api/companies Companies (global)"
  "GET /api/directory/companies Directory companies (global)"
  "GET /api/directory/vendors Vendors (global)"
  "GET /api/directory/project-companies Project companies"
  "GET /api/contacts Contacts"
  "GET /api/people People"
  "GET /api/employees Employees"
  "GET /api/users Users"

  # ─── Permissions ───
  "GET /api/projects/${PROJECT_ID}/permissions Project permissions"
  "GET /api/permissions/templates Permission templates"

  # ─── RFIs ───
  "GET /api/projects/${PROJECT_ID}/rfis RFIs list"
  "GET /api/projects/${PROJECT_ID}/rfis/${FAKE_UUID} RFI detail"

  # ─── Submittals ───
  "GET /api/projects/${PROJECT_ID}/submittals Submittals list"
  "GET /api/projects/${PROJECT_ID}/submittals/${FAKE_UUID} Submittal detail"
  "GET /api/projects/${PROJECT_ID}/submittals/packages Submittal packages"
  "GET /api/projects/${PROJECT_ID}/submittals/specs Submittal specs"

  # ─── Submittal Workflow Templates ───
  "GET /api/projects/${PROJECT_ID}/submittals/workflow-templates Workflow templates list"

  # ─── Drawings ───
  "GET /api/projects/${PROJECT_ID}/drawings Drawings list"
  "GET /api/projects/${PROJECT_ID}/drawings/${FAKE_UUID} Drawing detail"
  "GET /api/projects/${PROJECT_ID}/drawings/sets Drawing sets"
  "GET /api/projects/${PROJECT_ID}/drawings/areas Drawing areas"
  "GET /api/projects/${PROJECT_ID}/drawings/recycle-bin Drawings recycle bin"
  "GET /api/projects/${PROJECT_ID}/drawings/${FAKE_UUID}/related-items Drawing related items"
  "GET /api/projects/${PROJECT_ID}/drawings/${FAKE_UUID}/change-history Drawing change history"
  "GET /api/projects/${PROJECT_ID}/drawings/${FAKE_UUID}/qr-code Drawing QR code"

  # ─── Specifications ───
  "GET /api/projects/${PROJECT_ID}/specifications Specifications list"
  "GET /api/projects/${PROJECT_ID}/specifications/areas Spec areas"

  # ─── Scheduling ───
  "GET /api/projects/${PROJECT_ID}/scheduling/tasks Schedule tasks"

  # ─── Meetings ───
  "GET /api/projects/${PROJECT_ID}/meetings Meetings list"

  # ─── Photos ───
  "GET /api/projects/${PROJECT_ID}/photos Photos list"
  "GET /api/projects/${PROJECT_ID}/photo-albums Photo albums"

  # ─── Documents ───
  "GET /api/projects/${PROJECT_ID}/documents Documents list"
  "GET /api/projects/${PROJECT_ID}/transmittals Transmittals"
  "GET /api/projects/${PROJECT_ID}/emails Emails"

  # ─── Punch Items ───
  "GET /api/projects/${PROJECT_ID}/punch-items Punch items"
  "GET /api/projects/${PROJECT_ID}/checklist Checklist"

  # ─── Other Project-Scoped ───
  "GET /api/projects/${PROJECT_ID}/vendors Vendors"
  "GET /api/projects/${PROJECT_ID}/employees Project employees"
  "GET /api/projects/${PROJECT_ID}/subcontracts Subcontracts"
  "GET /api/projects/${PROJECT_ID}/purchase-orders Purchase orders"
  "GET /api/projects/${PROJECT_ID}/vertical-markup Vertical markup"

  # ─── AI / Assistant ───
  "GET /api/ai-assistant/usage-stats AI usage stats"
  "GET /api/ai-assistant/conversations AI conversations"
  "GET /api/ai-assistant/memories AI memories"
  "GET /api/ai-assistant/timeline AI timeline"
  # POST /api/ai-assistant/task-feedback — POST-only; requires JSON body {projectId,signal,taskSnapshot}
  # PATCH /api/ai-assistant/task-feedback — admin-only; requires JSON body {id,promoted}

  # ─── Admin ───
  "GET /api/admin/feedback Admin feedback"
  "GET /api/admin/feedback/tools Feedback tools"
  "GET /api/admin/company-context Company context"
  "GET /api/admin/company-knowledge Company knowledge"

  # ─── Dev ───
  "GET /api/dev/violations Design violations"
  "GET /api/dev/schema DB schema"

  # ─── Tasks ───
  "GET /api/tasks Tasks list"

  # ─── Documents (Global) ───
  "GET /api/documents/status Document status"

  # ─── Misc ───
  "GET /api/initiative-cards Initiative cards"
  "GET /api/clients Clients"
  "GET /api/knowledge Knowledge"
  "GET /api/monitoring/dashboard Monitoring dashboard"
  "GET /api/docs-search Docs search"
)

# ─── Run one pass ──────────────────────────────────────────────────────────
run_smoke_test() {
  local pass=0
  local fail=0
  local warn=0
  local errors=()
  local timestamp
  timestamp=$(date "+%Y-%m-%d %H:%M:%S")

  echo ""
  echo -e "${CYAN}=== API Smoke Test — ${timestamp} ===${NC}"
  echo -e "${CYAN}    Base: ${BASE_URL}  Project: ${PROJECT_ID}${NC}"
  echo -e "${CYAN}    Endpoints: ${#ENDPOINTS[@]}${NC}"
  echo ""

  for entry in "${ENDPOINTS[@]}"; do
    local method url desc
    method=$(echo "$entry" | awk '{print $1}')
    url=$(echo "$entry" | awk '{print $2}')
    desc=$(echo "$entry" | cut -d' ' -f3-)

    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" \
      --max-time 10 \
      -X "$method" \
      "${BASE_URL}${url}" 2>/dev/null || echo "000")

    # Retry once on timeout — Next.js dev server compiles route handlers on first hit,
    # which can exceed 10s for heavy routes. A real hang will still fail at 30s.
    if [[ "$status" == "000" ]]; then
      status=$(curl -s -o /dev/null -w "%{http_code}" \
        --max-time 30 \
        -X "$method" \
        "${BASE_URL}${url}" 2>/dev/null || echo "000")
    fi

    if [[ "$status" == "500" || "$status" == "000" ]]; then
      echo -e "  ${RED}FAIL${NC}  ${status}  ${url}  (${desc})"
      errors+=("${status} ${method} ${url} — ${desc}")
      ((fail++))
    elif [[ "$status" =~ ^(401|403)$ ]]; then
      if [[ "$QUIET" != "true" ]]; then
        echo -e "  ${YELLOW}AUTH${NC}  ${status}  ${url}  (${desc})"
      fi
      ((warn++))
    elif [[ "$status" == "404" ]]; then
      # 404 is expected for fake IDs — only flag if it's a list endpoint
      if echo "$url" | grep -qE "${FAKE_UUID}|${FAKE_INT}"; then
        if [[ "$QUIET" != "true" ]]; then
          echo -e "  ${GREEN} OK ${NC}  ${status}  ${url}  (${desc})"
        fi
        ((pass++))
      else
        echo -e "  ${YELLOW}404 ${NC}  ${status}  ${url}  (${desc})"
        ((warn++))
      fi
    else
      if [[ "$QUIET" != "true" ]]; then
        echo -e "  ${GREEN} OK ${NC}  ${status}  ${url}  (${desc})"
      fi
      ((pass++))
    fi
  done

  echo ""
  echo -e "${CYAN}─── Results ───${NC}"
  echo -e "  ${GREEN}Pass: ${pass}${NC}  ${RED}Fail: ${fail}${NC}  ${YELLOW}Auth/Warn: ${warn}${NC}  Total: ${#ENDPOINTS[@]}"

  # Write failures to log
  if [[ ${#errors[@]} -gt 0 ]]; then
    echo "" >> "$LOG_FILE"
    echo "=== ${timestamp} — ${fail} FAILURE(S) ===" >> "$LOG_FILE"
    for err in "${errors[@]}"; do
      echo "  $err" >> "$LOG_FILE"
    done
    echo ""
    echo -e "${RED}FAILURES written to ${LOG_FILE}${NC}"
    echo -e "${RED}KEY: 500=SERVER BUG (fix immediately), 000=TIMEOUT/UNREACHABLE${NC}"
    return 1
  else
    echo ""
    echo -e "${GREEN}All endpoints healthy.${NC}"
    return 0
  fi
}

# ─── Check server is up ───────────────────────────────────────────────────
check_server() {
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "${BASE_URL}/api/health" 2>/dev/null || echo "000")
  if [[ "$status" == "000" ]]; then
    return 1
  fi
  return 0
}

# ─── Main ──────────────────────────────────────────────────────────────────
if [[ "$WATCH_MODE" == "true" ]]; then
  echo -e "${CYAN}API Smoke Test — Watch Mode (every 5 minutes)${NC}"
  echo -e "${CYAN}Press Ctrl+C to stop${NC}"
  echo ""
  while true; do
    if check_server; then
      run_smoke_test || true
    else
      echo -e "${YELLOW}$(date '+%H:%M:%S') — Dev server not running, skipping...${NC}"
    fi
    sleep 300
  done
else
  if ! check_server; then
    echo -e "${RED}Dev server not running at ${BASE_URL}${NC}"
    echo -e "${YELLOW}Start it with: npm run dev${NC}"
    exit 1
  fi
  run_smoke_test
fi
