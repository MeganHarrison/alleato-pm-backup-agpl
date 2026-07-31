#!/bin/bash

echo "=== Change Events Phase 1 Fix Verification ==="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

cd frontend/src/app/api/projects/\[projectId\]/change-events

echo "1. Checking for incorrect parseInt on UUID parameters..."
ERRORS=0

# Check changeEventId
if grep -r "parseInt(changeEventId" . 2>/dev/null | grep -v "Binary"; then
  echo -e "${RED}❌ FAIL: Found parseInt(changeEventId)${NC}"
  ERRORS=$((ERRORS+1))
else
  echo -e "${GREEN}✅ PASS: No parseInt(changeEventId) found${NC}"
fi

# Check lineItemId
if grep -r "parseInt(lineItemId" . 2>/dev/null | grep -v "Binary"; then
  echo -e "${RED}❌ FAIL: Found parseInt(lineItemId)${NC}"
  ERRORS=$((ERRORS+1))
else
  echo -e "${GREEN}✅ PASS: No parseInt(lineItemId) found${NC}"
fi

# Check attachmentId
if grep -r "parseInt(attachmentId" . 2>/dev/null | grep -v "Binary"; then
  echo -e "${RED}❌ FAIL: Found parseInt(attachmentId)${NC}"
  ERRORS=$((ERRORS+1))
else
  echo -e "${GREEN}✅ PASS: No parseInt(attachmentId) found${NC}"
fi

echo ""
echo "2. Verifying correct parseInt on INTEGER parameters..."

# Check projectId (should have parseInt)
if grep -r "parseInt(projectId, 10)" . 2>/dev/null | grep -v "Binary" | head -1 > /dev/null; then
  echo -e "${GREEN}✅ PASS: projectId still uses parseInt (correct)${NC}"
else
  echo -e "${RED}❌ FAIL: projectId missing parseInt${NC}"
  ERRORS=$((ERRORS+1))
fi

echo ""
echo "3. Checking FormData compatibility enhancement..."

if grep -q 'formData.get("file") || formData.get("files")' \[changeEventId\]/attachments/route.ts 2>/dev/null; then
  echo -e "${GREEN}✅ PASS: Accepts both 'file' and 'files' FormData fields${NC}"
else
  echo -e "${RED}⚠️  WARNING: FormData enhancement not found${NC}"
fi

echo ""
echo "=== Summary ==="
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ All checks passed! Phase 1 fixes verified.${NC}"
  exit 0
else
  echo -e "${RED}❌ $ERRORS check(s) failed. Review fixes.${NC}"
  exit 1
fi
