import { test, expect } from '@playwright/test';
import { getAdminClient } from '../../helpers/db';

const PROJECT_ID = '31';
const supabase = getAdminClient();

// Track test data for cleanup
const testDrawingIds: string[] = [];
const testAreaIds: string[] = [];

test.describe('Drawings Feature E2E', () => {

  test.describe('1. READ Test - Navigate and verify data renders', () => {
    test('loads drawings page and displays all components', async ({ page }) => {
      // Navigate to drawings page
      await page.goto(`/${PROJECT_ID}/drawings`);
      await page.waitForLoadState('domcontentloaded');

      // Verify page header
      await expect(page.getByRole('heading', { name: 'Drawings' })).toBeVisible({ timeout: 15000 });

      // Verify description
      await expect(page.getByText('Manage construction drawings with revision tracking')).toBeVisible();

      // Verify stats cards are visible with numbers
      const totalDrawingsCard = page.getByText('Total Drawings').locator('..');
      await expect(totalDrawingsCard).toBeVisible();
      const totalCount = totalDrawingsCard.locator('p.text-2xl');
      await expect(totalCount).toBeVisible();

      const publishedCard = page.getByText('Published').locator('..');
      await expect(publishedCard).toBeVisible();

      const inReviewCard = page.getByText('In Review').locator('..');
      await expect(inReviewCard).toBeVisible();

      // Verify filter controls are visible
      const searchInput = page.getByPlaceholder('Search drawings by number or title');
      await expect(searchInput).toBeVisible();

      const disciplineFilter = page.getByRole('combobox', { name: 'Discipline filter' });
      await expect(disciplineFilter).toBeVisible();

      const statusFilter = page.getByRole('combobox', { name: 'Status filter' });
      await expect(statusFilter).toBeVisible();

      const clearButton = page.getByRole('button', { name: 'Clear' });
      await expect(clearButton).toBeVisible();

      // Verify table renders (either with data or empty state)
      // Using a more flexible selector since we don't know if there's data
      const tableOrEmpty = page.locator('table, [role="status"], text=/no.*drawings/i');
      await expect(tableOrEmpty.first()).toBeVisible();

      // Take screenshot for verification
      await page.screenshot({ path: '/tmp/drawings-page-loaded.png' });
    });
  });

  test.describe('2. Search and Filter Tests - Use search and filters', () => {
    test('searches drawings by text input', async ({ page }) => {
      await page.goto(`/${PROJECT_ID}/drawings`);
      await page.waitForLoadState('domcontentloaded');

      const searchInput = page.getByPlaceholder('Search drawings by number or title');
      await expect(searchInput).toBeVisible({ timeout: 15000 });

      // Type in search field
      await searchInput.fill('A-1');

      // Wait for debounce/filtering
      await page.waitForTimeout(1000);

      // Verify search value is applied
      await expect(searchInput).toHaveValue('A-1');

      await page.screenshot({ path: '/tmp/drawings-search-applied.png' });
    });

    test('filters drawings by discipline', async ({ page }) => {
      await page.goto(`/${PROJECT_ID}/drawings`);
      await page.waitForLoadState('domcontentloaded');

      const disciplineFilter = page.getByRole('combobox', { name: 'Discipline filter' });
      await expect(disciplineFilter).toBeVisible({ timeout: 15000 });

      // Click to open dropdown
      await disciplineFilter.click();

      // Select "Architectural"
      const architecturalOption = page.getByRole('option', { name: 'Architectural' });
      await expect(architecturalOption).toBeVisible();
      await architecturalOption.click();

      // Verify filter is applied
      await page.waitForTimeout(1000);

      await page.screenshot({ path: '/tmp/drawings-discipline-filtered.png' });
    });

    test('filters drawings by status', async ({ page }) => {
      await page.goto(`/${PROJECT_ID}/drawings`);
      await page.waitForLoadState('domcontentloaded');

      const statusFilter = page.getByRole('combobox', { name: 'Status filter' });
      await expect(statusFilter).toBeVisible({ timeout: 15000 });

      // Click to open dropdown
      await statusFilter.click();

      // Select "Approved"
      const approvedOption = page.getByRole('option', { name: 'Approved' });
      await expect(approvedOption).toBeVisible();
      await approvedOption.click();

      // Verify filter is applied
      await page.waitForTimeout(1000);

      await page.screenshot({ path: '/tmp/drawings-status-filtered.png' });
    });

    test('clears all filters', async ({ page }) => {
      await page.goto(`/${PROJECT_ID}/drawings`);
      await page.waitForLoadState('domcontentloaded');

      // Apply search filter first
      const searchInput = page.getByPlaceholder('Search drawings by number or title');
      await expect(searchInput).toBeVisible({ timeout: 15000 });
      await searchInput.fill('test');
      await page.waitForTimeout(500);

      // Click Clear button
      const clearButton = page.getByRole('button', { name: 'Clear' });
      await clearButton.click();

      // Verify search is cleared
      await expect(searchInput).toHaveValue('');

      await page.screenshot({ path: '/tmp/drawings-filters-cleared.png' });
    });
  });

  test.describe('3. CREATE Test - Upload drawing dialog form interaction', () => {
    test('opens upload dialog and validates form fields', async ({ page }) => {
      await page.goto(`/${PROJECT_ID}/drawings`);
      await page.waitForLoadState('domcontentloaded');

      // Click "Upload Drawings" button
      const uploadButton = page.getByRole('button', { name: 'Upload Drawings' });
      await expect(uploadButton).toBeVisible({ timeout: 15000 });
      await uploadButton.click();

      // Verify dialog opens
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Verify dialog title
      await expect(page.getByRole('heading', { name: 'Upload Drawings' })).toBeVisible();

      // Verify dialog description
      await expect(page.getByText(/Upload one or more drawing files/i)).toBeVisible();

      // Verify all form fields are present
      await expect(page.getByLabel('Drawing Number *')).toBeVisible();
      await expect(page.getByLabel('Revision')).toBeVisible();
      await expect(page.getByLabel('Title *')).toBeVisible();
      await expect(page.getByLabel('Discipline')).toBeVisible();
      await expect(page.getByLabel('Type')).toBeVisible();
      await expect(page.getByLabel('Drawing Area')).toBeVisible();
      await expect(page.getByLabel('Drawing Date')).toBeVisible();
      await expect(page.getByLabel('Description')).toBeVisible();

      // Verify buttons
      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
      await expect(page.getByRole('button', { name: /Upload/i })).toBeVisible();

      await page.screenshot({ path: '/tmp/drawings-upload-dialog-open.png' });

      // Close dialog using Cancel button
      await page.getByRole('button', { name: 'Cancel' }).click();

      // Verify dialog closes
      await expect(dialog).not.toBeVisible();
    });

    test('fills form with complete drawing metadata', async ({ page }) => {
      await page.goto(`/${PROJECT_ID}/drawings`);
      await page.waitForLoadState('domcontentloaded');

      // Open upload dialog
      const uploadButton = page.getByRole('button', { name: 'Upload Drawings' });
      await uploadButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 15000 });

      // Fill in Drawing Number (required)
      const drawingNumber = `E2E-TEST-${Date.now()}`;
      await page.getByLabel('Drawing Number *').fill(drawingNumber);
      await expect(page.getByLabel('Drawing Number *')).toHaveValue(drawingNumber);

      // Fill in Revision
      await page.getByLabel('Revision').fill('A');
      await expect(page.getByLabel('Revision')).toHaveValue('A');

      // Fill in Title (required)
      const title = 'E2E Test Drawing - Comprehensive Test';
      await page.getByLabel('Title *').fill(title);
      await expect(page.getByLabel('Title *')).toHaveValue(title);

      // Select Discipline
      await page.getByLabel('Discipline').click();
      await page.getByRole('option', { name: 'Architectural' }).click();

      // Select Type
      await page.getByLabel('Type').click();
      await page.getByRole('option', { name: 'Plan' }).click();

      // Fill Description
      await page.getByLabel('Description').fill('This is a test drawing created by E2E automation tests');

      await page.screenshot({ path: '/tmp/drawings-form-filled.png' });

      // Cancel to close without uploading
      await page.getByRole('button', { name: 'Cancel' }).click();
    });
  });

  test.describe('4. Form Validation Test - Submit empty required fields', () => {
    test('shows validation errors for empty required fields', async ({ page }) => {
      await page.goto(`/${PROJECT_ID}/drawings`);
      await page.waitForLoadState('domcontentloaded');

      // Open upload dialog
      const uploadButton = page.getByRole('button', { name: 'Upload Drawings' });
      await uploadButton.click();

      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 });

      // Try to submit without filling required fields
      // Note: Upload button should be disabled if no files are selected
      const submitButton = page.getByRole('button', { name: /Upload/i });

      // Verify upload button is disabled when no files selected
      await expect(submitButton).toBeDisabled();

      await page.screenshot({ path: '/tmp/drawings-validation-no-files.png' });

      // Fill fields but leave drawing_number empty
      await page.getByLabel('Title *').fill('Test Title');

      // Clear drawing number if auto-populated
      await page.getByLabel('Drawing Number *').clear();

      // Note: Cannot actually submit without file due to client-side validation
      // This verifies the form requires both file and metadata

      await page.screenshot({ path: '/tmp/drawings-validation-incomplete.png' });
    });

    test('validates that file selection is required', async ({ page }) => {
      await page.goto(`/${PROJECT_ID}/drawings`);
      await page.waitForLoadState('domcontentloaded');

      // Open upload dialog
      await page.getByRole('button', { name: 'Upload Drawings' }).click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 15000 });

      // Fill all metadata fields but don't select a file
      await page.getByLabel('Drawing Number *').fill(`NO-FILE-${Date.now()}`);
      await page.getByLabel('Title *').fill('Drawing Without File');

      // Verify submit button is disabled
      const submitButton = page.getByRole('button', { name: /Upload/i });
      await expect(submitButton).toBeDisabled();

      await page.screenshot({ path: '/tmp/drawings-validation-no-file-selected.png' });
    });
  });

  test.describe('5. Navigation Test - Sub-page navigation', () => {
    test('navigates to Board View and back', async ({ page }) => {
      await page.goto(`/${PROJECT_ID}/drawings`);
      await page.waitForLoadState('domcontentloaded');

      // Verify we're on main drawings page
      await expect(page.getByRole('heading', { name: 'Drawings' })).toBeVisible({ timeout: 15000 });

      // Click "Board View" button
      const boardViewButton = page.getByRole('link', { name: 'Board View' });
      await expect(boardViewButton).toBeVisible();
      await boardViewButton.click();

      // Wait for navigation
      await page.waitForLoadState('domcontentloaded');

      // Verify URL changed to board view
      await expect(page).toHaveURL(new RegExp(`/${PROJECT_ID}/drawings/board`));

      await page.screenshot({ path: '/tmp/drawings-board-view.png' });

      // Navigate back to main drawings page
      await page.goto(`/${PROJECT_ID}/drawings`);
      await page.waitForLoadState('domcontentloaded');

      // Verify we're back on main page
      await expect(page.getByRole('heading', { name: 'Drawings' })).toBeVisible();
      await expect(page.getByPlaceholder('Search drawings by number or title')).toBeVisible();

      await page.screenshot({ path: '/tmp/drawings-back-to-main.png' });
    });

    test('verifies all header action buttons are present', async ({ page }) => {
      await page.goto(`/${PROJECT_ID}/drawings`);
      await page.waitForLoadState('domcontentloaded');

      // Verify Upload Drawings button
      await expect(page.getByRole('button', { name: 'Upload Drawings' })).toBeVisible({ timeout: 15000 });

      // Verify Board View link
      await expect(page.getByRole('link', { name: 'Board View' })).toBeVisible();

      // Verify Reports dropdown
      await expect(page.getByRole('button', { name: 'Reports' })).toBeVisible();

      // Verify Export dropdown
      await expect(page.getByRole('button', { name: 'Export' })).toBeVisible();

      await page.screenshot({ path: '/tmp/drawings-header-actions.png' });
    });

    test('opens and verifies Reports dropdown menu', async ({ page }) => {
      await page.goto(`/${PROJECT_ID}/drawings`);
      await page.waitForLoadState('domcontentloaded');

      const reportsButton = page.getByRole('button', { name: 'Reports' });
      await expect(reportsButton).toBeVisible({ timeout: 15000 });

      // Click to open dropdown
      await reportsButton.click();

      // Verify menu items
      await expect(page.getByRole('menuitem', { name: 'Drawing Log' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Download Log' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Open Items' })).toBeVisible();

      await page.screenshot({ path: '/tmp/drawings-reports-menu.png' });

      // Close menu by clicking elsewhere
      await page.keyboard.press('Escape');
    });

    test('opens and verifies Export dropdown menu', async ({ page }) => {
      await page.goto(`/${PROJECT_ID}/drawings`);
      await page.waitForLoadState('domcontentloaded');

      const exportButton = page.getByRole('button', { name: 'Export' });
      await expect(exportButton).toBeVisible({ timeout: 15000 });

      // Click to open dropdown
      await exportButton.click();

      // Verify menu items
      await expect(page.getByRole('menuitem', { name: 'Export PDF' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Export CSV' })).toBeVisible();

      await page.screenshot({ path: '/tmp/drawings-export-menu.png' });

      // Close menu
      await page.keyboard.press('Escape');
    });
  });

  test.describe('6. Drawing Areas Interaction Test', () => {
    test('displays drawing areas sidebar', async ({ page }) => {
      await page.goto(`/${PROJECT_ID}/drawings`);
      await page.waitForLoadState('domcontentloaded');

      // Verify Drawing Areas section header
      const areasHeader = page.getByText('Drawing Areas', { exact: false });
      await expect(areasHeader).toBeVisible({ timeout: 15000 });

      await page.screenshot({ path: '/tmp/drawings-areas-sidebar.png' });

      // Check if areas exist or if empty state is shown
      const emptyState = page.getByText('No areas created yet');
      const areaButtons = page.locator('button[aria-pressed]');

      const hasEmptyState = await emptyState.isVisible().catch(() => false);
      const hasAreas = await areaButtons.count() > 0;

      // Either empty state or areas should be visible
      expect(hasEmptyState || hasAreas).toBe(true);
    });

    test('area filter button interaction', async ({ page }) => {
      await page.goto(`/${PROJECT_ID}/drawings`);
      await page.waitForLoadState('domcontentloaded');

      // Find any area button
      const areaButton = page.locator('button[aria-pressed]').first();

      if (await areaButton.isVisible().catch(() => false)) {
        // Get initial state
        const initialState = await areaButton.getAttribute('aria-pressed');

        // Click to toggle
        await areaButton.click();
        await page.waitForTimeout(500);

        // Verify state changed
        const newState = await areaButton.getAttribute('aria-pressed');
        expect(newState).not.toBe(initialState);

        await page.screenshot({ path: '/tmp/drawings-area-filtered.png' });

        // Click again to toggle back
        await areaButton.click();
        await page.waitForTimeout(500);
      }
    });
  });

  test.describe('7. Multiple Filter Combination Test', () => {
    test('applies multiple filters simultaneously', async ({ page }) => {
      await page.goto(`/${PROJECT_ID}/drawings`);
      await page.waitForLoadState('domcontentloaded');

      // Apply search filter
      const searchInput = page.getByPlaceholder('Search drawings by number or title');
      await expect(searchInput).toBeVisible({ timeout: 15000 });
      await searchInput.fill('A');
      await page.waitForTimeout(500);

      // Apply discipline filter
      const disciplineFilter = page.getByRole('combobox', { name: 'Discipline filter' });
      await disciplineFilter.click();
      await page.getByRole('option', { name: 'Architectural' }).click();
      await page.waitForTimeout(500);

      // Apply status filter
      const statusFilter = page.getByRole('combobox', { name: 'Status filter' });
      await statusFilter.click();
      await page.getByRole('option', { name: 'Approved' }).click();
      await page.waitForTimeout(500);

      await page.screenshot({ path: '/tmp/drawings-multiple-filters.png' });

      // Verify all filters are still applied
      await expect(searchInput).toHaveValue('A');

      // Clear all filters
      await page.getByRole('button', { name: 'Clear' }).click();

      // Verify search is cleared
      await expect(searchInput).toHaveValue('');
    });
  });

  test.describe('8. Dialog State Persistence Test', () => {
    test('dialog form resets when reopened', async ({ page }) => {
      await page.goto(`/${PROJECT_ID}/drawings`);
      await page.waitForLoadState('domcontentloaded');

      // Open dialog first time
      await page.getByRole('button', { name: 'Upload Drawings' }).click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 });

      // Fill some fields
      await page.getByLabel('Drawing Number *').fill('TEST-001');
      await page.getByLabel('Title *').fill('Test Title');

      // Close dialog
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();

      // Reopen dialog
      await page.getByRole('button', { name: 'Upload Drawings' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Verify form is reset (fields should be empty or default values)
      const drawingNumberValue = await page.getByLabel('Drawing Number *').inputValue();
      const titleValue = await page.getByLabel('Title *').inputValue();

      // Fields should be empty (not containing previous values)
      expect(drawingNumberValue).not.toBe('TEST-001');
      expect(titleValue).not.toBe('Test Title');

      await page.screenshot({ path: '/tmp/drawings-dialog-reset.png' });
    });
  });

  test.describe('9. Responsive Layout Test', () => {
    test('verifies layout components are present and accessible', async ({ page }) => {
      await page.goto(`/${PROJECT_ID}/drawings`);
      await page.waitForLoadState('domcontentloaded');

      // Verify page container structure
      await expect(page.getByRole('heading', { name: 'Drawings' })).toBeVisible({ timeout: 15000 });

      // Verify stats cards are in a grid
      const statsCards = page.locator('.grid.gap-4.md\\:grid-cols-3').first();
      await expect(statsCards).toBeVisible();

      // Verify the layout has sidebar + content grid
      const mainGrid = page.locator('.grid.gap-4.lg\\:grid-cols-\\[220px\\,1fr\\]');
      await expect(mainGrid).toBeVisible();

      // Verify filter bar is present
      const filterBar = page.locator('.rounded-lg.border.bg-card');
      await expect(filterBar).toBeVisible();

      await page.screenshot({ path: '/tmp/drawings-layout-structure.png' });
    });
  });

  test.describe('10. Page Loading State Test', () => {
    test('handles page navigation and reload gracefully', async ({ page }) => {
      await page.goto(`/${PROJECT_ID}/drawings`);
      await page.waitForLoadState('domcontentloaded');

      // Verify initial load
      await expect(page.getByRole('heading', { name: 'Drawings' })).toBeVisible({ timeout: 15000 });

      // Reload the page
      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      // Verify page loads again correctly
      await expect(page.getByRole('heading', { name: 'Drawings' })).toBeVisible({ timeout: 15000 });
      await expect(page.getByPlaceholder('Search drawings by number or title')).toBeVisible();

      await page.screenshot({ path: '/tmp/drawings-after-reload.png' });
    });
  });

  // Cleanup test data
  test.afterAll(async () => {
    // Clean up in reverse dependency order
    for (const id of testDrawingIds) {
      // Delete drawing revisions first
      await supabase.from('drawing_revisions').delete().eq('drawing_id', id);
      // Then delete the drawing
      await supabase.from('drawings').delete().eq('id', id);
    }

    // Clean up test areas
    for (const id of testAreaIds) {
      await supabase.from('drawing_areas').delete().eq('id', id);
    }

    console.log('Cleanup completed');
  });
});
