#!/bin/bash

# Project Verification Script
# Usage: ./scripts/verify-project.sh [project-name]
# Example: ./scripts/verify-project.sh change-events

set -e

PROJECT=${1:-"all"}
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
RESULTS_DIR="playwright-procore-crawl/procore-crawls/${PROJECT}/test-results"

echo "=========================================="
echo "Project Verification: ${PROJECT}"
echo "Timestamp: ${TIMESTAMP}"
echo "=========================================="

# Create results directory if it doesn't exist
mkdir -p "${RESULTS_DIR}" 2>/dev/null || true

# Initialize results file
RESULTS_FILE="${RESULTS_DIR}/verification-${TIMESTAMP//[: ]/-}.json"

echo "{" > "${RESULTS_FILE}"
echo "  \"project\": \"${PROJECT}\"," >> "${RESULTS_FILE}"
echo "  \"timestamp\": \"${TIMESTAMP}\"," >> "${RESULTS_FILE}"
echo "  \"gates\": {" >> "${RESULTS_FILE}"

# Gate 1: TypeScript
echo ""
echo "Gate 1: TypeScript Compilation"
echo "-------------------------------"
if npm run typecheck --prefix frontend 2>&1; then
    echo "    \"typecheck\": \"PASSED\"," >> "${RESULTS_FILE}"
    echo "PASSED"
else
    echo "    \"typecheck\": \"FAILED\"," >> "${RESULTS_FILE}"
    echo "FAILED"
fi

# Gate 2: ESLint
echo ""
echo "Gate 2: ESLint"
echo "-------------------------------"
if npm run lint --prefix frontend 2>&1; then
    echo "    \"lint\": \"PASSED\"," >> "${RESULTS_FILE}"
    echo "PASSED"
else
    echo "    \"lint\": \"FAILED\"," >> "${RESULTS_FILE}"
    echo "FAILED"
fi

# Gate 3: Unit Tests
echo ""
echo "Gate 3: Unit Tests"
echo "-------------------------------"
if npm run test:unit --prefix frontend 2>&1; then
    echo "    \"unit_tests\": \"PASSED\"," >> "${RESULTS_FILE}"
    echo "PASSED"
else
    echo "    \"unit_tests\": \"FAILED\"," >> "${RESULTS_FILE}"
    echo "FAILED"
fi

# Gate 4: Project-specific E2E Tests
if [ "${PROJECT}" != "all" ]; then
    echo ""
    echo "Gate 4: E2E Tests for ${PROJECT}"
    echo "-------------------------------"
    if npx playwright test --grep "${PROJECT}" --project=chromium 2>&1; then
        echo "    \"e2e_tests\": \"PASSED\"," >> "${RESULTS_FILE}"
        echo "PASSED"
    else
        echo "    \"e2e_tests\": \"FAILED\"," >> "${RESULTS_FILE}"
        echo "FAILED"
    fi
else
    echo ""
    echo "Gate 4: Full E2E Suite"
    echo "-------------------------------"
    if npm run test --prefix frontend 2>&1; then
        echo "    \"e2e_tests\": \"PASSED\"," >> "${RESULTS_FILE}"
        echo "PASSED"
    else
        echo "    \"e2e_tests\": \"FAILED\"," >> "${RESULTS_FILE}"
        echo "FAILED"
    fi
fi

# Close JSON
echo "    \"verified_at\": \"${TIMESTAMP}\"" >> "${RESULTS_FILE}"
echo "  }" >> "${RESULTS_FILE}"
echo "}" >> "${RESULTS_FILE}"

echo ""
echo "=========================================="
echo "Verification Complete"
echo "Results saved to: ${RESULTS_FILE}"
echo "=========================================="

# Print summary
echo ""
echo "Summary:"
cat "${RESULTS_FILE}"
