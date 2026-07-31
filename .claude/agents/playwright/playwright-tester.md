# Playwright Testing - Specialized Prompt Template

**🚨 IMPORTANT:** This is NOT a separate sub-agent. This is a **specialized prompt configuration** for the `test-automator` sub-agent.

**Usage:**

```typescript
Task({
  subagent_type: "test-automator",
  prompt: "Follow .agents/agents/playwright-tester.md. [Your specific test request]"
})
```
---

**Agent Type:** `test-automator` (built-in Claude Code sub-agent)
**Specialization:** E2E testing with Playwright for Alleato-Procore
**MCP Integration:** context-7 (Playwright official documentation)
**Official Docs:** https://playwright.dev/docs/intro

**Purpose:** Provides project-specific Playwright testing patterns, Supabase auth setup, and context-7 MCP integration instructions for the test-automator agent.

---

## 🚀 INITIALIZATION (MANDATORY)

When spawned, this agent MUST execute these steps IN ORDER:

### Step 1: Load Playwright Official Documentation

```typescript
// Use context-7 MCP to load Playwright docs
// Available MCP tools:
// - mcp__context7__resolve-library-id
// - mcp__context7__get-library-docs

// Example:
const libraryId = await mcp__context7__resolve_library_id({
  library_name: "playwright"
});

const docs = await mcp__context7__get_library_docs({
  library_id: libraryId,
  sections: [
    "authentication",
    "locators",
    "assertions",
    "best-practices",
    "api-testing"
  ]
});
```
**Fallback:** If context-7 MCP is unavailable, reference <https://playwright.dev/docs/auth> directly.

### Step 2: Read Project-Specific Patterns

```bash
# REQUIRED reading (in order):
1. .agents/docs/playwright/PLAYWRIGHT-PATTERNS.md  # Project patterns
2. frontend/config/playwright/playwright.config.ts  # Config
3. frontend/tests/auth.setup.ts                      # Auth flow
4. .agents/rules/PLAYWRIGHT-GATE.md                 # Gate rules
```
### Step 3: Verify Environment

```bash
# Check test credentials are available:
✓ TEST_USER_1 = test1@mail.com
✓ TEST_PASSWORD_1 = test12026!!!
✓ NEXT_PUBLIC_SUPABASE_URL = [from ENV]
✓ NEXT_PUBLIC_SUPABASE_ANON_KEY = [from ENV]

# Verify Playwright version:
npx playwright --version  # Should be 1.57.0+
```

**If any checks fail:** STOP and report missing requirements.

---

## 🎯 CORE MISSION

Write production-grade Playwright tests following **Alleato-Procore patterns** (NOT generic Playwright):

### Authentication System (Supabase-Based)

**CRITICAL:** Our auth uses Supabase with localStorage injection, NOT traditional session/JWT.

```typescript
// ✅ CORRECT: Use saved auth state (automatically loaded)
// Config already has: storageState: 'tests/.auth/user.json'
// Just write your test - auth is automatic!

test('my test', async ({ page }) => {
  // You're already authenticated!
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
});
```
```typescript
// ❌ WRONG: Don't re-authenticate in tests
test('bad test', async ({ page }) => {
  // DON'T DO THIS - wastes time and defeats setup
  await page.goto('/login');
  await page.fill('[name="email"]', 'test1@mail.com');
  // ...
});
```
**For API Requests:** Extract auth cookies from saved state:

```typescript
import path from 'path';
import fs from 'fs';

const authFile = path.join(__dirname, '../.auth/user.json');
const authData = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
const authCookies = authData.cookies
  .map((cookie: { name: string; value: string }) =>
    `${cookie.name}=${cookie.value}`)
  .join('; ');

// Now use in requests:
await page.request.post(url, {
  headers: {
    Cookie: authCookies,
    'Content-Type': 'application/json'
  },
  data: { ... }
});
```
---

## 🎯 Selector Strategy (PRIORITY ORDER)

Follow this hierarchy (most stable to least):

### 1. Role-Based Selectors (PREFERRED)

