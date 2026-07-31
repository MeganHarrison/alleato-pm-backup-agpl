#!/bin/bash

# Create Codex Task - GitHub Issue Creator
# Creates GitHub issues that auto-trigger Codex execution

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for gh CLI
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI (gh) not found${NC}"
    echo "Install with: brew install gh"
    echo "Then authenticate: gh auth login"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${RED}❌ Not authenticated with GitHub${NC}"
    echo "Run: gh auth login"
    exit 1
fi

# Banner
echo ""
echo -e "${BLUE}🤖 Create Codex Task${NC}"
echo ""

# Interactive mode (default) or batch mode
MODE="${1:-interactive}"

if [ "$MODE" = "--batch" ]; then
    # Batch mode from JSON file
    BATCH_FILE="$2"
    if [ ! -f "$BATCH_FILE" ]; then
        echo -e "${RED}❌ Batch file not found: $BATCH_FILE${NC}"
        exit 1
    fi

    echo "Processing batch file: $BATCH_FILE"
    # TODO: Implement batch processing
    exit 0
fi

# Interactive mode
echo "Task type:"
echo "  1. Feature"
echo "  2. Bug"
echo "  3. Refactor"
echo "  4. Tests"
echo "  5. Migration"
echo "  6. Documentation"
echo ""
read -p "Choose (1-6): " TASK_TYPE_NUM

# Map number to type
case $TASK_TYPE_NUM in
    1) TASK_TYPE="feature" ;;
    2) TASK_TYPE="bug" ;;
    3) TASK_TYPE="refactor" ;;
    4) TASK_TYPE="tests" ;;
    5) TASK_TYPE="migration" ;;
    6) TASK_TYPE="documentation" ;;
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

# Get title
echo ""
read -p "Title: " TITLE

if [ -z "$TITLE" ]; then
    echo -e "${RED}❌ Title cannot be empty${NC}"
    exit 1
fi

# Get target path
echo ""
read -p "Target path (e.g., frontend/src/components/): " TARGET_PATH

# Get description (multiline)
echo ""
echo "Description (press Enter twice to finish):"
DESCRIPTION=""
while IFS= read -r line; do
    if [ -z "$line" ]; then
        break
    fi
    DESCRIPTION="${DESCRIPTION}${line}\n"
done

# Build issue body based on task type
if [ "$TASK_TYPE" = "feature" ]; then
    TEMPLATE="feature_request"
    LABELS="codex,feature"
    BODY=$(cat <<EOF
## Objective
$TITLE

## Scope & Starting Points
Target: $TARGET_PATH

${DESCRIPTION}

## Acceptance Criteria
- [ ] Implementation complete
- [ ] Tests passing
- [ ] Quality checks pass (typecheck, lint, build)
- [ ] Documentation updated (if needed)

## Required Commands
\`\`\`bash
npm run quality --prefix frontend
npm run build --prefix frontend
\`\`\`

---
*Created via /codex-task*
*This will auto-trigger Codex execution in GitHub Actions*
EOF
)
elif [ "$TASK_TYPE" = "bug" ]; then
    TEMPLATE="bug_report"
    LABELS="codex,bug"
    BODY=$(cat <<EOF
## Bug Description
$TITLE

## Location
Target: $TARGET_PATH

${DESCRIPTION}

## Expected Behavior
[Describe what should happen]

## Current Behavior
[Describe what actually happens]

## Acceptance Criteria
- [ ] Bug fixed
- [ ] Root cause identified and addressed
- [ ] Tests added to prevent regression
- [ ] Quality checks pass

## Required Commands
\`\`\`bash
npm run quality --prefix frontend
npm test --prefix frontend
\`\`\`

---
*Created via /codex-task*
EOF
)
elif [ "$TASK_TYPE" = "refactor" ]; then
    TEMPLATE="refactor"
    LABELS="codex,refactor"
    BODY=$(cat <<EOF
## Refactoring Goal
$TITLE

## Target
$TARGET_PATH

${DESCRIPTION}

## Objectives
- [ ] Improve code quality
- [ ] Maintain existing functionality
- [ ] All tests still passing
- [ ] No breaking changes

## Required Commands
\`\`\`bash
npm run quality --prefix frontend
npm test --prefix frontend
\`\`\`

---
*Created via /codex-task*
EOF
)
elif [ "$TASK_TYPE" = "tests" ]; then
    TEMPLATE="tests"
    LABELS="codex,tests"
    BODY=$(cat <<EOF
## Test Coverage Needed
$TITLE

## Target
$TARGET_PATH

${DESCRIPTION}

## Test Requirements
- [ ] E2E tests (Playwright)
- [ ] Edge cases covered
- [ ] Error handling tested
- [ ] Visual regression (if UI)

## Required Commands
\`\`\`bash
cd frontend
npx playwright test tests/e2e/[test-file].spec.ts --reporter=html
\`\`\`

---
*Created via /codex-task*
EOF
)
elif [ "$TASK_TYPE" = "migration" ]; then
    TEMPLATE="migration"
    LABELS="codex,migration,database"
    BODY=$(cat <<EOF
## Migration Task
$TITLE

## Database Changes
${DESCRIPTION}

## Requirements
- [ ] Migration file created in supabase/migrations/
- [ ] RLS policies defined
- [ ] Types regenerated (database.types.ts)
- [ ] Migration tested locally

## Required Commands
\`\`\`bash
npx supabase gen types typescript --project-id "lgveqfnpkxvzbnnwuled" --schema public > frontend/src/types/database.types.ts
\`\`\`

---
*Created via /codex-task*
EOF
)
else
    # Documentation
    TEMPLATE="documentation"
    LABELS="codex,documentation"
    BODY=$(cat <<EOF
## Documentation Task
$TITLE

## Target
$TARGET_PATH

${DESCRIPTION}

## Requirements
- [ ] Documentation created/updated
- [ ] Examples included
- [ ] Follows documentation standards
- [ ] Validated with \`node scripts/docs/validate-doc-structure.cjs\`

---
*Created via /codex-task*
EOF
)
fi

# Create the issue
echo ""
echo -e "${BLUE}Creating issue...${NC}"

ISSUE_URL=$(gh issue create \
    --title "$TITLE" \
    --body "$BODY" \
    --label "$LABELS" \
    2>&1)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Issue created${NC}"
    echo ""
    echo "Issue URL: $ISSUE_URL"

    # Extract issue number from URL
    ISSUE_NUM=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')

    echo ""
    echo -e "${YELLOW}📋 Next Steps:${NC}"
    echo "1. Watch issue $ISSUE_NUM for Codex comments"
    echo "2. Codex will create branch: codex/issue-${ISSUE_NUM}-${TASK_TYPE}"
    echo "3. PR will be created when complete"
    echo "4. Review and merge the PR"
    echo ""
    echo -e "${BLUE}Monitor progress:${NC}"
    echo "  Issue: $ISSUE_URL"
    echo "  Actions: https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/actions"
    echo ""
else
    echo -e "${RED}❌ Failed to create issue${NC}"
    echo "$ISSUE_URL"
    exit 1
fi
