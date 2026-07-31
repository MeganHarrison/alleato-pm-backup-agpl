import { test, expect } from '@playwright/test';
import {
  addProjectMember,
  createChangeOrder,
  createProject,
  deleteChangeOrdersByProject,
  getUserIdByEmail,
} from '../../helpers/db';
import { cleanupProjectArtifacts } from '../../helpers/cleanup';

const testUserEmail = process.env.PLAYWRIGHT_TEST_USER_EMAIL ?? 'test1@mail.com';

let projectId: number;

const makeNumber = (suffix: string) => `CO-SMOKE-${Date.now()}-${suffix}`;

test.describe.serial('Change Orders Smoke', () => {
  test.beforeAll(async () => {
    const userId = await getUserIdByEmail(testUserEmail);
    projectId = await createProject(`E2E Change Orders Smoke ${Date.now()}`);
    await addProjectMember(projectId, userId, 'admin');
  });

  test.afterAll(async () => {
    if (projectId) {
      await cleanupProjectArtifacts(projectId);
    }
  });

  test('list page loads and shows empty state', async ({ page }) => {
    await deleteChangeOrdersByProject(projectId);
    await page.goto(`/${projectId}/change-orders`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('No change orders found.', { exact: true })).toBeVisible();
  });

  test('create form validates required fields', async ({ page }) => {
    await page.goto(`/${projectId}/change-orders/new`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('change-order-submit').click();

    await expect(page.getByText('Change order number is required', { exact: true })).toBeVisible();
    await expect(page.getByText('Title is required', { exact: true })).toBeVisible();
  });

  test('row appears in list after DB seed', async ({ page }) => {
    await deleteChangeOrdersByProject(projectId);
    const record = await createChangeOrder({
      project_id: projectId,
      co_number: makeNumber('LIST'),
      title: 'Smoke List Record',
      description: 'Smoke list rendering',
      status: 'draft',
    });

    await page.goto(`/${projectId}/change-orders`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(record.co_number)).toBeVisible();
    await expect(page.getByText('Smoke List Record')).toBeVisible();
  });

  test('create flow persists via UI', async ({ page }) => {
    await deleteChangeOrdersByProject(projectId);

    const number = makeNumber('CREATE');
    await page.goto(`/${projectId}/change-orders/new`, { waitUntil: 'domcontentloaded' });

    await page.getByTestId('change-order-number').fill(number);
    await page.getByTestId('change-order-title').fill('Smoke Create Record');
    await page.getByTestId('change-order-description').fill('Created by smoke suite');

    await page.getByTestId('change-order-status').click();
    await page.getByRole('option', { name: 'Draft' }).click();
    await page.getByTestId('change-order-submit').click();

    await expect(page.getByTestId('created-change-order-id')).toBeVisible();
  });
});