```typescript
// Best: Semantic, accessible, stable
await page.locator('[role="tab"]').filter({ hasText: 'Budget Details' });
await page.locator('[role="menu"]').waitFor();
await page.locator('[role="menuitem"]').filter({ hasText: 'Create' }).click();
await page.locator('[role="button"]').filter({ hasText: 'Submit' });
```

**Common Roles:**

- `tab`, `tablist`, `tabpanel`
- `menu`, `menuitem`, `menubar`
- `button`, `link`
- `dialog`, `alertdialog`
- `grid`, `gridcell`

### 2. Test IDs (If Available)

```typescript
await page.locator('[data-testid="budget-submit"]').click();
```
### 3. Text-Based with Filters

```typescript
// Use filter chains for precision
const button = page
  .locator('button')
  .filter({ hasText: 'Submit' })
  .last(); // Gets specific instance when multiple exist

// Regex for flexibility
await page.locator('button').filter({ hasText: /Submit|Save/ }).click();
```
### 4. CSS Classes (Last Resort)

```typescript
// Only when no better option exists
await page.locator('.budget-table-row').first();
```
---

## ⏱️ Wait Strategy (MANDATORY)

**RULE:** Never trust immediate DOM state. Always wait.

### After Navigation (NON-NEGOTIABLE)

```typescript
// ✅ ALWAYS do this:
await page.goto('/dashboard');
await page.waitForLoadState('networkidle'); // MANDATORY

// ❌ NEVER do this:
await page.goto('/dashboard');
// Missing wait = flaky test
```

### For Dynamic Content

```typescript
// Wait for specific elements
await page.waitForSelector('[role="menu"]', { timeout: 5000 });
await page.waitForSelector('table', { timeout: 10000 });

// Wait in assertions (preferred)
await expect(page.locator('[role="menu"]')).toBeVisible({ timeout: 5000 });
```
### For React State Updates

```typescript
// After clicking buttons that trigger state changes
await viewsButton.click();
await page.waitForTimeout(500); // Allow React to re-render

// Then verify
await expect(page.locator('[role="menu"]')).toBeVisible();
```
### For URL Changes

```typescript
await page.waitForURL('**/', { timeout: 15000 });
await page.waitForURL(/\/projects\/\d+\/budget/);
```
---

## 🧪 Test Structure Template

### Standard Test File

```typescript
import { test, expect } from '@playwright/test';
import path from 'path';

const TEST_PROJECT_ID = '67'; // Use existing project
const BASE_URL = `http://localhost:3000/${TEST_PROJECT_ID}/[feature]`;

test.describe('[Feature] E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to feature
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Optional: Clean up test data via API
    const authFile = path.join(__dirname, '../.auth/user.json');
    const authData = JSON.parse(require('fs').readFileSync(authFile, 'utf-8'));
    const authCookies = authData.cookies
      .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
      .join('; ');

    try {
      await page.request.delete(
        `http://localhost:3000/api/test-data/${testId}`,
        { headers: { Cookie: authCookies } }
      );
    } catch (error) {
      console.log('Cleanup warning:', error);
    }
  });

  test('should [specific requirement]', async ({ page }) => {
    // Verify initial state
    await expect(page.locator('[role="tab"]')
      .filter({ hasText: 'Details' }))
      .toBeVisible();

    // Perform action
    await page.locator('button')
      .filter({ hasText: 'Create' })
      .click();

    // Wait for result
    await page.waitForLoadState('networkidle');

    // Verify outcome
    await expect(page.locator('[role="menu"]')).toBeVisible();

    // Screenshot for debugging
    await page.screenshot({
      path: 'frontend/tests/screenshots/[feature]/[step].png',
      fullPage: true,
    });
  });

  test.afterEach(async ({ page }) => {
    // Clean up test data if needed
  });
});
```

### Helper Functions Pattern

```typescript
// Navigation helper
async function navigateToFeature(page: Page, projectId: string = TEST_PROJECT_ID) {
  await page.goto(`http://localhost:3000/${projectId}/feature`);
  await page.waitForLoadState('networkidle');
}

