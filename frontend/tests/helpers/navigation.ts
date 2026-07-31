/**
 * Navigation Helpers for Playwright Tests
 *
 * These helpers use `domcontentloaded` instead of `networkidle` to prevent
 * timeout issues in modern web applications with continuous background requests.
 *
 * ALWAYS use these instead of:
 * ```typescript
 * await page.goto(url);
 * await page.waitForLoadState('networkidle'); // NEVER DO THIS
 * ```
 *
 * @see .agents/patterns/errors/networkidle-timeout.md
 * @see .agents/patterns/solutions/domcontentloaded-pattern.md
 */

import { Page, type APIResponse } from '@playwright/test';

/**
 * Navigate to a URL and wait for DOM to be ready.
 *
 * Use this instead of page.goto() + waitForLoadState('networkidle')
 *
 * @example
 * ```typescript
 * await safeNavigate(page, '/dashboard');
 * ```
 */
export async function safeNavigate(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Navigate and wait for a specific element to appear.
 *
 * Use this when you need to verify the page loaded specific content.
 *
 * @example
 * ```typescript
 * await navigateAndWaitFor(page, '/projects', '[data-testid="project-list"]');
 * ```
 */
export async function navigateAndWaitFor(
  page: Page,
  url: string,
  selector: string,
  options: { timeout?: number; state?: 'visible' | 'attached' | 'hidden' } = {}
): Promise<void> {
  const { timeout = 30000, state = 'visible' } = options;

  await page.goto(url);
  await page.waitForLoadState('domcontentloaded');
  await page.locator(selector).waitFor({ state, timeout });
}

/**
 * Navigate to a project page (handles [projectId] routes)
 *
 * @example
 * ```typescript
 * await navigateToProject(page, '123', 'budget');
 * // Navigates to /123/budget
 * ```
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
 * Navigate to project page and wait for specific element
 *
 * @example
 * ```typescript
 * await navigateToProjectAndWaitFor(page, '123', 'budget', '[data-testid="budget-table"]');
 * ```
 */
export async function navigateToProjectAndWaitFor(
  page: Page,
  projectId: string,
  subPath: string,
  selector: string,
  options: { timeout?: number } = {}
): Promise<void> {
  const url = `/${projectId}/${subPath}`;
  await navigateAndWaitFor(page, url, selector, options);
}

/**
 * Wait for API data to load (use instead of networkidle)
 *
 * This function waits for loading indicators to disappear and optionally
 * for specific data elements to appear.
 *
 * @example
 * ```typescript
 * await safeNavigate(page, '/projects');
 * await waitForDataLoad(page, {
 *   loadingSelector: '.skeleton-loader',
 *   dataSelector: '[data-testid="project-list"]'
 * });
 * ```
 */
export async function waitForDataLoad(
  page: Page,
  options: {
    /** Selector for loading indicators (will wait for them to disappear) */
    loadingSelector?: string;
    /** Selector for data element (will wait for it to appear) */
    dataSelector?: string;
    /** Timeout in milliseconds */
    timeout?: number;
  } = {}
): Promise<void> {
  const {
    loadingSelector = '[data-loading="true"], .skeleton, .loading, [aria-busy="true"]',
    dataSelector,
    timeout = 30000,
  } = options;

  // Wait for any loading indicators to disappear
  const loaders = page.locator(loadingSelector);
  const loaderCount = await loaders.count();

  if (loaderCount > 0) {
    // Wait for each visible loader to disappear
    for (let i = 0; i < loaderCount; i++) {
      const loader = loaders.nth(i);
      if (await loader.isVisible()) {
        await loader.waitFor({ state: 'hidden', timeout });
      }
    }
  }

  // Optionally wait for specific data element to appear
  if (dataSelector) {
    await page.locator(dataSelector).waitFor({ state: 'visible', timeout });
  }
}

/**
 * Wait for a table to load data
 *
 * @example
 * ```typescript
 * await waitForTableLoad(page, '[data-testid="projects-table"]');
 * ```
 */
export async function waitForTableLoad(
  page: Page,
  tableSelector: string,
  options: { minRows?: number; timeout?: number } = {}
): Promise<void> {
  const { minRows = 1, timeout = 30000 } = options;

  // Wait for table to be visible
  await page.locator(tableSelector).waitFor({ state: 'visible', timeout });

  // Wait for table to have data (tbody rows)
  const rowSelector = `${tableSelector} tbody tr`;
  await page.locator(rowSelector).first().waitFor({ state: 'visible', timeout });

  // Optionally verify minimum row count
  if (minRows > 1) {
    await page.waitForFunction(
      ({ selector, min }) => {
        const rows = document.querySelectorAll(selector);
        return rows.length >= min;
      },
      { selector: rowSelector, min: minRows },
      { timeout }
    );
  }
}

/**
 * Navigate and wait for network request to complete
 *
 * Use this when you need to wait for a specific API call to complete.
 *
 * @example
 * ```typescript
 * const response = await navigateAndWaitForAPI(
 *   page,
 *   '/projects',
 *   /api\/projects/
 * );
 * const data = await response.json();
 * ```
 */
export async function navigateAndWaitForAPI(
  page: Page,
  url: string,
  apiPattern: string | RegExp,
  options: { timeout?: number } = {}
): Promise<APIResponse> {
  const { timeout = 30000 } = options;

  // Set up response promise before navigation
  const responsePromise = page.waitForResponse(
    (response) => {
      const urlMatch =
        typeof apiPattern === 'string'
          ? response.url().includes(apiPattern)
          : apiPattern.test(response.url());
      return urlMatch && response.status() === 200;
    },
    { timeout }
  );

  // Navigate
  await page.goto(url);
  await page.waitForLoadState('domcontentloaded');

  // Wait for the API response
  const response = (await responsePromise) as unknown as APIResponse;
  return response;
}

/**
 * Click and wait for navigation to complete
 *
 * @example
 * ```typescript
 * await clickAndNavigate(page, '[data-testid="view-project-btn"]');
 * ```
 */
export async function clickAndNavigate(
  page: Page,
  selector: string,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 30000 } = options;

  await Promise.all([
    page.waitForLoadState('domcontentloaded', { timeout }),
    page.locator(selector).click(),
  ]);
}

/**
 * Click and wait for specific element to appear (for modal/dialog triggers)
 *
 * @example
 * ```typescript
 * await clickAndWaitFor(page, '[data-testid="open-modal-btn"]', '[role="dialog"]');
 * ```
 */
export async function clickAndWaitFor(
  page: Page,
  clickSelector: string,
  waitSelector: string,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 30000 } = options;

  await page.locator(clickSelector).click();
  await page.locator(waitSelector).waitFor({ state: 'visible', timeout });
}
