/**
 * Regression tests for the prime contract create flow.
 *
 * Covers: form renders at correct URL, minimal submit succeeds, cancel navigates
 * back, and the API returns 400 on missing required fields.
 *
 * More complex branches (SOV partial failure, "failed to fetch" recovery) are
 * tested via the API spec + unit tests — they require network interception that
 * would make these tests brittle.
 */
import { test, expect } from '@playwright/test';

const PROJECT_ID = '67';
const BASE_URL = `/${PROJECT_ID}/prime-contracts`;
const NEW_URL = `${BASE_URL}/new`;

test.describe('Prime contract create — route & form', () => {
  test('renders the create form at the correct URL', async ({ page }) => {
    await page.goto(NEW_URL);
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(new RegExp(NEW_URL));
    await expect(page.getByText('Create Prime Contract')).toBeVisible();
    await expect(page.getByText('General Information')).toBeVisible();
    await expect(page.getByText('Schedule of Values')).toBeVisible();
    await expect(page.getByRole('button', { name: /Cancel/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Create Prime Contract/i })).toBeVisible();
  });

  test('Cancel returns to the prime contracts list', async ({ page }) => {
    await page.goto(NEW_URL);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Cancel/i }).click();
    await page.waitForURL(`**${BASE_URL}`, { timeout: 5000 });
    await expect(page).toHaveURL(new RegExp(BASE_URL + '$'));
  });

  test('Back link returns to the prime contracts list', async ({ page }) => {
    await page.goto(NEW_URL);
    await page.waitForLoadState('networkidle');

    await page.getByText('Back to Prime Contracts').click();
    await page.waitForURL(`**${BASE_URL}`, { timeout: 5000 });
    await expect(page).toHaveURL(new RegExp(BASE_URL + '$'));
  });

  test('submitting empty form shows validation — required fields enforced client-side', async ({ page }) => {
    await page.goto(NEW_URL);
    await page.waitForLoadState('networkidle');

    // Click submit without filling anything — should NOT call the API
    const apiCalled = { value: false };
    page.on('request', (req) => {
      if (req.url().includes('/api/projects') && req.method() === 'POST') {
        apiCalled.value = true;
      }
    });

    await page.getByRole('button', { name: /Create Prime Contract/i }).click();

    // Give a tick for any async validation
    await page.waitForTimeout(300);
    expect(apiCalled.value).toBe(false);
  });
});

test.describe('Prime contract create — full submission flow', () => {
  const createdIds: string[] = [];

  test.afterAll(async ({ request }) => {
    // Best-effort cleanup of any contracts created during this suite
    await Promise.allSettled(
      createdIds.map((id) =>
        request.delete(`/api/projects/${PROJECT_ID}/contracts/${id}`),
      ),
    );
  });

  test('creates a contract with number + title and redirects to detail page', async ({ page }) => {
    const contractNumber = `PC-REG-${Date.now()}`;
    const title = `Regression Test ${Date.now()}`;

    await page.goto(NEW_URL);
    await page.waitForLoadState('networkidle');

    await page.getByLabel('Contract #').fill(contractNumber);
    await page.getByLabel('Contract Title').fill(title);

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/projects/${PROJECT_ID}/contracts`) &&
          res.request().method() === 'POST',
      ),
      page.getByRole('button', { name: /Create Prime Contract/i }).click(),
    ]);

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.id).toBeTruthy();
    createdIds.push(body.id);

    // Redirected to the detail page
    await page.waitForURL(
      `**/${PROJECT_ID}/prime-contracts/${body.id}**`,
      { timeout: 10_000 },
    );
    await expect(page).toHaveURL(
      new RegExp(`/${PROJECT_ID}/prime-contracts/${body.id}`),
    );

    // Success toast visible
    await expect(page.getByText('Prime contract created')).toBeVisible({ timeout: 5000 });
  });

  test('API returns 400 when contract_number is missing', async ({ request }) => {
    const response = await request.post(
      `/api/projects/${PROJECT_ID}/contracts`,
      {
        data: { title: 'Missing Number Contract' },
        headers: { 'Content-Type': 'application/json' },
      },
    );

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBeTruthy();
  });

  /**
   * REGRESSION: budget code modal showed division name instead of code number.
   *
   * Root cause: cost_codes.id is a human-readable code number (e.g. "03-010"),
   * NOT a UUID. The render used `division_title || id` which showed the division
   * name. Fix: use `id` directly.
   *
   * Would have been caught by this test failing on the text content assertion.
   */
  test('budget code modal shows code number (e.g. 03-010), not division name, when a division is expanded', async ({ page }) => {
    await page.goto(NEW_URL);
    await page.waitForLoadState('networkidle');

    // Add a SOV line item to get the budget code selector
    await page.getByRole('button', { name: /Add Line Item/i }).click();

    // Open the budget code selector popover
    await page.getByRole('combobox', { name: /Select budget code/i }).first().click();

    // Click "Create New Budget Code"
    await page.getByText('Create New Budget Code').click();

    // Wait for the modal with cost codes to load
    await page.waitForSelector('[role="dialog"]');
    await page.waitForTimeout(1000); // let cost codes load

    // Expand the first division
    const firstDivisionButton = page.locator('[role="dialog"] button').filter({ hasText: /\d/ }).first();
    await firstDivisionButton.click();

    // The expanded items must show code numbers like "03-010 - Some Title"
    // NOT division names like "03 - Concrete Work - Some Title"
    const expandedItem = page.locator('[role="dialog"] .bg-muted button').first();
    const itemText = await expandedItem.textContent();

    // Code format: starts with digits, has a dash, has a dot-separated segment (e.g. "03-010")
    // Division name format: "03 - Concrete Work" (no dot-separated code segment before the dash)
    expect(itemText).toMatch(/^\s*\d{2}-\d{3,}/);
  });

  test('API returns 400 on duplicate contract_number within same project', async ({ request }) => {
    const contractNumber = `PC-DUP-${Date.now()}`;

    const first = await request.post(
      `/api/projects/${PROJECT_ID}/contracts`,
      {
        data: { contract_number: contractNumber, title: 'First' },
        headers: { 'Content-Type': 'application/json' },
      },
    );
    expect(first.ok()).toBeTruthy();
    createdIds.push((await first.json()).id);

    const second = await request.post(
      `/api/projects/${PROJECT_ID}/contracts`,
      {
        data: { contract_number: contractNumber, title: 'Duplicate' },
        headers: { 'Content-Type': 'application/json' },
      },
    );
    expect(second.status()).toBe(400);
  });
});