// Screenshot helper
async function takeDebugScreenshot(page: Page, name: string) {
  await page.screenshot({
    path: `frontend/tests/screenshots/feature/${name}.png`,
    fullPage: true,
  });
}

// Auth cookies helper
function getAuthCookies(): string {
  const authFile = path.join(__dirname, '../.auth/user.json');
  const authData = JSON.parse(require('fs').readFileSync(authFile, 'utf-8'));
  return authData.cookies
    .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
    .join('; ');
}
```
---

## 🔌 API Testing Pattern

### Setup Test Data via API

```typescript
test('feature with API setup', async ({ page }) => {
  const authCookies = getAuthCookies();

  // Create test data
  const createResponse = await page.request.post(
    `http://localhost:3000/api/projects/${TEST_PROJECT_ID}/resource`,
    {
      headers: {
        Cookie: authCookies,
        'Content-Type': 'application/json',
      },
      data: {
        name: 'Test Resource',
        value: 100,
      },
    }
  );

  expect(createResponse.status()).toBe(201);
  const { resource } = await createResponse.json();

  // Now test UI with this data
  await page.goto(`/${TEST_PROJECT_ID}/resource/${resource.id}`);
  await page.waitForLoadState('networkidle');

  // Verify UI shows the data
  await expect(page.getByText('Test Resource')).toBeVisible();

  // Cleanup
  await page.request.delete(
    `http://localhost:3000/api/projects/${TEST_PROJECT_ID}/resource/${resource.id}`,
    { headers: { Cookie: authCookies } }
  );
});
```
---

## 📸 Screenshots and Debugging

### Taking Screenshots

```typescript
// Full page screenshot
await page.screenshot({
  path: 'frontend/tests/screenshots/feature/name.png',
  fullPage: true,
});

// Element screenshot
await page.locator('.budget-table').screenshot({
  path: 'frontend/tests/screenshots/table.png',
});

// In test structure
test('my test', async ({ page }) => {
  // ... test code ...

  // Take screenshot before assertion
  await page.screenshot({
    path: `frontend/tests/screenshots/feature/step-${Date.now()}.png`,
    fullPage: true,
  });

  await expect(something).toBeVisible();
});
```
### Console and Error Logging

```typescript
test.beforeEach(async ({ page }) => {
  // Log console messages
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  // Log page errors
  page.on('pageerror', err => console.log('PAGE ERROR:', err));
});
```

---

## 🚫 ANTI-PATTERNS (NEVER DO THIS)

| ❌ BANNED | ✅ CORRECT | Reason |
|----------|-----------|--------|
| `page.locator('button').click()` | `page.locator('button').filter({ hasText: 'Submit' }).click()` | Ambiguous selector |
| `await page.goto('/dashboard');` | `await page.goto('/dashboard'); await page.waitForLoadState('networkidle');` | DOM not stable |
| `await page.waitForTimeout(5000)` | `await page.waitForSelector('[role="menu"]')` | Slow and brittle |
| Re-auth in every test | Use saved `storageState` | Wastes time |
| API without auth | Include `Cookie: authCookies` | Will get 401 |
| No cleanup | `test.afterEach` cleanup | Pollutes DB |
| Generic errors: "test failed" | Show selector, expected vs actual | Can't debug |

---

## 🎓 Common Assertions

### Visibility

```typescript
// Element is visible
await expect(page.locator('button:has-text("Create")')).toBeVisible();

// Element is NOT visible
await expect(page.locator('[role="menu"]')).not.toBeVisible();

// With timeout
await expect(page.locator('[role="menu"]')).toBeVisible({ timeout: 5000 });

// Count
await expect(page.locator('[role="tab"]')).toHaveCount(3);
```
### Text Content

```typescript
// Contains text
await expect(page.locator('h1')).toContainText('Budget');

// Exact text
await expect(page.locator('.total')).toHaveText('$100,000.00');

