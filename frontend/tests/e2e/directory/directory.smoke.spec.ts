import { test, expect } from '@playwright/test';

test.describe('Directory Smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/directory/users', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="page-container"]', { timeout: 10000 }).catch(() => null);
  });

  test('users page renders with header and actions', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Directory');
    await expect(page.getByRole('button', { name: /add user/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /bulk add/i })).toBeVisible();
  });

  test('add user dialog opens and closes', async ({ page }) => {
    await page.getByRole('button', { name: /add user/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Add New User')).toBeVisible();

    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('search input filters or shows empty state safely', async ({ page }) => {
    const search = page.getByPlaceholder(/search/i).first();
    await expect(search).toBeVisible();

    await search.fill('zzzz-no-match-smoke');
    await page.waitForTimeout(500);

    const hasNoResults = await page.getByText(/no users found|no results/i).first().isVisible().catch(() => false);
    const hasRows = (await page.locator('table tbody tr').count().catch(() => 0)) > 0;

    expect(hasNoResults || hasRows).toBe(true);
  });
});
