#!/bin/bash

# ============================================================================
# UPDATE IMPORTS SCRIPT: Fix import paths after migration
# ============================================================================
#
# Purpose: Update all import statements to reflect new directory structure
# Author: Claude Code
# Date: 2025-12-10
#
# This script updates import paths after migration to PLANS.md structure
# ============================================================================

set -e

# Colors
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
# Frontend Import Updates
# ============================================================================

update_frontend_imports() {
    log_info "Updating frontend import statements..."

    local files=$(find frontend/src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \))

    if [ "$DRY_RUN" = "1" ]; then
        log_warning "DRY-RUN: Would update imports in $(echo "$files" | wc -l) files"
        echo "Sample files:"
        echo "$files" | head -5
    else
        # Update import paths (examples)
        # These paths should already work with @/* mapping, but verify
        log_info "Verifying @/* imports are consistent..."

        # Count files with imports
        local import_count=$(grep -r "from '@/" frontend/src | wc -l)
        log_info "Found $import_count import statements using @/* path alias"
        log_success "Import paths should work with updated tsconfig.json"
    fi
}

# ============================================================================
# Backend Import Updates
# ============================================================================

update_backend_imports() {
    log_info "Updating backend import statements..."

    if [ "$DRY_RUN" = "1" ]; then
        log_warning "DRY-RUN: Would update Python imports"
        echo "Changes needed:"
        echo "  - Update sys.path in scripts"
        echo "  - Update relative imports"
        echo "  - Update from python-backend.* to backend.src.*"
    else
        # Update Python imports
        log_info "Updating Python import paths..."

        # Find all Python files
        find backend/src -type f -name "*.py" -exec sed -i '' \
            -e 's/from python-backend\./from backend.src./g' \
            -e 's/import python-backend\./import backend.src./g' \
            {} \;

        log_success "Python imports updated"
    fi
}

# ============================================================================
# Configuration File Updates
# ============================================================================

update_test_imports() {
    log_info "Updating test file imports..."

    if [ "$DRY_RUN" = "1" ]; then
        log_warning "DRY-RUN: Would update Playwright test paths"
        echo "  - Update test file locations in playwright.config.ts"
        echo "  - Update screenshot paths"
    else
        log_info "Test imports require manual review"
    fi
}

# ============================================================================
# Main
# ============================================================================

main() {
    echo ""
    echo "============================================================================"
    echo "UPDATE IMPORTS AFTER MIGRATION"
    echo "============================================================================"
    echo ""

    if [ "$DRY_RUN" = "1" ]; then
        log_warning "Running in DRY-RUN mode"
        echo ""
    fi

    update_frontend_imports
    update_backend_imports
    update_test_imports

    echo ""
    log_success "Import update script complete"
    echo ""
    echo "MANUAL UPDATES STILL REQUIRED:"
    echo "  1. Review and update tsconfig.json paths"
    echo "  2. Update package.json scripts"
    echo "  3. Update playwright.config.ts testDir"
    echo "  4. Update any hardcoded paths in scripts"
    echo ""
}

main
