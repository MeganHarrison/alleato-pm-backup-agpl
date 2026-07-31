import { test, expect } from '@playwright/test';
test.use({ storageState: 'tests/.auth/user.json' });
test('verify bulk delete', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('feedback-toolbar-settings', JSON.stringify({ blockInteractions: false, reactEnabled: false, webhooksEnabled: false }));
  });
  await page.goto('http://localhost:3000/67/prime-contracts');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '/tmp/verify-bulk-delete-list.png' });
  await expect(page.getByText('Gauntlet Bulk Test Contract A')).not.toBeVisible();
  await expect(page.getByText('Gauntlet Bulk Test Contract B')).not.toBeVisible();
});
