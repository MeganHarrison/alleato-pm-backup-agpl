---
title: auth fixture pattern
description: auth fixture pattern documentation
---

# Solution: Universal Auth Fixture Pattern

> Migrated on 2026-04-14.
> Canonical replacement: `docs/ops/patterns/playwright-authenticated-api-requests.md`.

**Solves:** auth-fixture-missing.md
**Category:** Testing

---

## The Pattern

Create a single auth fixture that provides authenticated requests for all tests:

```typescript
// Import this instead of @playwright/test
import { test, expect } from '../fixtures';

test('api call with auth', async ({ authenticatedRequest }) => {
  const response = await authenticatedRequest.get('/api/projects');
  expect(response.ok()).toBe(true);
});
```typescript
---

## Full Fixture Implementation

Create `frontend/tests/fixtures/index.ts`:

```typescript
import { test as base, expect, Page, APIRequestContext } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Types for our custom fixtures
interface AuthenticatedRequest {
  get: (url: string, options?: RequestOptions) => Promise<Response>;
  post: (url: string, options?: RequestOptions) => Promise<Response>;
  put: (url: string, options?: RequestOptions) => Promise<Response>;
  patch: (url: string, options?: RequestOptions) => Promise<Response>;
  delete: (url: string, options?: RequestOptions) => Promise<Response>;
}

interface RequestOptions {
  data?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, string>;
}

interface AuthFixtures {
  authenticatedRequest: AuthenticatedRequest;
  authToken: string | null;
}

// Helper to get auth token from stored state
function getAuthToken(): string | null {
  try {
    const authPath = path.join(__dirname, '../.auth/user.json');
    if (!fs.existsSync(authPath)) {
      console.warn('Auth state file not found. Run auth setup first.');
      return null;
    }

    const auth = JSON.parse(fs.readFileSync(authPath, 'utf-8'));

    // Find the access token in localStorage
    const localStorage = auth.origins?.[0]?.localStorage || [];
    const tokenItem = localStorage.find(
      (item: { name: string }) =>
        item.name.includes('access-token') ||
        item.name.includes('sb-') && item.name.includes('-auth-token')
    );

    return tokenItem?.value || null;
  } catch (error) {
    console.error('Error reading auth token:', error);
    return null;
  }
}

// Extend the base test with our auth fixtures
export const test = base.extend<AuthFixtures>({
  // Provide the raw auth token
  authToken: async ({}, use) => {
    const token = getAuthToken();
    await use(token);
  },

  // Provide authenticated API request methods
  authenticatedRequest: async ({ request }, use) => {
    const token = getAuthToken();
    const authHeaders: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : {};

    const makeRequest = async (
      method: 'get' | 'post' | 'put' | 'patch' | 'delete',
      url: string,
      options: RequestOptions = {}
    ) => {
      const { data, headers = {}, params } = options;

      const requestOptions: any = {
        headers: { ...authHeaders, ...headers },
      };

      if (data !== undefined) {
        requestOptions.data = data;
      }

      if (params) {
        requestOptions.params = params;
      }

      return request[method](url, requestOptions);
    };

    const wrappedRequest: AuthenticatedRequest = {
      get: (url, options) => makeRequest('get', url, options),
      post: (url, options) => makeRequest('post', url, options),
      put: (url, options) => makeRequest('put', url, options),
      patch: (url, options) => makeRequest('patch', url, options),
      delete: (url, options) => makeRequest('delete', url, options),
    };

    await use(wrappedRequest);
  },
});

// Re-export expect for convenience
export { expect };

// Re-export useful types
export type { Page, APIRequestContext };
```sql
---

## Usage Examples

### API Tests

```typescript
import { test, expect } from '../fixtures';

test.describe('Change Events API', () => {
  test('GET /api/projects/[projectId]/change-events', async ({
    authenticatedRequest,
  }) => {
    const response = await authenticatedRequest.get(
      '/api/projects/123/change-events'
    );

    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('POST creates new change event', async ({ authenticatedRequest }) => {
    const response = await authenticatedRequest.post(
      '/api/projects/123/change-events',
      {
        data: {
          title: 'Test Event',
          description: 'Test description',
        },
      }
    );

    expect(response.status()).toBe(201);

    const data = await response.json();
    expect(data.title).toBe('Test Event');
  });

  test('DELETE removes change event', async ({ authenticatedRequest }) => {
    // First create one
    const createResponse = await authenticatedRequest.post(
      '/api/projects/123/change-events',
      { data: { title: 'To Delete' } }
    );
    const created = await createResponse.json();

    // Then delete it
    const deleteResponse = await authenticatedRequest.delete(
      `/api/projects/123/change-events/${created.id}`
    );

    expect(deleteResponse.status()).toBe(200);
  });
});
```javascript
### Browser Tests with Auth

```typescript
import { test, expect } from '../fixtures';

test.describe('Change Events Page', () => {
  // Use stored auth state for browser tests
  test.use({ storageState: 'tests/.auth/user.json' });

  test('displays change events list', async ({ page }) => {
    await page.goto('/123/change-events');
    await page.waitForLoadState('domcontentloaded');

    // Auth cookies are automatically loaded
    await expect(page.locator('h1')).toContainText('Change Events');
  });
});
```

### Combined Browser + API

```typescript
import { test, expect } from '../fixtures';

test.describe('Change Events Full Flow', () => {
  test.use({ storageState: 'tests/.auth/user.json' });

  test('create via form and verify via API', async ({
    page,
    authenticatedRequest,
  }) => {
    // Create via browser
    await page.goto('/123/change-events/new');
    await page.fill('[name="title"]', 'Browser Created');
    await page.click('button[type="submit"]');

    // Verify via API
    const response = await authenticatedRequest.get(
      '/api/projects/123/change-events'
    );
    const events = await response.json();

    expect(events.some((e: any) => e.title === 'Browser Created')).toBe(true);
  });
});
```sql
---

## Migration Guide

Update test imports:

```typescript
// Before (no auth)
import { test, expect } from '@playwright/test';

// After (with auth)
import { test, expect } from '../fixtures';
```javascript
For tests that use API requests:

```typescript
// Before (fails with 401)
test('api test', async ({ request }) => {
  const response = await request.get('/api/projects');
});

// After (authenticated)
test('api test', async ({ authenticatedRequest }) => {
  const response = await authenticatedRequest.get('/api/projects');
});
```

---

## Prerequisites

1. Auth setup must run first:

   ```bash
   npx playwright test auth.setup.ts
   ```bash
2. Auth state file must exist:

   ```text
   frontend/tests/.auth/user.json
   ```bash
3. Test user must have valid credentials:

   ```yaml
   Email: test1@mail.com
   Password: test12026!!!
   ```

---

## References

- Error pattern: `.agents/patterns/errors/auth-fixture-missing.md`
- Auth setup: `frontend/tests/auth.setup.ts`
- Playwright fixtures docs: <https://playwright.dev/docs/test-fixtures>
