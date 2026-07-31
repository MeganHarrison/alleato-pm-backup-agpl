#!/bin/bash
# Comprehensive API Route Verifier
# Catches the 8 most common issues that break features after creation.
# Run: npm run verify:api (from project root)

FRONTEND_DIR="frontend/src/app/api"
ERRORS=0
WARNINGS=0

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'
BOLD='\033[1m'

section() {
  echo ""
  echo -e "${BOLD}-- $1 --${NC}"
}

# ═══════════════════════════════════════════════════════════
# CHECK 1: Route parameter naming conflicts
# ═══════════════════════════════════════════════════════════
section "1. Route Parameter Naming Conflicts"

TMPFILE=$(mktemp)
CONFLICT_FILE=$(mktemp)
find frontend/src/app -type d -name "\[*\]" 2>/dev/null | sort > "$TMPFILE"

CONFLICT_COUNT=0
while read -r route; do
  parent=$(dirname "$route")
  param=$(basename "$route")
  # Check if another param exists for same parent
  existing=$(grep "^${parent}/\[" "$TMPFILE" 2>/dev/null | head -1 || true)
  if [ -n "$existing" ]; then
    existing_param=$(basename "$existing")
    if [ "$existing_param" != "$param" ]; then
      echo "$parent: $existing_param vs $param" >> "$CONFLICT_FILE"
    fi
  fi
done < "$TMPFILE"

if [ -s "$CONFLICT_FILE" ]; then
  sort -u "$CONFLICT_FILE" | while read -r line; do
    echo -e "${RED}ERROR${NC}: Parameter conflict - $line"
  done
  CONFLICT_COUNT=$(sort -u "$CONFLICT_FILE" | wc -l | tr -d ' ')
  ERRORS=$((ERRORS + CONFLICT_COUNT))
else
  echo -e "${GREEN}OK${NC}: No parameter naming conflicts"
fi
rm -f "$TMPFILE" "$CONFLICT_FILE"

# ═══════════════════════════════════════════════════════════
# CHECK 2: Generic [id] usage (should be [entityId])
# ═══════════════════════════════════════════════════════════
section "2. Generic [id] Parameter Usage"

GENERIC_IDS=$(find frontend/src/app -type d -name "\[id\]" 2>/dev/null | grep -v '_archived' || true)
if [ -n "$GENERIC_IDS" ]; then
  echo "$GENERIC_IDS" | while read -r route; do
    echo -e "${YELLOW}WARN${NC}: Generic [id] used: $route (should use specific name like [entityId])"
  done
  GEN_COUNT=$(echo "$GENERIC_IDS" | wc -l | tr -d ' ')
  WARNINGS=$((WARNINGS + GEN_COUNT))
else
  echo -e "${GREEN}OK${NC}: No generic [id] parameters found"
fi

# ═══════════════════════════════════════════════════════════
# Collect route files once
# ═══════════════════════════════════════════════════════════
ROUTE_FILES_LIST=$(mktemp)
find "$FRONTEND_DIR" \( -name "route.ts" -o -name "route.tsx" \) 2>/dev/null > "$ROUTE_FILES_LIST"
TOTAL_ROUTES=$(wc -l < "$ROUTE_FILES_LIST" | tr -d ' ')

# ═══════════════════════════════════════════════════════════
# CHECK 3: Async params (Next.js 15 requirement)
# ═══════════════════════════════════════════════════════════
section "3. Async Params (Next.js 15)"

ASYNC_ISSUES=0
while read -r file; do
  if grep -q "params" "$file" 2>/dev/null; then
    # withApiGuardrails routes receive params as an already-resolved object (not a Promise)
    # — no await needed. Skip those files entirely.
    if grep -q 'withApiGuardrails' "$file" 2>/dev/null; then
      continue
    fi
    # Check for destructuring params without await in native Next.js route handler functions
    # Exclude: lines with "await params", helper functions with typed params (e.g., params: { path: string[] })
    RAW_DESTRUCTURE=$(grep -n 'const {.*} = params;' "$file" 2>/dev/null | grep -v 'await params' || true)
    if [ -n "$RAW_DESTRUCTURE" ]; then
      # Check if the file has typed params in function signatures (helper functions, not route params)
      # If the only "params" destructures are in helper functions, skip
      HAS_TYPED_PARAMS=$(grep -c 'params: {' "$file" 2>/dev/null || echo "0")
      HAS_ROUTE_AWAIT=$(grep -c 'await params' "$file" 2>/dev/null || echo "0")
      if [ "$HAS_TYPED_PARAMS" -gt 0 ] || [ "$HAS_ROUTE_AWAIT" -gt 0 ]; then
        : # Skip - file has typed helper params or route already uses await
      else
        echo -e "${RED}ERROR${NC}: Params destructured without await in $file"
        ERRORS=$((ERRORS + 1))
        ASYNC_ISSUES=1
      fi
    fi
  fi
