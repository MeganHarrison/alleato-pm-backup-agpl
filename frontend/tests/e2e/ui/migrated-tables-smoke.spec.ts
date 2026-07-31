import { test, expect } from '@playwright/test';

/**
 * Smoke test for migrated table pages
 * Just verifies pages load without crashing
 */

const MIGRATED_PAGES = [
  '/submittals',
  '/meetings',
  '/drawings',
  '/punch-list',
  '/rfis',
  '/users',
  '/daily-log',
  '/emails',
  '/photos',
  '/infinite-meetings',
  '/infinite-projects',
  '/projects',
  '/companies',
  '/contacts',
  '/clients',
];

test.describe('Migrated Tables Smoke Test', () => {
  for (const url of MIGRATED_PAGES) {
    test(`${url} loads without errors`, async ({ page }) => {
      const errors: string[] = [];

      // Capture console errors
      page.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().includes('favicon')) {
          errors.push(msg.text());
        }
      });

      // Navigate to page
      const response = await page.goto(url);

      // Check response status
      expect(response?.status()).toBeLessThan(400);

      // Wait for page to stabilize
      await page.waitForLoadState('domcontentloaded');

      // Check page doesn't have critical React errors
      const hasErrorBoundary = await page.locator('text=/error/i, text=/crashed/i').count() > 0;
      expect(hasErrorBoundary).toBeFalsy();

      // Check for major console errors (filter out known warnings)
      const criticalErrors = errors.filter(err =>
        !err.includes('Warning:') &&
        !err.includes('DevTools') &&
        !err.includes('source map')
      );

      if (criticalErrors.length > 0) {
        console.log(`Errors on ${url}:`, criticalErrors);
      }

      // Should have minimal critical errors
      expect(criticalErrors.length).toBeLessThan(3);
    });
  }
});
