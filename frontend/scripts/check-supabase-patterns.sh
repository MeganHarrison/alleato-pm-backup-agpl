#!/bin/bash
# check-supabase-patterns.sh
# Scans for common Supabase client/type issues that can cause 404s or data access problems

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(dirname "$SCRIPT_DIR")"
SRC_DIR="$FRONTEND_DIR/src"

echo "=================================================="
echo "Supabase Pattern Scanner"
echo "=================================================="
echo ""

# Color codes
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

ISSUES_FOUND=0

# =============================================================================
# Check 1: Server pages using createClient from server (potential RLS issues)
# =============================================================================
echo "🔍 Check 1: Server pages using createClient (potential RLS issues)"
echo "   These may return empty data due to RLS policies."
echo ""

# Find server components (pages without 'use client') that use createClient from server
SERVER_PAGES_WITH_CLIENT=$(grep -rl "from '@/lib/supabase/server'" "$SRC_DIR/app" --include="page.tsx" 2>/dev/null || true)

if [ -n "$SERVER_PAGES_WITH_CLIENT" ]; then
    echo -e "${YELLOW}   Found server pages using createClient from server:${NC}"
    for file in $SERVER_PAGES_WITH_CLIENT; do
        # Check if it's actually a server component (no 'use client')
        if ! head -5 "$file" | grep -q "'use client'"; then
            echo "   - $file"
            ISSUES_FOUND=$((ISSUES_FOUND + 1))
        fi
    done
    echo ""
    echo "   💡 Consider using getProjectInfo() or createServiceClient() for server components"
    echo "      to bypass RLS and ensure consistent data access."
    echo ""
else
    echo -e "${GREEN}   ✓ No issues found${NC}"
    echo ""
fi

# =============================================================================
# Check 2: projectId used in .eq() without conversion to number
# =============================================================================
echo "🔍 Check 2: Potential projectId type mismatches"
echo "   String projectId passed to queries expecting numeric IDs."
echo ""

# Find .eq('id', projectId) or .eq('project_id', projectId) patterns
# These might be passing string to numeric column
POTENTIAL_TYPE_ISSUES=$(grep -rn "\.eq.*projectId)" "$SRC_DIR/app" --include="*.tsx" 2>/dev/null || true)

if [ -n "$POTENTIAL_TYPE_ISSUES" ]; then
    echo -e "${YELLOW}   Found potential projectId type issues:${NC}"
    echo "$POTENTIAL_TYPE_ISSUES" | while read -r line; do
        # Check if the file converts projectId to number
        FILE=$(echo "$line" | cut -d: -f1)
        if ! grep -q "parseInt.*projectId\|parseProjectId\|numericProjectId" "$FILE" 2>/dev/null; then
            echo "   - $line"
            ISSUES_FOUND=$((ISSUES_FOUND + 1))
        fi
    done
    echo ""
    echo "   💡 Use parseInt(projectId, 10) or parseProjectId() from project-fetcher.ts"
    echo ""
else
    echo -e "${GREEN}   ✓ No issues found${NC}"
    echo ""
fi

# =============================================================================
# Check 3: Queries on tables that don't exist or use wrong column names
# =============================================================================
echo "🔍 Check 3: Checking for potentially invalid table references"
echo "   Tables or columns that might not exist in the database."
echo ""

# Known problematic patterns
INVALID_TABLES="schedule_items"
for table in $INVALID_TABLES; do
    MATCHES=$(grep -rn "from('$table')" "$SRC_DIR" --include="*.tsx" --include="*.ts" 2>/dev/null || true)
    if [ -n "$MATCHES" ]; then
        echo -e "${RED}   Found references to potentially non-existent table '$table':${NC}"
        echo "$MATCHES"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
        echo ""
    fi
done

echo -e "${GREEN}   ✓ Check complete${NC}"
echo ""

# =============================================================================
# Check 4: API routes using createClient instead of createServiceClient
# =============================================================================
echo "🔍 Check 4: API routes that might need service client"
echo "   API routes using createClient may have RLS issues."
echo ""

API_ROUTES_WITH_CLIENT=$(grep -rl "from '@/lib/supabase/server'" "$SRC_DIR/app/api" --include="route.ts" 2>/dev/null || true)

if [ -n "$API_ROUTES_WITH_CLIENT" ]; then
    # These are informational, not necessarily issues
    echo "   API routes using server client (review if RLS issues occur):"
    for file in $API_ROUTES_WITH_CLIENT; do
        echo "   - $file"
    done
    echo ""
    echo "   💡 Consider using createServiceClient() for admin operations."
    echo ""
fi

# =============================================================================
# Summary
# =============================================================================
echo "=================================================="
echo "Summary"
echo "=================================================="
if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✓ No critical issues found${NC}"
else
    echo -e "${YELLOW}Found $ISSUES_FOUND potential issue(s) to review${NC}"
fi
echo ""
echo "Recommended actions:"
echo "1. Run TypeScript type check: npm run typecheck"
echo "2. For server components fetching project data, use:"
echo "   import { getProjectInfo } from '@/lib/supabase/project-fetcher'"
echo "3. Always convert URL params to proper types before database queries"
echo ""
