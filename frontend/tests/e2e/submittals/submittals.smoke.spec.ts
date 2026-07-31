import { test, expect } from '@playwright/test';

const PROJECT_ID = process.env.E2E_PROJECT_ID ?? '67';

test.use({ storageState: 'tests/.auth/user.json' });

test.describe('Submittals smoke', () => {
  test.beforeAll(async () => {
    // Seed deterministic data; ensure env vars are set when running.
    // Example:
    // await execa('node', ['scripts/seed-submittals-smoke.js'], {
    //   env: {
    //     ...process.env,
    //     SUPABASE_URL: process.env.SUPABASE_URL,
    //     SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    //     SUBMITTALS_PROJECT_ID: process.env.SUBMITTALS_PROJECT_ID,
    //     SUBMITTALS_USER_ID: process.env.SUBMITTALS_USER_ID,
    //   },
    // });
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`/${PROJECT_ID}/submittals`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: 'Submittals' })).toBeVisible();
  });

  test('navigates tabs and respects Ball In Court filter', async ({ page }) => {
    await page.getByTestId('submittals-tab-items').click();
    await expect(page).toHaveURL(new RegExp(`/${PROJECT_ID}/submittals`));

    await page.getByTestId('submittals-tab-ball-in-court').click();
    await expect(page).toHaveURL(new RegExp(`tab=ball-in-court`));
  });

  test('create dropdown actions are present', async ({ page }) => {
    await page.getByTestId('submittals-dropdown-create').click();
    await expect(page.getByRole('menuitem', { name: 'Create Submittal' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Create from Package' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Create from Specifications' })).toBeVisible();
  });

  test('create from package opens picker dialog', async ({ page }) => {
    await page.getByTestId('submittals-dropdown-create').click();
    await page.getByRole('menuitem', { name: 'Create from Package' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Select a Package' })).toBeVisible();
  });

  test('settings gear navigates to submittal settings', async ({ page }) => {
    await page.getByRole('button', { name: 'Submittal settings' }).click();
    await expect(page).toHaveURL(new RegExp('tab=settings'));
    await expect(page.getByTestId('submittals-tab-settings')).toBeVisible();
  });
});
