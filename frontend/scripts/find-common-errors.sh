#!/bin/bash

echo "🔍 Searching for common errors in the codebase..."
echo "================================================"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Counter for errors
ERRORS_FOUND=0

echo -e "\n${YELLOW}1. Checking for missing React Query providers...${NC}"
grep -r "useQuery\|useMutation\|useInfiniteQuery" src/app --include="*.tsx" --include="*.ts" | while read -r line; do
  file=$(echo "$line" | cut -d':' -f1)
  # Check if the file is a client component
  if grep -q "'use client'" "$file" || ! grep -q "async function" "$file"; then
    echo -e "${RED}Found React Query usage in: $file${NC}"
    ((ERRORS_FOUND++))
  fi
done

echo -e "\n${YELLOW}2. Checking for missing 'use client' directives...${NC}"
grep -r "useState\|useEffect\|useQuery\|onClick" src/app --include="*.tsx" | while read -r line; do
  file=$(echo "$line" | cut -d':' -f1)
  if ! grep -q "'use client'" "$file" && ! grep -q '"use client"' "$file"; then
    echo -e "${RED}Missing 'use client' in: $file${NC}"
    ((ERRORS_FOUND++))
  fi
done

echo -e "\n${YELLOW}3. Checking for async component issues...${NC}"
grep -r "export default async function" src/app --include="*.tsx" | while read -r line; do
  file=$(echo "$line" | cut -d':' -f1)
  if grep -q "useState\|useEffect\|useQuery" "$file"; then
    echo -e "${RED}Async component using hooks in: $file${NC}"
    ((ERRORS_FOUND++))
  fi
done

echo -e "\n${YELLOW}4. Checking for missing imports...${NC}"
# Common missing imports
PATTERNS=("createClient" "format" "useRouter" "notFound" "redirect")
for pattern in "${PATTERNS[@]}"; do
  grep -r "\b$pattern\b" src/app --include="*.tsx" --include="*.ts" | while read -r line; do
    file=$(echo "$line" | cut -d':' -f1)
    if ! grep -q "import.*$pattern" "$file"; then
      echo -e "${RED}Possible missing import for '$pattern' in: $file${NC}"
      ((ERRORS_FOUND++))
    fi
  done
done

echo -e "\n${YELLOW}5. Checking for TypeScript errors...${NC}"
cd frontend && npm run typecheck 2>&1 | grep -E "error TS" | head -10

if [ $ERRORS_FOUND -eq 0 ]; then
  echo -e "\n${GREEN}✅ No common errors found!${NC}"
else
  echo -e "\n${RED}❌ Found $ERRORS_FOUND potential errors${NC}"
fi