// Regex
await expect(page.locator('.status')).toHaveText(/Active|Pending/);
```
### API Responses

```typescript
// Status
expect(response.status()).toBe(200);
expect(response.status()).toBe(201); // Created
expect(response.status()).toBe(204); // No Content (delete)

// JSON body
const data = await response.json();
expect(data.views).toHaveLength(1);
expect(data.views[0].name).toBe('Procore Standard');
expect(data.success).toBe(true);
```
---

## 📸 REFERENCE SCREENSHOT COMPARISON (MANDATORY)

**Purpose:** Verify implementation matches Procore reference screenshots captured during feature crawl.

**CRITICAL:** For ANY feature with reference screenshots in `scripts/screenshot-capture/procore-[feature]-crawl/`, you MUST compare implementation against reference.

### When Required

- ANY feature that has reference screenshots (Budget, Change Orders, Commitments, etc.)
- Before claiming "feature complete"
- Before marking test suite as passing

### Reference Screenshot Locations

```bash
# Pattern: scripts/screenshot-capture/procore-[feature]-crawl/pages/[page-name]/
scripts/screenshot-capture/procore-budget-crawl/pages/budget-main/screenshot.png
scripts/screenshot-capture/procore-change-orders-crawl/pages/change-orders-main/screenshot.png
scripts/screenshot-capture/procore-commitments-crawl/pages/commitments-list/screenshot.png
```

### Comparison Pattern

```typescript
import path from 'path';
import fs from 'fs';

test('should match Procore reference layout and functionality', async ({ page }) => {
  // Step 1: Navigate to implemented feature
  await page.goto(`/${TEST_PROJECT_ID}/budget`);
  await page.waitForLoadState('networkidle');

  // Step 2: Take screenshot of implementation
  const implementationPath = 'frontend/tests/screenshots/budget-e2e/implementation-main-view.png';
  await page.screenshot({
    path: implementationPath,
    fullPage: true,
  });

  // Step 3: Document reference screenshot location
  const referencePath = 'scripts/screenshot-capture/procore-budget-crawl/pages/budget-main/screenshot.png';

  // Step 4: Create comparison report file
  const comparisonReport = `
## Visual Comparison Report - Budget Feature

### Reference Screenshot (Procore)
Path: ${referencePath}
Captured: [Date from metadata.json if available]

### Implementation Screenshot (Alleato)
Path: ${implementationPath}
Captured: ${new Date().toISOString()}

### Layout Comparison
- [ ] Header matches (title, breadcrumbs, action buttons)
- [ ] Tab structure matches (Details, Forecast, History, etc.)
- [ ] Table structure matches (columns, rows, styling)
- [ ] Filter/search controls present
- [ ] Action buttons in correct locations
- [ ] Pagination/footer present

### Functional Elements Comparison
- [ ] All tabs clickable and working
- [ ] Dropdown menus present and functional
- [ ] Create/Edit/Delete actions available
- [ ] Export functionality present
- [ ] Financial views selector working

### Design System Differences (EXPECTED)
- Colors: Using Alleato design system (neutral-*, primary-*, etc.)
- Fonts: Using design system typography
- Spacing: May differ slightly (8px grid system)
- Icons: Using Lucide React icons (not Procore icons)

### Missing Elements (BLOCKERS)
[List any features present in reference but missing in implementation]

### Extra Elements (ENHANCEMENTS)
[List any features in implementation not in reference]

### Verdict
✅ PASS - Implementation matches reference with acceptable design system variations
⚠️ PASS WITH NOTES - Minor differences documented
❌ FAIL - Critical missing functionality or layout issues

### Blocker Issues
[If FAIL, list specific blocking issues that must be fixed]
  `;

  // Step 5: Write comparison report
  fs.writeFileSync(
    'frontend/tests/screenshots/budget-e2e/COMPARISON-REPORT.md',
    comparisonReport
  );

  console.log('Comparison report written to:',
    'frontend/tests/screenshots/budget-e2e/COMPARISON-REPORT.md');
});
```
### Comparison Checklist (Use This)

**Layout Structure:**
- [ ] Page header (title, breadcrumbs, action buttons) matches
- [ ] Tab navigation present with same/similar tabs
- [ ] Main content area layout matches
- [ ] Table/grid structure similar (columns, headers)
- [ ] Sidebar or filters in correct position
- [ ] Footer/pagination present

**Functional Elements:**
- [ ] All interactive elements present (buttons, dropdowns, inputs)
- [ ] Actions available (Create, Edit, Delete, Export, etc.)
- [ ] Filters/search functionality present
- [ ] Tab switching works
- [ ] Modals/dialogs present

**Data Display:**
- [ ] Columns display correct data types
- [ ] Financial values formatted correctly
- [ ] Dates formatted correctly
- [ ] Status indicators present

**Expected Differences (DON'T FAIL ON THESE):**
- ✅ Colors (Alleato design system vs Procore colors)
- ✅ Fonts (Design system typography)
- ✅ Exact spacing (8px grid may differ from Procore)
- ✅ Icons (Lucide React vs Procore icons)
- ✅ Minor layout refinements

**Unacceptable Differences (MUST FIX):**
- ❌ Missing core functionality (tabs, buttons, actions)
- ❌ Wrong data displayed
- ❌ Broken layout (elements overlapping, wrong positions)
- ❌ Missing critical UI elements

### Output Format (Required)

Create `frontend/tests/screenshots/[feature]-e2e/COMPARISON-REPORT.md`:

```markdown
# Visual Comparison Report: [Feature Name]

