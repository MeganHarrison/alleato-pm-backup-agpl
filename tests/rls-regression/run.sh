#!/usr/bin/env bash
# =============================================================================
# RLS Regression Test - Orchestrator
# =============================================================================
# Usage: bash tests/rls-regression/run.sh
#
# Workflow:
#   1. Run setup (idempotent — safe to re-run)
#   2. Capture pre-migration baseline snapshots
#   3. Pause — wait for human to apply the migration
#   4. Capture post-migration snapshots
#   5. Diff and report
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source .env for Supabase credentials
if [[ -f "$REPO_ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.env"
  set +a
fi

TSX="$REPO_ROOT/node_modules/.bin/tsx"
if [[ ! -f "$TSX" ]]; then
  TSX="$REPO_ROOT/frontend/node_modules/.bin/tsx"
fi

# Wrapper: run probe from frontend dir so @supabase/supabase-js resolves correctly.
# probe.ts imports from @supabase/supabase-js which lives in frontend/node_modules.
run_probe() {
  local persona="$1"
  local snapshot_dir="${2:-before}"
  (cd "$REPO_ROOT/frontend" && NODE_PATH=./node_modules "$TSX" "$SCRIPT_DIR/probe.ts" "$persona" "$snapshot_dir")
}

PERSONAS=("admin" "member-67" "member-none" "external")

echo "========================================================"
echo "  RLS Regression Test Harness"
echo "  Migration: 20260516010000_wrap_auth_uid_in_rls_policies.sql"
echo "========================================================"
echo ""

# ---------------------------------------------------------------------------
# Step 1: Setup (idempotent)
# ---------------------------------------------------------------------------
echo "--- Step 1: Setup test users ---"
(cd "$REPO_ROOT/frontend" && NODE_PATH=./node_modules "$TSX" "$SCRIPT_DIR/setup.ts")
echo ""

# ---------------------------------------------------------------------------
# Step 2: Pre-migration baseline
# ---------------------------------------------------------------------------
echo "--- Step 2: Capturing pre-migration baseline ---"
echo "    (Running sequentially — parallel probes cause statement timeouts on"
echo "     document_metadata due to expensive non-admin RLS policies)"
mkdir -p "$SCRIPT_DIR/snapshots/before"

for persona in "${PERSONAS[@]}"; do
  echo "  Probing: $persona"
  # Run sequentially to avoid statement timeouts from concurrent RLS scans
  run_probe "$persona" "before" 2>&1 | grep -v "^{" | grep -v "^  \[" || true
done
echo ""
echo "  Baseline snapshots written to tests/rls-regression/snapshots/before/"
echo ""

# ---------------------------------------------------------------------------
# Step 3: Human applies migration
# ---------------------------------------------------------------------------
echo "========================================================"
echo "  STOP — Human action required"
echo ""
echo "  Apply the migration now:"
echo "  supabase/migrations/20260516010000_wrap_auth_uid_in_rls_policies.sql"
echo ""
echo "  Option A (Supabase dashboard SQL editor):"
echo "    1. Open https://app.supabase.com/project/lgveqfnpkxvzbnnwuled/sql"
echo "    2. Paste and run the migration file contents"
echo ""
echo "  Option B (psql):"
echo "    psql \"\$DATABASE_URL\" -f supabase/migrations/20260516010000_wrap_auth_uid_in_rls_policies.sql"
echo ""
echo "  Press ENTER when migration is applied (or Ctrl+C to abort)..."
echo "========================================================"
read -r

# ---------------------------------------------------------------------------
# Step 4: Post-migration snapshots
# ---------------------------------------------------------------------------
echo "--- Step 4: Capturing post-migration snapshots ---"
mkdir -p "$SCRIPT_DIR/snapshots/after"

for persona in "${PERSONAS[@]}"; do
  echo "  Probing: $persona"
  # Run sequentially to avoid statement timeouts from concurrent RLS scans
  run_probe "$persona" "after" 2>&1 | grep -v "^{" | grep -v "^  \[" || true
done
echo ""
echo "  Post-migration snapshots written to tests/rls-regression/snapshots/after/"
echo ""

# ---------------------------------------------------------------------------
# Step 5: Diff
# ---------------------------------------------------------------------------
echo "--- Step 5: Diffing before vs after ---"
(cd "$REPO_ROOT/frontend" && NODE_PATH=./node_modules "$TSX" "$SCRIPT_DIR/diff.ts" "snapshots/before" "snapshots/after")

echo ""
echo "Done. Full report at: tests/rls-regression/snapshots/diff-report.md"
