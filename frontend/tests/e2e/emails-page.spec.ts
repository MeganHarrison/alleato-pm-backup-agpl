import { test, expect } from '@playwright/test';

test.describe('Emails Page', () => {
  test.use({ storageState: 'tests/.auth/user.json' });

  test('should render emails page with generic table', async ({ page }) => {
    await page.goto('/emails');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Verify page heading
    await expect(page.getByRole('heading', { name: 'Emails', level: 1 })).toBeVisible();

    // Verify description
    await expect(page.getByText('Project correspondence')).toBeVisible();

    // Verify Compose Email button
    await expect(page.getByRole('button', { name: 'Compose Email' })).toBeVisible();

    // Verify summary cards
    await expect(page.getByText('Total Emails')).toBeVisible();
    await expect(page.getByText('Unread')).toBeVisible();
    await expect(page.getByText('With Attachments')).toBeVisible();
    await expect(page.getByText('Today')).toBeVisible();

    // Verify table is rendered
    await expect(page.getByRole('table')).toBeVisible();

    // Verify table has columns
    await expect(page.getByRole('columnheader', { name: 'Subject' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'From' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'To' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Category' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Attachments' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Date' })).toBeVisible();

    // Verify mock data is rendered (should have at least one row)
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(5); // We have 5 mock emails
  });

  test('should filter emails using search', async ({ page }) => {
    await page.goto('/emails');
    await page.waitForLoadState('networkidle');

    // Find and use search input
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('RFI');

    // Should filter to show only RFI-related email
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(page.getByText('RFI-001 Response')).toBeVisible();
  });

  test('should display badges for categories', async ({ page }) => {
    await page.goto('/emails');
    await page.waitForLoadState('networkidle');

    // Verify category badges are rendered
    await expect(page.getByText('general')).toBeVisible();
    await expect(page.getByText('rfi')).toBeVisible();
    await expect(page.getByText('meeting')).toBeVisible();
    await expect(page.getByText('submittal')).toBeVisible();
    await expect(page.getByText('change_order')).toBeVisible();
  });

  test('should have delete functionality', async ({ page }) => {
    await page.goto('/emails');
    await page.waitForLoadState('networkidle');

    // Find the three-dot menu button (first row)
    const firstRowActions = page.locator('tbody tr').first().getByRole('button', { name: /more/i });
    await firstRowActions.click();

    // Verify delete option is present
    await expect(page.getByRole('menuitem', { name: /delete/i })).toBeVisible();
  });

  test('should show view switcher', async ({ page }) => {
    await page.goto('/emails');
    await page.waitForLoadState('networkidle');

    // Verify view mode switcher is present (table/card/list)
    const viewSwitcher = page.getByRole('tablist');
    await expect(viewSwitcher).toBeVisible();
  });
});