**Date:** 2026-01-10
**Reference:** scripts/screenshot-capture/procore-[feature]-crawl/pages/[page]/screenshot.png
**Implementation:** frontend/tests/screenshots/[feature]-e2e/implementation-[view].png

---

## Comparison Results

### Layout Match: ✅ PASS / ⚠️ PASS WITH NOTES / ❌ FAIL

**Details:**
- Header: ✅ Matches
- Tabs: ✅ All present and functional
- Table: ⚠️ Similar structure, columns reordered for UX
- Filters: ✅ Present and working
- Actions: ❌ Missing "Export to Excel" button

### Functional Match: ✅ PASS / ⚠️ PASS WITH NOTES / ❌ FAIL

**Details:**
- Create functionality: ✅ Working
- Edit functionality: ✅ Working
- Delete functionality: ✅ Working
- Export functionality: ❌ NOT IMPLEMENTED (blocker)

### Design System Differences (Expected)

- Colors: Using neutral-* palette instead of Procore colors ✅
- Typography: Using Inter font from design system ✅
- Spacing: 8px grid system vs Procore spacing ✅
- Icons: Lucide React icons ✅

### Blocking Issues

1. **Export to Excel functionality missing** - Present in Procore reference
   - Impact: HIGH - Core feature requirement
   - Action: Must implement before feature complete

2. **Budget modification modal different layout** -
   - Impact: MEDIUM - Usability concern
   - Action: Review with design team

---

## Final Verdict

**Status:** ❌ FAIL - Blocking issues must be resolved

**Required Actions:**
1. Implement Export to Excel functionality
2. Review budget modification modal layout with team
3. Re-test after fixes

**Next Steps:**
- Fix blocking issues
- Re-run tests
- Create new comparison report
```
### Automation (Future Enhancement)

For automated pixel comparison (optional later):

```typescript
// Playwright's built-in visual regression
await expect(page).toHaveScreenshot('budget-main.png', {
  threshold: 0.2, // 20% tolerance for design system differences
  maxDiffPixels: 2000, // Allow color/font differences
  maxDiffPixelRatio: 0.1,
});
```
---

## 🐛 Debugging Workflow

### 1. Run in Headed Mode

```bash
npx playwright test tests/e2e/[feature].spec.ts --headed --headed-slow
```

### 2. Enable Trace

```bash
npx playwright test --trace on
npx playwright show-trace trace.zip
```
### 3. Debug Mode (Interactive)

```bash
npx playwright test --debug
```
### 4. View HTML Report

```bash
npx playwright show-report frontend/playwright-report
```
### 5. Inspect Specific Element

```typescript
// Add this in your test to pause
await page.pause();

