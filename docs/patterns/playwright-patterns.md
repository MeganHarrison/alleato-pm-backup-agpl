---
title: Playwright Testing Patterns
description: Production-tested Playwright patterns for Alleato-Procore. Use these patterns exactly as shown for authentication, selectors, waits, and API testing.
keywords: ["playwright", "testing", "e2e", "authentication", "supabase", "selectors", "waits", "api testing"]
---

# Playwright Testing Patterns for Alleato-Procore

> Partially deprecated on 2026-04-14.
> Canonical replacement: `docs/ops/patterns/playwright-navigation-wait-strategy.md` and `docs/ops/patterns/playwright-authenticated-api-requests.md`.
> Reason: this file contains conflicting wait guidance (`networkidle`) vs active guardrail (`domcontentloaded`).

**CRITICAL:** This document contains the production-tested patterns extracted from our test suite. Use these patterns EXACTLY as shown.

---

## 🔑 Authentication System

### Supabase-Based Auth Setup

**File:** `frontend/tests/auth.setup.ts`

Our auth uses Supabase with localStorage injection:

```typescript
import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const authFile = path.join(__dirname, '.auth/user.json');

setup('authenticate', async ({ page }) => {
  const email = process.env.TEST_USER_1 || 'test1@mail.com';
  const password = process.env.TEST_PASSWORD_1 || 'test12026!!!';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Create Supabase client and sign in
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw new Error(`Authentication failed: ${error.message}`);

  // Navigate and inject auth session into localStorage
  await page.goto('/');
  await page.evaluate((session) => {
    const key = `sb-${session.project_ref}-auth-token`;
    localStorage.setItem(key, JSON.stringify(session));
  }, {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    expires_in: data.session.expires_in,
    token_type: data.session.token_type,
    user: data.session.user,
    project_ref: supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
  });

  // Reload to apply auth state
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Navigate to protected page to trigger cookie sync
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Save authenticated state
  await page.context().storageState({ path: authFile });
});
```yaml
### Test Credentials

**From ENV:**
- `TEST_USER_1` = `test1@mail.com`
- `TEST_PASSWORD_1` = `test12026!!!`
- `NEXT_PUBLIC_SUPABASE_URL` = From `.env` file
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = From `.env` file

### Using Saved Auth State in Tests

```typescript
// Playwright config automatically loads auth state
{
  name: 'chromium',
  use: {
    ...devices['Desktop Chrome'],
    storageState: 'tests/.auth/user.json', // Auto-loaded
  },
  dependencies: ['setup'], // Runs auth.setup.ts first
}
```sql
---

## 🎯 Selector Patterns (PROVEN)

### Role-Based Selectors (PREFERRED)

```typescript
// Tabs
await page.locator('[role="tab"]').filter({ hasText: 'Budget Details' }).click();
await expect(page.locator('[role="tab"][aria-selected="true"]')).toContainText('Budget Details');

// Menus and dropdown items
await page.locator('[role="menu"]').waitFor();
await page.locator('[role="menuitem"]').filter({ hasText: 'Create New View' }).click();

// Buttons
await page.locator('[role="button"]').filter({ hasText: 'Export' }).click();
```sql
### Filter Chains (HANDLE DUPLICATES)

```typescript
// Use .last() to get specific instance when multiple exist
const viewsButton = page
  .locator('button')
  .filter({ hasText: /Procore Standard|Select View/ })
  .last(); // Gets the BudgetViewsManager instance, not header

// Use .first() for headers
const pageTitle = page.locator('h1').filter({ hasText: 'Budget' }).first();

// Combine filters for precision
const submitButton = page
  .locator('button')
  .filter({ hasText: 'Submit' })
  .filter({ has: page.locator('svg') }); // Has an icon
```

### Text Matching Strategies

```typescript
// Exact match
.filter({ hasText: 'Budget Details' })

// Regex for flexibility
.filter({ hasText: /Procore Standard|Select View/ })

// Partial match with contains
await expect(page.getByText('Total Budget:')).toBeVisible();

// Case-insensitive
.filter({ hasText: /budget/i })
```diff
---

