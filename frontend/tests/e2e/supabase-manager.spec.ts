import { test, expect } from '@playwright/test';

test.describe('Supabase Manager prototype', () => {
  test('renders auth and database experiences', async ({ page }) => {
    await page.goto('http://localhost:3000/supabase-manager.disabled');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Supabase Manager' })).toBeVisible();
    await expect(page.getByText('This route remains disabled in production routing')).toBeVisible();

    const authTab = page.getByRole('tab', { name: 'Authentication' });
    const dbTab = page.getByRole('tab', { name: 'Database' });

    await expect(authTab).toBeVisible();
    await expect(dbTab).toBeVisible();
    await expect(authTab).toHaveAttribute('data-state', 'active');

    await expect(page.getByRole('heading', { name: 'Authentication providers' })).toBeVisible();
    await expect(page.getByText('Magic Link')).toBeVisible();
    await page.getByRole('button', { name: 'Configure' }).first().click();
    await expect(page.getByRole('heading', { name: 'Configure Magic Link' })).toBeVisible();
    await page.getByRole('button', { name: 'Save provider' }).click();

    await dbTab.click();
    await expect(page.getByRole('heading', { name: 'Tables & storage' })).toBeVisible();
    await expect(page.getByText('project_rfis')).toBeVisible();

    await page.getByRole('button', { name: 'View structure' }).first().click();
    await expect(page.getByRole('heading', { name: 'projects' })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();

    await page.screenshot({
      path: 'frontend/tests/screenshots/supabase-manager-prototype.png',
      fullPage: false,
    });
  });
});