done < "$ROUTE_FILES_LIST"

if [ $ASYNC_ISSUES -eq 0 ]; then
  echo -e "${GREEN}OK${NC}: All route params properly use async/await"
fi

# ═══════════════════════════════════════════════════════════
# CHECK 4: Auth checks on mutation endpoints
# ═══════════════════════════════════════════════════════════
section "4. Auth Checks on Mutations"

# Evidence that a route ENFORCES auth — i.e. it rejects an anonymous caller.
#
# Deliberately NOT on this list: a bare `getApiRouteUser()` call. It returns null
# for anonymous callers, so calling it proves nothing; the handler must also
# reject the null. Two live vulnerabilities (reconciliation PATCH, estimates
# gc-templates POST) both called it and used `user?.id ?? null` without ever
# rejecting — counting the call as "auth" would have hidden them.
AUTH_EVIDENCE='getUser|Unauthorized|verifyProjectAccess|status: 401|requireCurrentUserAppCapability|requireAppAdmin|requireDeveloper|requireOwner|requireUser'

AUTH_ISSUES=0
while read -r file; do
  # Skip routes that intentionally have no user auth (use platform-level/HMAC auth instead)
  if echo "$file" | grep -qE 'auth/signup/route\.ts|auth/forgot-password/route\.ts|bot/\[platform\]/route\.ts|bot/teams/route\.ts'; then
    continue
  fi
  for method in POST PUT PATCH DELETE; do
    # KNOWN GAP: only native `export async function` handlers are scanned. Routes
    # written as `export const POST = withApiGuardrails(...)` are invisible here —
    # ~469 mutation handlers repo-wide. Widening the match requires first teaching
    # AUTH_EVIDENCE the project-membership guards those routes use. Tracked in the
    # backlog; do not widen this regex without doing that vocabulary work first.
    if grep -q "export async function $method" "$file" 2>/dev/null; then
      if ! grep -qE "$AUTH_EVIDENCE" "$file" 2>/dev/null; then
        echo -e "${RED}ERROR${NC}: Mutation $method in $file has no auth check"
        ERRORS=$((ERRORS + 1))
        AUTH_ISSUES=1
      fi
    fi
  done
done < "$ROUTE_FILES_LIST"

if [ $AUTH_ISSUES -eq 0 ]; then
  echo -e "${GREEN}OK${NC}: All mutation endpoints have auth checks"
fi

# ═══════════════════════════════════════════════════════════
# CHECK 5: projectId parseInt parsing
# ═══════════════════════════════════════════════════════════
section "5. projectId Parsing"

PARSE_ISSUES=0
while read -r file; do
  if grep -q "projectId" "$file" 2>/dev/null; then
    # Check if projectId is used directly in .eq() without parseInt
    # Exclude files where projectId is a function param typed as number (not from URL params)
    if grep -q '\.eq("project_id", projectId)' "$file" 2>/dev/null; then
      # Check if ALL occurrences are inside functions with projectId: number param
      # If file has parseInt or numericProjectId, only flag if raw projectId is still used in route handlers
      # Detect any numeric conversion of projectId (parseInt, Number, or typed-as-number param)
      HAS_PARSE=$(grep -cE 'parseInt\([^)]*[Pp]roject[Ii]d|Number\.parseInt\([^)]*[Pp]roject|Number\([^)]*[Pp]roject[Ii]d' "$file" 2>/dev/null || true)
      HAS_NUMERIC=$(grep -c 'numericProjectId\|projectIdNum\|projectIdParam\|projectIdStr\|projectIdRaw' "$file" 2>/dev/null || true)
      TYPED_PARAM=$(grep -cE 'projectId\s*:\s*number' "$file" 2>/dev/null || true)
      # Zod coercion (`z.coerce.number()`) and helpers declared `Promise<number>`
      # both hand `.eq()` a real number — the generated Supabase types would fail
      # typecheck otherwise, since projects.id is INTEGER.
      HAS_COERCE=$(grep -cE 'z\.coerce\.number\(\)|Promise<number>' "$file" 2>/dev/null || true)
      # If file properly converts projectId to a number before use, skip
      if [ "${HAS_PARSE:-0}" -gt 0 ] || [ "${HAS_NUMERIC:-0}" -gt 0 ] || [ "${TYPED_PARAM:-0}" -gt 0 ] || [ "${HAS_COERCE:-0}" -gt 0 ]; then
        : # Skip - file handles the conversion
      else
        echo -e "${RED}ERROR${NC}: projectId used as string in .eq() (needs parseInt): $file"
        ERRORS=$((ERRORS + 1))
        PARSE_ISSUES=1
      fi
    fi
  fi
