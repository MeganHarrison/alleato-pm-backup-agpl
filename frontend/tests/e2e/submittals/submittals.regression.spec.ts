import { test, expect } from '@playwright/test';

const PROJECT_ID = process.env.E2E_PROJECT_ID ?? '67';

test.use({ storageState: 'tests/.auth/user.json' });

test.describe('Submittals page', () => {
  test('loads the submittals shell', async ({ page }) => {
    await page.goto(`/${PROJECT_ID}/submittals`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: 'Submittals' })).toBeVisible();
    await expect(page.getByRole('button', { name: /create/i })).toBeVisible();
    await expect(page.getByTestId('submittals-tab-items')).toBeVisible();
    await expect(page.getByTestId('submittals-tab-ball-in-court')).toBeVisible();
  });

  test('navigates to submittal detail from list when rows exist', async ({ page }) => {
    await page.goto(`/${PROJECT_ID}/submittals`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: 'Submittals' })).toBeVisible();

    const firstDataRow = page.locator('tbody tr').first();
    if ((await firstDataRow.count()) === 0) {
      test.skip(true, 'No submittal rows available in this environment');
    }

    await firstDataRow.click();
    await expect(page).toHaveURL(new RegExp(`/${PROJECT_ID}/submittals/`));
  });

  test('switches to Ball In Court tab', async ({ page }) => {
    await page.goto(`/${PROJECT_ID}/submittals`);
    await page.waitForLoadState('domcontentloaded');

    await page.getByTestId('submittals-tab-ball-in-court').click();
    await expect(page).toHaveURL(/tab=ball-in-court/);
  });

  test('submittal detail starts in view mode; Edit unlocks fields', async ({ page }) => {
    await page.goto(`/${PROJECT_ID}/submittals`);
    await page.waitForLoadState('domcontentloaded');

    const firstDataRow = page.locator('tbody tr').first();
    if ((await firstDataRow.count()) === 0) {
      test.skip(true, 'No submittal rows available in this environment');
    }

    await firstDataRow.click();
    await expect(page).toHaveURL(new RegExp(`/${PROJECT_ID}/submittals/`));

    const editToggle = page.getByRole('button', { name: 'Switch to edit mode' });
    await expect(editToggle).toBeVisible();

    // Fields render as plain text (no pencil affordance) until Edit is clicked.
    await expect(page.getByTitle('Click to edit')).toHaveCount(0);

    await editToggle.click();
    await expect(page.getByRole('button', { name: 'Switch to view mode' })).toBeVisible();
    await expect(page.getByTitle('Click to edit').first()).toBeVisible();
  });
});
