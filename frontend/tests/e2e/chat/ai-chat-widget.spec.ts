import { test, expect, type Page } from '@playwright/test';

async function gotoHome(page: Page) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isTransientNavigationError =
        message.includes('ERR_CONNECTION_REFUSED') || message.includes('ERR_EMPTY_RESPONSE');
      if (!isTransientNavigationError || attempt === 3) {
        throw error;
      }
      await page.waitForTimeout(1000);
    }
  }
}

async function isLoginPage(page: Page) {
  const hasLogin = await page.getByRole('button', { name: 'Login' }).isVisible().catch(() => false);
  const hasEmail = await page.getByRole('textbox', { name: 'Email' }).isVisible().catch(() => false);
  return hasLogin && hasEmail;
}

test.describe('AI Chat Widget Smoke', () => {
  test('home renders either login or chat entrypoint', async ({ page }) => {
    await gotoHome(page);

    if (await isLoginPage(page)) {
      await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
      return;
    }

    await expect(page.locator('button[aria-label="Open chat"]')).toBeVisible();
  });
});
