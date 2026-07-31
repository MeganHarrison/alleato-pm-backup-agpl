#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// List of files that need updating
const filesToUpdate = [
  'tests/e2e/commitments-recycle-bin.spec.ts',
  'tests/e2e/prime-contracts/api-line-items.spec.ts',
  'tests/e2e/submittals.smoke.spec.ts',
  'tests/e2e/budget-phase-1a-1b.spec.ts',
  'tests/directory/directory-workflow.spec.ts',
  'tests/e2e/prime-contracts/api-change-orders.spec.ts',
  'tests/e2e/prime-contracts-new.spec.ts',
  'tests/e2e/budget-views-api.spec.ts',
  'tests/e2e/budget-views-ui.spec.ts',
  'tests/e2e/prime-contracts/api-crud.spec.ts',
  'tests/e2e/change-events-comprehensive.spec.ts',
  'tests/e2e/change-events-debug.spec.ts',
  'tests/e2e/change-events-e2e.spec.ts',
  'tests/e2e/change-events-quick-verify.spec.ts',
  'tests/e2e/change-events-ui.spec.ts',
  'tests/e2e/commitment-api.spec.ts',
  'tests/e2e/commitment-create.spec.ts',
  'tests/e2e/commitment-debug.spec.ts',
  'tests/e2e/commitment-forms.spec.ts',
  'tests/e2e/commitment-full-submit.spec.ts',
  'tests/e2e/commitment-submit.spec.ts',
  'tests/e2e/commitment-validation.spec.ts',
  'tests/e2e/commitments-detail-tabs.spec.ts',
  'tests/e2e/comprehensive-form-testing.spec.ts',
  'tests/e2e/complete-project-creation-flow.spec.ts',
  'tests/e2e/contract-form-visual.spec.ts',
  'tests/e2e/contracts-comprehensive.spec.ts',
  'tests/e2e/purchase-order-form-comprehensive.spec.ts',
  'tests/e2e/subcontract-form-comprehensive.spec.ts',
  'tests/e2e/schedule-page.spec.ts',
  'tests/e2e/scrollbar-check-no-auth.spec.ts',
  'tests/e2e/verify-all-page-titles.spec.ts',
  'tests/e2e/directory-companies.spec.ts',
  'tests/e2e/directory-distribution-groups.spec.ts',
  'tests/e2e/directory-users.spec.ts',
  'tests/e2e/docs-chat-sidebar.spec.ts',
  'tests/e2e/drawings.spec.ts',
  'tests/e2e/dropdown-hover-simple.spec.ts',
  'tests/e2e/emails-page.spec.ts',
  'tests/e2e/financial-markup.spec.ts',
  'tests/e2e/form-layout-header.spec.ts',
  'tests/e2e/daily-logs.spec.ts',
  'tests/e2e/daily-logs-crud.spec.ts',
  'tests/e2e/daily-logs-subtabs-crud.spec.ts',
  'tests/e2e/daily-logs-tabs.spec.ts',
  'tests/e2e/dashboard-layout-screenshots.spec.ts',
  'tests/e2e/direct-costs.spec.ts',
  'tests/e2e/budget-creation-e2e.spec.ts',
  'tests/e2e/budget-details.spec.ts',
  'tests/e2e/budget-grouping.spec.ts',
  'tests/e2e/budget-import.spec.ts',
  'tests/e2e/budget-quick-wins.spec.ts',
  'tests/e2e/budget-setup.spec.ts',
  'tests/e2e/budget-setup-dropdown-debug.spec.ts',
  'tests/e2e/budget-setup-dropdown-verify-fix.spec.ts',
  'tests/e2e/budget-verification.spec.ts',
  'tests/e2e/auth-redirect-logout.spec.ts',
  'tests/e2e/budget-comprehensive.spec.ts',
  'tests/helpers/api-auth.ts',
  'tests/commitments-soft-delete.spec.ts',
  'tests/chat.spec.ts',
  'tests/auth.spec.ts',
  'tests/directory/directory-api.spec.ts',
  'tests/directory/directory-functionality.spec.ts'
];

let updatedCount = 0;

filesToUpdate.forEach(relativePath => {
  const file = path.join(__dirname, '..', relativePath);

  if (!fs.existsSync(file)) {
    console.log(`Skipping non-existent file: ${relativePath}`);
    return;
  }

  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Update various patterns of hardcoded URLs

  // Pattern 1: const BASE_URL = 'http://localhost:3000'
  content = content.replace(
    /const BASE_URL = ['"]http:\/\/(?:localhost|127\.0\.0\.1):\d+['"]/g,
    "const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'"
  );

  // Pattern 2: const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  content = content.replace(
    /const appUrl = process\.env\.NEXT_PUBLIC_APP_URL \|\| ['"]http:\/\/(?:localhost|127\.0\.0\.1):\d+['"]/g,
    "const appUrl = process.env.BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'"
  );

  // Pattern 3: const BASE_URL = process.env.BASE_URL || 'http://localhost:3002'
  content = content.replace(
    /const BASE_URL = process\.env\.BASE_URL \|\| ['"]http:\/\/(?:localhost|127\.0\.0\.1):\d+['"]/g,
    "const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'"
  );

  // Pattern 4: Direct fetch with localhost URLs in test files
  content = content.replace(
    /`http:\/\/localhost:3000\/api\/projects\/\$\{([^}]+)\}\/([^`]+)`/g,
    "`\${process.env.BASE_URL || 'http://localhost:3000'}/api/projects/\${$1}/$2`"
  );

  // Pattern 5: page.goto with template literals containing localhost
  content = content.replace(
    /page\.goto\(`http:\/\/localhost:\d+\/\$\{([^}]+)\}\/([^`]+)`\)/g,
    "page.goto(`/\${$1}/$2`)"
  );

  // Pattern 6: BASE_URL variable concatenated in strings
  content = content.replace(
    /`\$\{BASE_URL\}\/(\$\{[^}]+\})?([^`]*)`/g,
    (match, param, rest) => {
      if (param) {
        return `\`/\${${param.slice(2, -1)}}${rest}\``;
      }
      return `\`/${rest}\``;
    }
  );

  // Pattern 7: Direct API endpoint URLs
  content = content.replace(
    /const BASE_URL = `http:\/\/localhost:3000\/api\/projects\/\$\{TEST_PROJECT_ID\}\/([^`]+)`/g,
    "const BASE_URL = `\${process.env.BASE_URL || 'http://localhost:3000'}/api/projects/\${TEST_PROJECT_ID}/$1`"
  );

  // Pattern 8: Direct page URLs with project ID
  content = content.replace(
    /const BASE_URL = `http:\/\/localhost:3000\/\$\{TEST_PROJECT_ID\}\/([^`]+)`/g,
    "const BASE_URL = `\${process.env.BASE_URL || 'http://localhost:3000'}/\${TEST_PROJECT_ID}/$1`"
  );

  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    updatedCount++;
    console.log(`Updated: ${relativePath}`);
  }
});

console.log(`\nUpdated ${updatedCount} additional test files.`);
console.log('All tests now use BASE_URL from .env.local');