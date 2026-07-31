import { test, expect } from '@playwright/test';

const PROJECT_ID = 67;

test.describe('Prime contract creation smoke', () => {
  test('creates a prime contract via the UI and verifies it appears in the list', async ({ page }) => {
    const contractNumber = `PC-SMOKE-${Date.now()}`;
    const title = `Smoke Test Contract ${new Date().toISOString()}`;

    await page.goto(`/${PROJECT_ID}/prime-contracts/new`);
    await page.waitForLoadState('networkidle');

    // Fill required fields
    await page.getByLabel('Contract #').fill(contractNumber);
    await page.getByLabel('Contract Title').fill(title);

    // Intercept the POST so we can grab the created ID for cleanup
    const [contractResponse] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/projects/${PROJECT_ID}/contracts`) &&
          res.request().method() === 'POST',
      ),
      page.getByRole('button', { name: /Create Prime Contract/i }).click(),
    ]);

    expect(contractResponse.ok()).toBeTruthy();
    const created = await contractResponse.json();
    const contractId = created.id;

    // Verify redirect to detail page
    await page.waitForURL(`**/${PROJECT_ID}/prime-contracts/${contractId}**`, { timeout: 10_000 });
    await expect(page).toHaveURL(new RegExp(`/${PROJECT_ID}/prime-contracts/${contractId}`));

    // Verify success toast
    await expect(page.getByText('Prime contract created')).toBeVisible({ timeout: 5000 });

    // Verify contract appears in the list
    await page.goto(`/${PROJECT_ID}/prime-contracts`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('table')).toContainText(contractNumber);

    // Cleanup — delete via API so the test is idempotent
    await page.request.delete(
      `/api/projects/${PROJECT_ID}/contracts/${contractId}`,
    );
  });
});
