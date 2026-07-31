---
title: auth fixture missing
description: auth fixture missing documentation
---

# Pattern: Auth Fixture Missing

> Migrated on 2026-04-14.
> Canonical replacement: `docs/ops/patterns/playwright-authenticated-api-requests.md`.

**Severity:** CRITICAL
**Triggers:** `playwright`, `test`, `api`, `request`, `401`, `403`, `unauthorized`, `forbidden`, `auth`, `cookie`, `bearer`, `token`
**Category:** Testing

---

## The Mistake

Making API requests in Playwright tests without proper authentication:

```typescript
// WRONG - API call returns 401/403
const response = await page.request.get('/api/projects');
// Error: 401 Unauthorized

// WRONG - Using page.request without auth headers
await page.request.post('/api/projects', { data: { name: 'Test' } });
// Error: 403 Forbidden
```javascript
**Root cause:** The auth state saved in `tests/.auth/user.json` contains cookies and localStorage, but `page.request` doesn't automatically use the Bearer token needed for API calls.

---

## The Fix

**Option 1: Use the auth fixture (RECOMMENDED)**

```typescript
// Import from fixtures instead of @playwright/test
import { test, expect } from '../fixtures';

test('api test', async ({ authenticatedRequest }) => {
  // This automatically includes Bearer token
  const response = await authenticatedRequest.get('/api/projects');
  expect(response.ok()).toBe(true);
});
```typescript
**Option 2: Manual token injection**

```typescript
import { test, expect } from '@playwright/test';
import fs from 'fs';

test('api test', async ({ request }) => {
  const auth = JSON.parse(fs.readFileSync('tests/.auth/user.json', 'utf-8'));
  const token = auth.origins[0]?.localStorage?.find(
    (item: { name: string }) => item.name === 'sb-access-token'
  )?.value;

  const response = await request.get('/api/projects', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
});
```javascript
**Option 3: For browser-based tests, ensure cookies are loaded**

```typescript
test.use({ storageState: 'tests/.auth/user.json' });

test('browser test with auth', async ({ page }) => {
  // Cookies automatically loaded
  await page.goto('/dashboard');
});
```

---

## The Auth Fixture Implementation

Create/verify `frontend/tests/fixtures/index.ts`:

```typescript
import { test as base, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

type AuthFixtures = {
  authenticatedRequest: {
    get: (url: string, options?: object) => Promise<Response>;
    post: (url: string, options?: object) => Promise<Response>;
    put: (url: string, options?: object) => Promise<Response>;
    delete: (url: string, options?: object) => Promise<Response>;
  };
};

export const test = base.extend<AuthFixtures>({
  authenticatedRequest: async ({ request }, use) => {
    const authPath = path.join(__dirname, '../.auth/user.json');
    const auth = JSON.parse(fs.readFileSync(authPath, 'utf-8'));

    const token = auth.origins?.[0]?.localStorage?.find(
      (item: { name: string }) => item.name.includes('access-token')
    )?.value;

    const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

    const wrappedRequest = {
      get: (url: string, options: object = {}) =>
        request.get(url, { ...options, headers: { ...authHeaders, ...(options as any).headers } }),
      post: (url: string, options: object = {}) =>
        request.post(url, { ...options, headers: { ...authHeaders, ...(options as any).headers } }),
      put: (url: string, options: object = {}) =>
        request.put(url, { ...options, headers: { ...authHeaders, ...(options as any).headers } }),
      delete: (url: string, options: object = {}) =>
        request.delete(url, { ...options, headers: { ...authHeaders, ...(options as any).headers } }),
    };

    await use(wrappedRequest);
  },
});

export { expect };
```diff
---

## Detection

Signs this mistake is happening:
1. API tests return 401 Unauthorized
2. API tests return 403 Forbidden
3. Tests pass for browser interactions but fail for API calls
4. Error: "User not authenticated" in API response

---

## Migration Path

```typescript
// Before (broken):
import { test, expect } from '@playwright/test';

// After (works):
import { test, expect } from '../fixtures';
```

---

## References

- Fixed in: `frontend/tests/e2e/change-events-api.spec.ts` (2026-01-10)
- Auth setup: `frontend/tests/auth.setup.ts`
- Auth state: `frontend/tests/.auth/user.json`
- Documentation: `frontend/tests/CHANGE-EVENTS-TEST-FIXES.md`
