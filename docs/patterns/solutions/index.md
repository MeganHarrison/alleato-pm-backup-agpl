---
title: Solution Patterns
description: Proven solution patterns for preventing common mistakes in the Alleato codebase. These patterns solve documented error patterns.
keywords: ["solutions", "patterns", "fixes", "verification", "authentication", "testing", "quality gates"]
---

# Solution Patterns

> Deprecated on 2026-04-14.
> Canonical replacement: `docs/ops/patterns/index.md`.

This library documents proven solutions to recurring problems in the Alleato-Procore project. Each solution pattern addresses specific [error patterns](/patterns/error-patterns) documented in the codebase.

## Available Solutions

| Solution | Solves | Category |
|----------|--------|----------|
| [Verification Gate Pattern](#verification-gate-pattern) | Premature Completion | Workflow |
| [DOMContentLoaded Pattern](#domcontentloaded-pattern) | NetworkIdle Timeout | Testing |
| [Auth Fixture Pattern](#auth-fixture-pattern) | Auth Fixture Missing | Testing |

---

## Verification Gate Pattern

**Solves:** [Premature Completion](/patterns/error-patterns#premature-completion)
**Category:** Workflow

### The Pattern

Every task completion requires cryptographic proof that verification was actually run:

```markdown
## Gates Status
| Gate | Status | Checksum | Timestamp |
|------|--------|----------|-----------|
| Quality | PASSED | a1b2c3d4 | 2026-01-12T14:30:00Z |
| Tests | PASSED | e5f6g7h8 | 2026-01-12T14:35:00Z |
| Verify | VERIFIED | i9j0k1l2 | 2026-01-12T14:40:00Z |
```typescript
### Gate Enforcement Tool

Create `.agents/tools/enforce-gates.ts`:

```typescript
import { execSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

interface GateResult {
  name: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  checksum: string;
  timestamp: string;
  evidence: string;
  command: string;
}

interface GateConfig {
  name: string;
  command: string;
  successPattern: RegExp;
  required: boolean;
}

const GATES: GateConfig[] = [
  {
    name: 'TypeScript',
    command: 'npm run typecheck --prefix frontend 2>&1',
    successPattern: /error TS\d+/,
    required: true,
  },
  {
    name: 'ESLint',
    command: 'npm run lint --prefix frontend 2>&1',
    successPattern: /\d+ errors?/,
    required: true,
  },
  {
    name: 'Tests',
    command: '', // Set dynamically based on feature
    successPattern: /\d+ failed/,
    required: true,
  },
];

function generateChecksum(output: string): string {
  const timestamp = Date.now().toString();
  return crypto
    .createHash('sha256')
    .update(output + timestamp)
    .digest('hex')
    .slice(0, 12);
}

function runGate(config: GateConfig): GateResult {
  const timestamp = new Date().toISOString();

  try {
    const output = execSync(config.command, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    const hasErrors = config.successPattern.test(output);
    const status = hasErrors ? 'FAILED' : 'PASSED';

    return {
      name: config.name,
      status,
      checksum: generateChecksum(output),
      timestamp,
      evidence: output.slice(0, 500),
      command: config.command,
    };
  } catch (error: any) {
    const output = error.stdout || error.message;
    const hasErrors = config.successPattern.test(output);

    return {
      name: config.name,
      status: hasErrors ? 'FAILED' : 'PASSED',
      checksum: generateChecksum(output),
      timestamp,
      evidence: output.slice(0, 500),
      command: config.command,
    };
  }
}

export function runAllGates(feature: string): {
  allPassed: boolean;
  results: GateResult[];
  markdown: string;
} {
  // Configure test command for feature
  const testGate = GATES.find((g) => g.name === 'Tests');
  if (testGate) {
    testGate.command = `npx playwright test frontend/tests/e2e/${feature}*.spec.ts --reporter=list 2>&1`;
  }

  const results = GATES.map(runGate);
  const allPassed = results.every((r) => r.status === 'PASSED');

  return { allPassed, results };
}
```markdown
### Usage

Run gates for a feature:

```bash
npx tsx .agents/tools/enforce-gates.ts change-events
```text
Output:
```

Running gates for: change-events

Gates written to: documentation/*project-mgmt/active/change-events/GATES.md

All gates passed: YES ✅

```typescript
### Pre-Commit Hook Integration

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Check if any feature folders have GATES.md
for feature_dir in documentation/*project-mgmt/active/*/; do
  gates_file="$feature_dir/GATES.md"

  if [ -f "$gates_file" ]; then
    # Check if gates are recent (within 1 hour)
    last_modified=$(stat -f %m "$gates_file" 2>/dev/null || stat -c %Y "$gates_file")
    current_time=$(date +%s)
    age=$((current_time - last_modified))

    if [ $age -gt 3600 ]; then
      echo "ERROR: GATES.md in $feature_dir is stale (older than 1 hour)"
      echo "Run: npx tsx .agents/tools/enforce-gates.ts <feature>"
      exit 1
    fi

    # Check if all gates passed
    if grep -q "❌ FAILED" "$gates_file"; then
      echo "ERROR: Gates failed in $feature_dir"
      echo "Fix issues and re-run: npx tsx .agents/tools/enforce-gates.ts <feature>"
      exit 1
    fi
  fi
done

echo "All gates validated ✅"
```markdown
### Gate Verification Flow

```mermaid
graph TD
    A[Agent completes implementation] --> B[Run: enforce-gates.ts feature]
    B --> C[Execute quality gates]
    C --> D[Generate checksums]
    D --> E[Write GATES.md]
    E --> F[Pre-commit hook validates]
    F --> G{All PASSED?}
    G -->|Yes| H[Commit allowed]
    G -->|No| I[Commit blocked]
```markdown
### Integration with Workflow

Before claiming completion:

1. Run gates:
   ```bash
   npx tsx .agents/tools/enforce-gates.ts {feature}
   ```

1. Verify GATES.md shows all PASSED

2. Include gate checksums in completion claim:

   ```markdown
   ## Completion Evidence
   - Quality: PASSED (checksum: a1b2c3d4)
   - Tests: PASSED (checksum: e5f6g7h8)
   - Verify: VERIFIED (checksum: i9j0k1l2)
   ```

---

## DOMContentLoaded Pattern

**Solves:** [NetworkIdle Timeout](/patterns/error-patterns#networkidle-timeout)
**Category:** Testing

### The Problem

Modern web applications never reach `networkidle` state due to:

- Continuous polling (websockets, real-time updates)
- Background API calls
- Analytics and tracking

### The Solution

Use `domcontentloaded` which settles when initial HTML is loaded:

```typescript
// WRONG - Will timeout
await page.goto('/dashboard');
await page.waitForLoadState('networkidle');  // Hangs

// CORRECT - Reliable
await page.goto('/dashboard');
await page.waitForLoadState('domcontentloaded');
```

### Navigation Helper Pattern

Create reusable navigation helper:

```typescript
// frontend/tests/helpers/navigation.ts
import { Page } from '@playwright/test';

export async function safeNavigate(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState('domcontentloaded');
}

export async function navigateAndWaitFor(
  page: Page,
  url: string,
  selector: string,
  timeout = 10000
) {
  await page.goto(url);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector(selector, { timeout });
}
```javascript
### Usage in Tests

```typescript
import { test, expect } from '@playwright/test';
import { safeNavigate, navigateAndWaitFor } from '../helpers/navigation';

test('budget page loads correctly', async ({ page }) => {
  // Simple navigation
  await safeNavigate(page, '/projects/123/budget');

  // Navigate and wait for specific element
  await navigateAndWaitFor(
    page,
    '/projects/123/budget',
    '[data-testid="budget-table"]'
  );

  // Continue with test
  await expect(page.locator('h1')).toContainText('Budget');
});
```javascript
### When to Wait for Specific Elements

After navigation, wait for the critical element that indicates page is ready:

```typescript
await page.goto('/dashboard');
await page.waitForLoadState('domcontentloaded');

// Wait for key element to ensure data loaded
await page.waitForSelector('[data-testid="dashboard-loaded"]', {
  timeout: 10000
});

// Or use assertions
await expect(page.locator('[data-testid="user-profile"]')).toBeVisible({
  timeout: 5000
});
```markdown
### Data Attribute Pattern

Add data attributes to key elements for reliable waiting:

```tsx
// In your React components
export function Dashboard() {
  const { data, isLoading } = useDashboardData();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div data-testid="dashboard-loaded">
      {/* Dashboard content */}
    </div>
  );
}
```

---

## Auth Fixture Pattern

**Solves:** [Auth Fixture Missing](/patterns/error-patterns#auth-fixture-missing)
**Category:** Testing

### The Problem

API requests in tests fail with 401 because no authentication is set up.

### The Solution

Create reusable auth fixture and use across all tests.

### Auth Setup File

```typescript
// frontend/tests/auth.setup.ts
import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const authFile = path.join(__dirname, '.auth/user.json');

setup('authenticate', async ({ page }) => {
  const email = process.env.TEST_USER_1 || 'test1@mail.com';
  const password = process.env.TEST_PASSWORD_1 || 'test12026!!!';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw new Error(`Authentication failed: ${error.message}`);

  // Inject auth into localStorage
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

  await page.reload();
  await page.waitForLoadState('domcontentloaded');

  // Save state
  await page.context().storageState({ path: authFile });
});
```sql
### Playwright Config

```typescript
// playwright.config.ts
export default defineConfig({
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
```typescript
### Using Auth in Tests

#### UI Tests (Automatic)

```typescript
// Auth is automatically loaded from storageState
test('create budget view', async ({ page }) => {
  // Page already has auth cookies
  await page.goto('/projects/123/budget');
  await page.locator('button:has-text("Create View")').click();
  // Works because cookies are present
});
```typescript
#### API Tests (Manual Cookies)

```typescript
import path from 'path';
import fs from 'fs';

test('create view via API', async ({ page, request }) => {
  // Load auth cookies
  const authFile = path.join(__dirname, '../.auth/user.json');
  const authData = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
  const authCookies = authData.cookies
    .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
    .join('; ');

  // Make authenticated request
  const response = await request.post(
    'http://localhost:3000/api/projects/123/budget/views',
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

  expect(response.status()).toBe(201);
});
```

### Auth Helper Module

Create reusable helper:

```typescript
// frontend/tests/helpers/auth.ts
import path from 'path';
import fs from 'fs';

export function getAuthCookies(): string {
  const authFile = path.join(__dirname, '../.auth/user.json');
  const authData = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
  return authData.cookies
    .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
    .join('; ');
}

export async function makeAuthenticatedRequest(
  request: any,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  data?: any
) {
  const cookies = getAuthCookies();

  const options: any = {
    headers: { Cookie: cookies },
  };

  if (data) {
    options.headers['Content-Type'] = 'application/json';
    options.data = data;
  }

  switch (method) {
    case 'GET':
      return request.get(url, options);
    case 'POST':
      return request.post(url, options);
    case 'PUT':
      return request.put(url, options);
    case 'DELETE':
      return request.delete(url, options);
  }
}
```javascript
### Usage with Helper

```typescript
import { test, expect } from '@playwright/test';
import { makeAuthenticatedRequest } from '../helpers/auth';

test('CRUD operations', async ({ request }) => {
  // Create
  const createRes = await makeAuthenticatedRequest(
    request,
    'POST',
    'http://localhost:3000/api/views',
    { name: 'Test View' }
  );
  expect(createRes.status()).toBe(201);

  const { id } = await createRes.json();

  // Read
  const getRes = await makeAuthenticatedRequest(
    request,
    'GET',
    `http://localhost:3000/api/views/${id}`
  );
  expect(getRes.status()).toBe(200);

  // Delete
  const delRes = await makeAuthenticatedRequest(
    request,
    'DELETE',
    `http://localhost:3000/api/views/${id}`
  );
  expect(delRes.status()).toBe(204);
});
```

---

## References

- [Error Patterns](/patterns/error-patterns) - Problems these solutions address
- [Playwright Testing Patterns](/patterns/playwright-patterns) - Comprehensive testing guide
- [Validated Patterns](/patterns/overview) - Code pattern registry