## ⏱️ Wait Strategies (MANDATORY)

### Network Idle (STANDARD)

```typescript
// After navigation
await page.goto('/dashboard');
await page.waitForLoadState('networkidle'); // Wait for network to settle

// After reload
await page.reload();
await page.waitForLoadState('networkidle');
```bash
### Selector Waits

```typescript
// Wait for element to appear
await page.waitForSelector('table', { timeout: 10000 });

// Wait for element in assertion
await expect(page.locator('[role="menu"]')).toBeVisible({ timeout: 5000 });

// Wait for element to disappear
await expect(page.locator('[role="menu"]')).not.toBeVisible();
```markdown
### Strategic Timeouts

```typescript
// Wait for state updates (DOM re-render)
await page.waitForTimeout(500); // Allow React state to propagate

// Wait for cookies to sync
await page.waitForTimeout(1000); // Supabase cookie sync
```

### URL Waits

```typescript
// Wait for navigation
await page.waitForURL('**/', { timeout: 15000 });

// Wait for specific URL pattern
await page.waitForURL(/\/projects\/\d+\/budget/);
```typescript
---

## 🍪 Cookie Management

### Reading Auth Cookies from Saved State

```typescript
import path from 'path';
import fs from 'fs';

const authFile = path.join(__dirname, '../.auth/user.json');
const authData = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
const authCookies = authData.cookies
  .map((cookie: { name: string; value: string }) => `${cookie.name}=${cookie.value}`)
  .join('; ');
```sql
### Using Cookies in API Requests

```typescript
// GET request with auth
const response = await page.request.get(
  `http://localhost:3000/api/projects/${projectId}/budget/views`,
  { headers: { Cookie: authCookies } }
);

// POST request with auth
const createResponse = await page.request.post(
  `http://localhost:3000/api/projects/${projectId}/budget/views`,
  {
    headers: {
      Cookie: authCookies,
      'Content-Type': 'application/json',
    },
    data: {
      name: 'Test View',
      columns: [{ column_key: 'costCode', display_order: 1 }],
    },
  }
);

// DELETE request with auth
await page.request.delete(
  `http://localhost:3000/api/projects/${projectId}/budget/views/${viewId}`,
  { headers: { Cookie: authCookies } }
);
```markdown
### Adding Cookies Manually

```typescript
await page.context().addCookies(authData.cookies);
```

---

## 📸 Screenshots and Debugging

### Taking Screenshots

```typescript
// Full page screenshot
await page.screenshot({
  path: 'tests/screenshots/feature/name.png',
  fullPage: true,
});

// Element screenshot
await page.locator('.budget-table').screenshot({
  path: 'tests/screenshots/table.png',
});

// Auto-screenshot on failure (configured in playwright.config.ts)
use: {
  screenshot: 'only-on-failure',
  video: 'on-first-retry',
}
```javascript
### Console Logging

```typescript
// Log test progress
console.log('Auth setup - attempting login with:', { email, supabaseUrl });
console.log('Auth setup - Supabase login successful');

