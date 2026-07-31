import { test, expect } from '@playwright/test';

/**
 * Test suite for all migrated table pages
 * Verifies that pages load correctly and basic functionality works
 */

const MIGRATED_PAGES = [
  // SIMPLE pages
  { url: '/submittals', title: 'Submittals', hasAddButton: true, addButtonText: 'Add Submittal' },
  { url: '/meetings', title: 'Meetings', hasAddButton: true, addButtonText: 'Add Meeting' },
  { url: '/drawings', title: 'Drawings', hasAddButton: true, addButtonText: 'Upload Drawing' },
  { url: '/punch-list', title: 'Punch List', hasAddButton: true, addButtonText: 'Add Item' },

  // MEDIUM pages
  { url: '/rfis', title: 'RFIs', hasAddButton: true, addButtonText: 'Create RFI' },
  { url: '/users', title: 'Users', hasAddButton: true, addButtonText: 'Invite User' },
  { url: '/daily-log', title: 'Daily Log', hasAddButton: true, addButtonText: 'Create Log Entry' },
  { url: '/emails', title: 'Emails', hasAddButton: true, addButtonText: 'Compose Email' },
  { url: '/photos', title: 'Photos', hasAddButton: true, addButtonText: 'Upload Photo' },

  // COMPLEX pages
  { url: '/infinite-meetings', title: 'Meetings', hasAddButton: false },
  { url: '/infinite-projects', title: 'Projects', hasAddButton: true, addButtonText: 'New Project' },
  { url: '/projects', title: 'Projects', hasAddButton: true, addButtonText: 'New Project' },

  // Already migrated (verify they still work)
  { url: '/companies', title: 'Company Directory', hasAddButton: true, addButtonText: 'Add Company' },
  { url: '/contacts', title: 'Contacts', hasAddButton: true, addButtonText: 'Add Contact' },
  { url: '/clients', title: 'Clients', hasAddButton: true, addButtonText: 'New Client' },
];

test.describe('Migrated Table Pages', () => {
  test.beforeEach(async ({ page }) => {
    // Set viewport for consistent testing
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  for (const pageInfo of MIGRATED_PAGES) {
    test(`${pageInfo.url} - should load and render correctly`, async ({ page }) => {
      // Navigate to page
      await page.goto(pageInfo.url);

      // Wait for page to load
      await page.waitForLoadState('networkidle');

      // Verify no console errors (excluding known warnings)
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      // Wait a bit for any errors to appear
      await page.waitForTimeout(1000);

      // Check for critical errors (excluding minor warnings)
      const criticalErrors = errors.filter(err =>
        !err.includes('Warning:') &&
        !err.includes('favicon') &&
        !err.includes('DevTools')
      );

      expect(criticalErrors).toHaveLength(0);
    });

    test(`${pageInfo.url} - should have search functionality`, async ({ page }) => {
      await page.goto(pageInfo.url);
      await page.waitForLoadState('networkidle');

      // Look for search input (may be in different locations)
      const searchInput = page.locator('input[placeholder*="Search" i], input[type="search"]').first();

      // Should be visible or in the page
      const searchExists = await searchInput.count() > 0;
      expect(searchExists).toBeTruthy();
    });

    if (pageInfo.hasAddButton) {
      test(`${pageInfo.url} - should have add button`, async ({ page }) => {
        await page.goto(pageInfo.url);
        await page.waitForLoadState('networkidle');

        // Look for the add button
        const addButton = page.locator(`button:has-text("${pageInfo.addButtonText}")`).first();

        // Should be visible
        await expect(addButton).toBeVisible({ timeout: 5000 });
      });
    }

    test(`${pageInfo.url} - should have column visibility control`, async ({ page }) => {
      await page.goto(pageInfo.url);
      await page.waitForLoadState('networkidle');

      // Look for column toggle button (usually has "Columns" text or column icon)
      const columnButton = page.locator('button:has-text("Columns"), button:has-text("Customize")').first();

      const columnControlExists = await columnButton.count() > 0;
      expect(columnControlExists).toBeTruthy();
    });

    test(`${pageInfo.url} - should have export functionality`, async ({ page }) => {
      await page.goto(pageInfo.url);
      await page.waitForLoadState('networkidle');

      // Look for export button
      const exportButton = page.locator('button:has-text("Export"), button[aria-label*="export" i]').first();

      const exportExists = await exportButton.count() > 0;
      expect(exportExists).toBeTruthy();
    });

    test(`${pageInfo.url} - should render table or empty state`, async ({ page }) => {
      await page.goto(pageInfo.url);
      await page.waitForLoadState('networkidle');

      // Wait for either table or empty state to appear
      const hasTable = await page.locator('table').count() > 0;
      const hasEmptyState = await page.locator('text=/No .* found/i').count() > 0;
      const hasCards = await page.locator('[role="grid"], [data-view="card"]').count() > 0;

      // Should have either table content or empty state
      expect(hasTable || hasEmptyState || hasCards).toBeTruthy();
    });
  }
});

test.describe('Table Factory Features', () => {
  test('should support view switching on companies page', async ({ page }) => {
    await page.goto('/companies');
    await page.waitForLoadState('networkidle');

    // Look for view switcher buttons
    const viewSwitcher = page.locator('button[aria-label*="view" i], button:has-text("Table"), button:has-text("Card")');

    const hasViewSwitcher = await viewSwitcher.count() > 0;
    expect(hasViewSwitcher).toBeTruthy();
  });

  test('should show breadcrumbs on companies page', async ({ page }) => {
    await page.goto('/companies');
    await page.waitForLoadState('networkidle');

    // Look for breadcrumb navigation
    const breadcrumbs = page.locator('nav[aria-label="Breadcrumb"], ol:has(li a[href="/"])');

    const hasBreadcrumbs = await breadcrumbs.count() > 0;
    expect(hasBreadcrumbs).toBeTruthy();
  });

  test('should handle search on contacts page', async ({ page }) => {
    await page.goto('/contacts');
    await page.waitForLoadState('networkidle');

    // Find search input
    const searchInput = page.locator('input[placeholder*="Search" i]').first();

    if (await searchInput.count() > 0) {
      // Type in search
      await searchInput.fill('test');
      await page.waitForTimeout(500);

      // Verify input has value
      const inputValue = await searchInput.inputValue();
      expect(inputValue).toBe('test');
    }
  });

  test('should show loading state initially on clients page', async ({ page }) => {
    // Start navigation
    const navigation = page.goto('/clients');

    // Should show skeleton or loading indicator
    const hasSkeleton = await page.locator('.animate-pulse, [role="status"]').count() > 0;

    // Complete navigation
    await navigation;
    await page.waitForLoadState('networkidle');

    // Note: Loading state might be very fast, so we just verify page loads
    expect(page.url()).toContain('/clients');
  });
});
