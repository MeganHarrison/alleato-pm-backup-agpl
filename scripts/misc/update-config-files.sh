#!/bin/bash

# ============================================================================
# UPDATE CONFIG FILES: Modify configuration for new structure
# ============================================================================
#
# Purpose: Update all configuration files after migration
# Author: Claude Code
# Date: 2025-12-10
#
# Updates: tsconfig.json, package.json, next.config.ts, playwright configs
# ============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DRY_RUN=${DRY_RUN:-1}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# ============================================================================
# Config File Patches
# ============================================================================

show_tsconfig_patch() {
    cat <<'EOF'
TSCONFIG.JSON CHANGES:
----------------------

BEFORE:
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ]
}

AFTER:
{
  "compilerOptions": {
    "baseUrl": "./frontend",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "frontend/next-env.d.ts",
    "frontend/**/*.ts",
    "frontend/**/*.tsx",
    "frontend/.next/types/**/*.ts"
  ]
}

EOF
}

show_package_json_patch() {
    cat <<'EOF'
PACKAGE.JSON CHANGES:
--------------------

BEFORE:
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint ."
  }
}

AFTER:
{
  "scripts": {
    "dev": "cd frontend && next dev",
    "build": "cd frontend && next build",
    "start": "cd frontend && next start",
    "lint": "cd frontend && eslint .",
    "dev:backend": "cd backend && ./start.sh",
    "dev:full": "concurrently \"npm run dev\" \"npm run dev:backend\""
  }
}

OR consider moving to frontend/package.json:
{
  "name": "alleato-procore-frontend",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  }
}

EOF
}

show_playwright_patch() {
    cat <<'EOF'
PLAYWRIGHT.CONFIG.TS CHANGES:
-----------------------------

BEFORE:
export default defineConfig({
  testDir: './tests',
  outputDir: './tests/test-results',
})

AFTER:
export default defineConfig({
  testDir: './frontend/tests',
  outputDir: './frontend/tests/test-results',
})

EOF
}

show_next_config_patch() {
    cat <<'EOF'
NEXT.CONFIG.TS CHANGES:
----------------------

Likely no changes needed if running from frontend/ directory. The old Python
RAG rewrite has been removed; AI chat is served by the Next.js
/api/ai-assistant/chat route.

EOF
}

show_tailwind_patch() {
    cat <<'EOF'
TAILWIND.CONFIG.TS CHANGES:
--------------------------

BEFORE:
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ]
}

AFTER:
module.exports = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
  ]
}

EOF
}

show_gitignore_patch() {
    cat <<'EOF'
.GITIGNORE ADDITIONS:
--------------------

# Frontend
frontend/.next/
frontend/out/
frontend/node_modules/

# Backend
backend/__pycache__/
backend/.venv/
backend/venv/
backend/*.pyc
backend/backend.log

# Tests
frontend/tests/test-results/
tests/playwright-report/
backend/tests/.pytest_cache/

EOF
}

show_backend_start_patch() {
    cat <<'EOF'
BACKEND START.SH CHANGES:
------------------------

Update paths in backend/start.sh:

#!/bin/bash
cd "$(dirname "$0")"

# Activate venv
if [ ! -d "venv" ]; then
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# Start server
uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000

EOF
}

# ============================================================================
# Main
# ============================================================================

main() {
    echo ""
    echo "============================================================================"
    echo "CONFIGURATION FILE UPDATE GUIDE"
    echo "============================================================================"
    echo ""

    log_warning "This script shows the required changes - manual updates needed!"
    echo ""

    show_tsconfig_patch
    echo ""
    show_package_json_patch
    echo ""
    show_playwright_patch
    echo ""
    show_next_config_patch
    echo ""
    show_tailwind_patch
    echo ""
    show_gitignore_patch
    echo ""
    show_backend_start_patch
    echo ""

    echo "============================================================================"
    echo "SUMMARY OF FILES TO UPDATE:"
    echo "============================================================================"
    echo ""
    echo "  1. tsconfig.json - Update baseUrl and paths"
    echo "  2. package.json - Update scripts to cd into frontend/"
    echo "  3. playwright.config.ts - Update testDir path"
    echo "  4. tailwind.config.ts - Update content paths"
    echo "  5. .gitignore - Add frontend/ and backend/ specific ignores"
    echo "  6. backend/start.sh - Update paths and imports"
    echo ""
    echo "  Consider creating:"
    echo "  - frontend/package.json for isolated deployment"
    echo "  - backend/requirements.txt verification"
    echo ""
    echo "============================================================================"
}

main
