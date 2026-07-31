---
title: domcontentloaded pattern
description: domcontentloaded pattern documentation
---

# Solution: DOMContentLoaded Navigation Pattern

> Migrated on 2026-04-14.
> Canonical replacement: `docs/ops/patterns/playwright-navigation-wait-strategy.md` and `docs/ops/patterns/playwright-navigation-helpers.md`.

**Solves:** networkidle-timeout.md
**Category:** Testing

---

## The Pattern

Use `domcontentloaded` instead of `networkidle` for reliable page navigation:

```typescript
// Standard navigation helper
export async function safeNavigate(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForLoadState('domcontentloaded');
}

// With element verification
export async function navigateAndWaitFor(
  page: Page,
  url: string,
  selector: string
): Promise<void> {
  await page.goto(url);
  await page.waitForLoadState('domcontentloaded');
  await page.locator(selector).waitFor({ state: 'visible' });
}
```typescript
---

## Full Navigation Helper

Create `frontend/tests/helpers/navigation.ts`:

```typescript
import { Page } from '@playwright/test';

/**
 * Navigate to a URL and wait for DOM to be ready.
 * Use this instead of page.goto() + waitForLoadState('networkidle')
 */
export async function safeNavigate(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Navigate and wait for a specific element to appear.
 * Use this when you need to verify the page loaded specific content.
 */
export async function navigateAndWaitFor(
  page: Page,
  url: string,
  selector: string,
  options: { timeout?: number; state?: 'visible' | 'attached' } = {}
): Promise<void> {
  const { timeout = 30000, state = 'visible' } = options;

  await page.goto(url);
  await page.waitForLoadState('domcontentloaded');
  await page.locator(selector).waitFor({ state, timeout });
}

/**
 * Navigate to a project page (handles [projectId] routes)
 */
export async function navigateToProject(
  page: Page,
  projectId: string,
  subPath: string = ''
): Promise<void> {
  const url = `/${projectId}${subPath ? `/${subPath}` : ''}`;
  await safeNavigate(page, url);
}

/**
 * Wait for API data to load (use instead of networkidle)
 * Waits for a loading indicator to disappear or data to appear
 */
export async function waitForDataLoad(
  page: Page,
  options: {
    loadingSelector?: string;
    dataSelector?: string;
    timeout?: number;
  } = {}
): Promise<void> {
  const {
    loadingSelector = '[data-loading="true"]',
    dataSelector,
    timeout = 30000
  } = options;

  // Wait for loading indicator to disappear
  const loader = page.locator(loadingSelector);
  if (await loader.isVisible()) {
    await loader.waitFor({ state: 'hidden', timeout });
  }

  // Optionally wait for data to appear
  if (dataSelector) {
    await page.locator(dataSelector).waitFor({ state: 'visible', timeout });
  }
}
```javascript
---

## Usage Examples

```typescript
import { test, expect } from '../fixtures';
import { safeNavigate, navigateAndWaitFor, waitForDataLoad } from '../helpers/navigation';

test('loads dashboard', async ({ page }) => {
  // Simple navigation
  await safeNavigate(page, '/dashboard');

  // Page is ready to interact with
  await expect(page.locator('h1')).toContainText('Dashboard');
});

test('loads project budget', async ({ page }) => {
  // Wait for specific element
  await navigateAndWaitFor(
    page,
    '/123/budget',
    '[data-testid="budget-table"]'
  );

  // Table is visible, can now test content
  await expect(page.locator('table')).toBeVisible();
});

test('loads data from API', async ({ page }) => {
  await safeNavigate(page, '/projects');

  // Wait for API data to load
  await waitForDataLoad(page, {
    loadingSelector: '.skeleton-loader',
    dataSelector: '[data-testid="project-list"]'
  });

  // Data is loaded, can now verify
  await expect(page.locator('.project-item')).toHaveCount(10);
});
```javascript
---

## When to Use What

| Scenario | Method |
|----------|--------|
| Simple page navigation | `safeNavigate(page, url)` |
| Wait for specific content | `navigateAndWaitFor(page, url, selector)` |
| After clicking a link | `page.waitForLoadState('domcontentloaded')` |
| Wait for API data | `waitForDataLoad(page, { dataSelector })` |
| **NEVER USE** | `waitForLoadState('networkidle')` |

---

## Migration Guide

Replace all instances of `networkidle`:

```typescript
// Before (breaks)
await page.goto('/dashboard');
await page.waitForLoadState('networkidle');

// After (works)
await page.goto('/dashboard');
await page.waitForLoadState('domcontentloaded');

// Best (use helper)
import { safeNavigate } from '../helpers/navigation';
await safeNavigate(page, '/dashboard');
```

---

## References

- Error pattern: `.agents/patterns/errors/networkidle-timeout.md`
- Playwright docs: <https://playwright.dev/docs/navigations>