// Log cookies for debugging
const cookies = await page.context().cookies();
console.log('Cookies:', cookies.map(c => c.name));
```javascript
---

## 📸 Reference Screenshot Comparison (MANDATORY)

**Purpose:** Verify implementation matches Procore reference screenshots captured during feature crawl.

**When Required:** For ANY feature with reference screenshots in `scripts/screenshot-capture/procore-[feature]-crawl/`

### Quick Pattern

```typescript
test('should match Procore reference layout', async ({ page }) => {
  // Navigate and take screenshot
  await page.goto(`/${TEST_PROJECT_ID}/budget`);
  await page.waitForLoadState('networkidle');

  await page.screenshot({
    path: 'tests/screenshots/budget-e2e/implementation.png',
    fullPage: true,
  });

  // Compare manually with reference:
  // scripts/screenshot-capture/procore-budget-crawl/pages/budget-main/screenshot.png

  // Document results in COMPARISON-REPORT.md
});
```markdown
### Comparison Checklist

**Must Match:**
- ✅ Page layout structure (header, tabs, table)
- ✅ All functional elements present (buttons, dropdowns, filters)
- ✅ Data display patterns (columns, formatting)

**Expected Differences (OK):**
- ✅ Colors (Alleato design system)
- ✅ Fonts (design system typography)
- ✅ Spacing variations (8px grid)
- ✅ Icons (Lucide React vs Procore)

**Unacceptable (MUST FIX):**
- ❌ Missing functionality (tabs, buttons, features)
- ❌ Wrong data displayed
- ❌ Broken layout
- ❌ Missing critical UI elements

### Output Required

Create `tests/screenshots/[feature]-e2e/COMPARISON-REPORT.md`:

```markdown
# Visual Comparison: [Feature]

**Reference:** scripts/screenshot-capture/procore-budget-crawl/pages/budget-main/screenshot.png
**Implementation:** tests/screenshots/budget-e2e/implementation.png

## Results

- Layout: ✅ PASS
- Functionality: ❌ FAIL - Missing Export button
- Design differences: ✅ Expected (design system)

## Blocking Issues
1. Export to Excel button missing

## Verdict: ❌ FAIL
```

---

## 🧪 Test Structure Patterns

### beforeEach Setup

```typescript
test.describe('Feature Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigation
    await page.goto(`/${projectId}/budget`);
    await page.waitForLoadState('networkidle');

    // Cleanup (if needed)
    const authFile = path.join(__dirname, '../.auth/user.json');
    const authData = JSON.parse(require('fs').readFileSync(authFile, 'utf-8'));
    const authCookies = authData.cookies
      .map((cookie: { name: string; value: string }) => `${cookie.name}=${cookie.value}`)
      .join('; ');

    // Clean up test data
    try {
      await page.request.delete(
        `http://localhost:3000/api/test-data/${testId}`,
        { headers: { Cookie: authCookies } }
      );
    } catch (error) {
      console.log('Cleanup warning:', error);
    }
  });
});
```typescript
### Helper Functions

```typescript
// Navigation helper
async function navigateToBudget(page: Page, projectId: string = TEST_PROJECT_ID) {
  await page.goto(`http://localhost:3000/${projectId}/budget`);
  await page.waitForLoadState('networkidle');
}

// Screenshot helper
async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({
    path: `tests/screenshots/budget-e2e/${name}.png`,
    fullPage: true,
  });
}
```javascript
---

## 🔄 API Testing Patterns

### Test Setup via API

```typescript
// Create test data before UI interaction
const createResponse = await page.request.post(
  `http://localhost:3000/api/projects/${TEST_PROJECT_ID}/budget/views`,
  {
    headers: {
      Cookie: authCookies,
      'Content-Type': 'application/json',
    },
    data: {
      name: 'Test View',
      columns: [{ column_key: 'costCode', display_order: 1 }],
    },
  }
);
expect(createResponse.status()).toBe(201);
const { view: createdView } = await createResponse.json();
```bash
### Cleanup via API

```typescript
// Clean up after test
await page.request.delete(
  `http://localhost:3000/api/projects/${TEST_PROJECT_ID}/budget/views/${createdView.id}`,
  { headers: { Cookie: authCookies } }
);
```

---

## 📝 Common Assertions

### Visibility Checks

```typescript
// Element is visible
await expect(page.locator('button:has-text("Create")')).toBeVisible();

// Element is NOT visible
await expect(page.locator('[role="menu"]')).not.toBeVisible();

// Multiple elements with count
await expect(page.locator('[role="tab"]')).toHaveCount(3);
```bash
### Text Content

```typescript
// Contains text
await expect(page.locator('h1')).toContainText('Budget');

// Has exact text
await expect(page.locator('.total')).toHaveText('$100,000.00');