// Or use debug screenshot
await page.screenshot({ path: 'debug.png', fullPage: true });
```

---

## 🚀 DELIVERABLES (REQUIRED)

When test implementation is complete, provide:

1. ✅ **Test file:** `frontend/tests/e2e/[feature].spec.ts`
2. ✅ **Execution command:**

   ```bash
   npx playwright test tests/e2e/[feature].spec.ts --reporter=list
   ```

3. ✅ **Test output:** Full output showing PASS ✓ or detailed failures
4. ✅ **Screenshot paths:** List all screenshots saved
5. ✅ **Coverage report:** List all test cases implemented

**Example Output:**

```text
Running 5 tests using 1 worker

  ✓ [Feature] E2E Tests › should display feature page correctly (2.3s)
  ✓ [Feature] E2E Tests › should handle create action (3.1s)
  ✓ [Feature] E2E Tests › should handle edit action (2.8s)
  ✓ [Feature] E2E Tests › should handle delete action (2.5s)
  ✓ [Feature] E2E Tests › should show validation errors (1.9s)

  5 passed (13.2s)
```

**Screenshots:**

- `frontend/tests/screenshots/feature/01-initial-display.png`
- `frontend/tests/screenshots/feature/02-create-form.png`
- `frontend/tests/screenshots/feature/03-edit-dialog.png`

---

## 🎯 SUCCESS CRITERIA

Before claiming completion, verify ALL:

- [ ] Tests use Supabase auth from `tests/.auth/user.json`
- [ ] All navigations followed by `waitForLoadState('networkidle')`
- [ ] Selectors are specific (role-based or filtered)
- [ ] API requests include auth cookies
- [ ] Test data cleaned up (beforeEach/afterEach)
- [ ] Screenshots captured for debugging
- [ ] **🚨 CRITICAL:** Reference screenshot comparison completed (if reference exists)
- [ ] **🚨 CRITICAL:** COMPARISON-REPORT.md created with verdict
- [ ] **🚨 CRITICAL:** Blocking issues from comparison resolved or documented
- [ ] All tests PASS when run (show output)
- [ ] No flaky tests (run 3 times to verify)
- [ ] Output logged to show evidence
- [ ] Config unchanged (unless explicitly required)

---

## 📚 Reference Links

### Project-Specific

- **Patterns:** `.agents/docs/playwright/PLAYWRIGHT-PATTERNS.md`
- **Gate Rules:** `.agents/rules/PLAYWRIGHT-GATE.md`
- **Config:** `frontend/config/playwright/playwright.config.ts`
- **Auth Setup:** `frontend/tests/auth.setup.ts`
- **Example Tests:** `frontend/tests/e2e/budget-comprehensive.spec.ts`

### Official Playwright Docs (via context-7 MCP)

- **Authentication:** <https://playwright.dev/docs/auth>
- **Locators:** <https://playwright.dev/docs/locators>
- **Assertions:** <https://playwright.dev/docs/test-assertions>
- **API Testing:** <https://playwright.dev/docs/api-testing>
- **Best Practices:** <https://playwright.dev/docs/best-practices>

---

## 🚨 CRITICAL REMINDERS

1. **Read patterns doc FIRST:** `.agents/docs/playwright/PLAYWRIGHT-PATTERNS.md`
2. **Always wait for network idle** after navigation
3. **Use saved auth state** - never re-authenticate
4. **Specific selectors** - role-based or filtered
5. **Clean up test data** - don't pollute database
6. **Show evidence** - run tests, provide output
7. **Fix failures** - don't just report them
8. **Continue until PASS** - or hit genuine blocker
9. **🚨 COMPARE REFERENCE SCREENSHOTS** - If reference exists in `scripts/screenshot-capture/`, create COMPARISON-REPORT.md

**When in doubt:** Read the patterns doc. Follow existing test examples.

---

**Last Updated:** 2026-01-10
**Playwright Version:** 1.57.0
**Auth System:** Supabase with localStorage injection
**Test Location:** `frontend/tests/e2e/`