done < "$ROUTE_FILES_LIST"

if [ $PARSE_ISSUES -eq 0 ]; then
  echo -e "${GREEN}OK${NC}: All projectId usages properly parsed"
fi

# ═══════════════════════════════════════════════════════════
# CHECK 6: Console.log in route files
# ═══════════════════════════════════════════════════════════
section "6. Console.log Statements"

CONSOLE_ISSUES=0
while read -r file; do
  LINES=$(grep -n "console\.log" "$file" 2>/dev/null || true)
  if [ -n "$LINES" ]; then
    echo "$LINES" | while read -r line; do
      echo -e "${YELLOW}WARN${NC}: console.log in $file: $line"
    done
    LINE_COUNT=$(echo "$LINES" | wc -l | tr -d ' ')
    WARNINGS=$((WARNINGS + LINE_COUNT))
    CONSOLE_ISSUES=1
  fi
done < "$ROUTE_FILES_LIST"

if [ $CONSOLE_ISSUES -eq 0 ]; then
  echo -e "${GREEN}OK${NC}: No console.log statements in route files"
fi

# ═══════════════════════════════════════════════════════════
# CHECK 7: Error handling consistency
# ═══════════════════════════════════════════════════════════
section "7. Error Handling"

ERROR_ISSUES=0
while read -r file; do
  if grep -q 'export async function' "$file" 2>/dev/null; then
    # withApiGuardrails wraps all handler errors automatically — no try/catch needed inside
    if ! grep -q 'withApiGuardrails' "$file" 2>/dev/null; then
      if ! grep -q "try {" "$file" 2>/dev/null && ! grep -q "try{" "$file" 2>/dev/null; then
        echo -e "${RED}ERROR${NC}: No try/catch in $file"
        ERRORS=$((ERRORS + 1))
        ERROR_ISSUES=1
      fi
    fi
    if ! grep -q "status: 500" "$file" 2>/dev/null && ! grep -q "Internal server error" "$file" 2>/dev/null && ! grep -q "apiErrorResponse" "$file" 2>/dev/null && ! grep -q "withApiGuardrails" "$file" 2>/dev/null; then
      echo -e "${YELLOW}WARN${NC}: No 500 error handler in $file"
      WARNINGS=$((WARNINGS + 1))
      ERROR_ISSUES=1
    fi
  fi
done < "$ROUTE_FILES_LIST"

if [ $ERROR_ISSUES -eq 0 ]; then
  echo -e "${GREEN}OK${NC}: All routes have proper error handling"
fi

# ═══════════════════════════════════════════════════════════
# CHECK 8: Supabase client import pattern
# ═══════════════════════════════════════════════════════════
section "8. Supabase Client Import"

IMPORT_ISSUES=0
while read -r file; do
  if grep -q "supabase" "$file" 2>/dev/null; then
    if grep -q 'from "@/lib/supabase/client"' "$file" 2>/dev/null; then
      echo -e "${RED}ERROR${NC}: Using browser Supabase client in API route: $file (use @/lib/supabase/server)"
      ERRORS=$((ERRORS + 1))
      IMPORT_ISSUES=1
    fi
  fi
done < "$ROUTE_FILES_LIST"

if [ $IMPORT_ISSUES -eq 0 ]; then
  echo -e "${GREEN}OK${NC}: All routes use server Supabase client"
fi

rm -f "$ROUTE_FILES_LIST"

# ═══════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}=======================================${NC}"
echo -e "${BOLD}API Route Verification Summary${NC}"
echo -e "${BOLD}=======================================${NC}"

echo "Routes scanned: $TOTAL_ROUTES"

if [ $ERRORS -gt 0 ]; then
  echo -e "Errors:   ${RED}$ERRORS${NC}"
fi
if [ $WARNINGS -gt 0 ]; then
  echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
fi

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}All checks passed!${NC}"
  exit 0
elif [ $ERRORS -eq 0 ]; then
  echo -e "${YELLOW}Passed with warnings${NC}"
  exit 0
else
  echo -e "${RED}FAILED -- fix errors before proceeding${NC}"
  exit 1
fi