// Text with timeout
await expect(updatedButton).toContainText('Test View', { timeout: 5000 });
```javascript
### API Response Checks

```typescript
// Status code
expect(response.status()).toBe(200);

// Response body
const data = await response.json();
expect(data.views).toHaveLength(1);
expect(data.views[0].name).toBe('Procore Standard');
```yaml
---

## ⚡ Performance Patterns

### Parallel vs Sequential

```typescript
// Playwright config
fullyParallel: false, // Tests run sequentially for stability
workers: 1, // Single worker for auth state consistency
```

### Selective Test Execution

```bash
# Run specific test file
npx playwright test tests/e2e/budget-comprehensive.spec.ts

# Run specific test by name
npx playwright test -g "should display budget page correctly"

# Run in headed mode for debugging
npx playwright test --headed

# Run with specific project
npx playwright test --project=chromium
```diff
---

## 🚫 Anti-Patterns (AVOID)

### ❌ Don't Do This

```typescript
// ❌ Using generic selectors without filtering
await page.locator('button').click(); // Which button?

// ❌ Hard timeouts instead of waiting for conditions
await page.waitForTimeout(5000); // Too long, use waitForSelector

// ❌ Not handling auth state
await page.goto('/protected'); // Will fail if not authenticated

// ❌ Ignoring network idle
await page.goto('/dashboard');
// Missing: await page.waitForLoadState('networkidle');

// ❌ Not cleaning up test data
// Tests leave orphaned records in DB
```javascript
### ✅ Do This Instead

```typescript
// ✅ Specific selectors with filters
await page.locator('button').filter({ hasText: 'Create' }).click();

// ✅ Conditional waits
await page.waitForSelector('[role="menu"]', { timeout: 5000 });

// ✅ Use saved auth state (configured in playwright.config.ts)
// Auth is automatically loaded from storageState

// ✅ Always wait for network idle
await page.goto('/dashboard');
await page.waitForLoadState('networkidle');

// ✅ Clean up in beforeEach or afterEach
test.afterEach(async ({ page }) => {
  await cleanupTestData(page);
});
```diff
---

## 🔍 Debugging Tips

### Enable Trace Viewer

```bash
# Run with trace
npx playwright test --trace on

# View trace
npx playwright show-trace trace.zip
```

### View Test Reports

```bash
# Generate and open HTML report
npx playwright show-report tests/playwright-report
```markdown
### Console Output

```typescript
// Listen to console messages
page.on('console', msg => console.log('PAGE LOG:', msg.text()));

// Listen to page errors
page.on('pageerror', err => console.log('PAGE ERROR:', err));
```sql
### Interactive Debugging

```bash
# Run in debug mode (opens inspector)
npx playwright test --debug

# Run in headed mode
npx playwright test --headed --headed-slow
```sql
---

## 📚 Configuration Reference

**File:** `frontend/config/playwright/playwright.config.ts`

```typescript
export default defineConfig({
  testDir: '../../tests',
  testMatch: '**/*.spec.{ts,js}',
  fullyParallel: false,
  workers: 1,
  timeout: 120000, // 2 minutes for agent responses
  expect: {
    timeout: 15000,
  },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    // Setup project - runs first
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    // Main tests - uses saved auth
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
});
```

---

## 🎓 Key Takeaways

1. **Always use saved auth state** - Never authenticate in every test
2. **Wait for network idle** - Don't trust immediate DOM state
3. **Use role-based selectors** - More semantic and stable
4. **Filter chains for duplicates** - Use `.first()` or `.last()` appropriately
5. **Clean up test data** - Don't pollute the database
6. **Screenshot on failure** - Automatic debugging evidence
7. **API requests need auth cookies** - Extract from `user.json`
8. **Strategic timeouts** - Only when absolutely necessary (state updates)
9. **🚨 Compare reference screenshots** - If reference exists, create COMPARISON-REPORT.md before claiming complete

---

**Last Updated:** 2026-01-10
**Playwright Version:** 1.57.0
**Test Suite Location:** `frontend/tests/e2e/`
