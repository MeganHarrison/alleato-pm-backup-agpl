import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:3000';

test.describe('UI Consistency', () => {
  test('home page exposes portfolio hero', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.getByRole('heading', { name: /portfolio/i })).toBeVisible();
  });

  test('budget page uses shared layout shell', async ({ page }) => {
    await page.goto(`${BASE_URL}/123/budget`);
    await expect(page.getByText(/Loading budget data/i)).toBeVisible();
    await expect(page.locator('div.rounded-lg.border.bg-white').first()).toBeVisible();
  });

  test('contracts page includes toolbar and responsive table', async ({ page }) => {
    await page.goto(`${BASE_URL}/123/contracts`);
    await expect(page.locator('[data-testid="page-toolbar"]').first()).toBeVisible();
    await expect(page.getByText(/no contracts found/i)).toBeVisible();
    await page.screenshot({
      path: 'tests/screenshots/ui-consistency/contracts-spec.png',
      fullPage: true,
    });
  });
});
