import { test, expect } from '@playwright/test';

test.describe('Directory Users Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to users directory page
    await page.goto('/directory/users');

    // Wait for page to load
    await page.waitForSelector('[data-testid="page-container"]', { timeout: 10000 }).catch(() => null);
  });

  test('should display users list page with header and stats', async ({ page }) => {
    // Check page title
    await expect(page.locator('h1')).toContainText('Directory');

    // Check stats cards are visible
    const statsCards = page.locator('[data-testid="stat-card"]');
    await expect(statsCards).toHaveCount(4);

    // Check for Total Users, Active, Pending Invites, Permission Templates stats
    await expect(page.getByText('Total Users')).toBeVisible();
    await expect(page.getByText('Active')).toBeVisible();
    await expect(page.getByText('Pending Invites')).toBeVisible();
    await expect(page.getByText('Permission Templates')).toBeVisible();
  });

  test('should display Add User and Bulk Add buttons', async ({ page }) => {
    // Check for Add User button
    const addUserButton = page.getByRole('button', { name: /add user/i });
    await expect(addUserButton).toBeVisible();

    // Check for Bulk Add button
    const bulkAddButton = page.getByRole('button', { name: /bulk add/i });
    await expect(bulkAddButton).toBeVisible();
  });

  test('should open Add User dialog when clicking Add User button', async ({ page }) => {
    // Click Add User button
    await page.getByRole('button', { name: /add user/i }).click();

    // Check dialog is visible
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Add New User')).toBeVisible();

    // Check form fields are present
    await expect(page.getByLabel(/first name/i)).toBeVisible();
    await expect(page.getByLabel(/last name/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/permission template/i)).toBeVisible();

    // Close dialog
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('should validate required fields in Add User form', async ({ page }) => {
    // Open Add User dialog
    await page.getByRole('button', { name: /add user/i }).click();

    // Try to submit without filling required fields
    await page.getByRole('button', { name: /add user/i }).last().click();

    // Check for validation errors
    await expect(page.getByText(/first name is required/i)).toBeVisible();
    await expect(page.getByText(/last name is required/i)).toBeVisible();
    await expect(page.getByText(/permission template is required/i)).toBeVisible();
  });

  test('should add a new user successfully', async ({ page }) => {
    // Open Add User dialog
    await page.getByRole('button', { name: /add user/i }).click();

    // Fill in form
    await page.getByLabel(/first name/i).fill('Test');
    await page.getByLabel(/last name/i).fill('User');
    await page.getByLabel(/email/i).fill(`test.user.${Date.now()}@example.com`);
    await page.getByLabel(/phone/i).first().fill('555-1234');
    await page.getByLabel(/job title/i).fill('Project Manager');

    // Select permission template (first available)
    await page.getByLabel(/permission template/i).click();
    await page.getByRole('option').first().click();

    // Submit form
    await page.getByRole('button', { name: /add user/i }).last().click();

    // Wait for success toast
    await expect(page.getByText(/user added successfully/i)).toBeVisible({ timeout: 5000 });

    // Verify dialog closed
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Verify user appears in table
    await expect(page.getByText('Test User')).toBeVisible();
  });

  test('should open Bulk Add dialog when clicking Bulk Add button', async ({ page }) => {
    // Click Bulk Add button
    await page.getByRole('button', { name: /bulk add/i }).click();

    // Check dialog is visible
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Bulk Add Users')).toBeVisible();

    // Check for CSV upload area
    await expect(page.getByText(/upload csv file/i)).toBeVisible();

    // Check for Add User button in bulk dialog
    await expect(page.getByRole('button', { name: /add user/i })).toBeVisible();

    // Close dialog
    await page.getByRole('button', { name: /cancel/i }).click();
  });

  test('should add multiple users manually in Bulk Add dialog', async ({ page }) => {
    // Open Bulk Add dialog
    await page.getByRole('button', { name: /bulk add/i }).click();

    // Add first user
    await page.getByRole('button', { name: /add user/i }).first().click();

    // Fill first user
    const timestamp = Date.now();
    await page.getByLabel(/first name/i).first().fill('Bulk');
    await page.getByLabel(/last name/i).first().fill('User1');
    await page.getByLabel(/email/i).first().fill(`bulk1.${timestamp}@example.com`);

    // Select permission template
    const templateSelects = page.getByLabel(/permission template/i);
    await templateSelects.first().click();
    await page.getByRole('option').first().click();

    // Add second user
    await page.getByRole('button', { name: /add user/i }).first().click();

    // Fill second user
    const userForms = page.locator('[class*="border rounded-lg"]');
    await userForms.last().getByLabel(/first name/i).fill('Bulk');
    await userForms.last().getByLabel(/last name/i).fill('User2');
    await userForms.last().getByLabel(/email/i).fill(`bulk2.${timestamp}@example.com`);

    // Select permission template for second user
    await userForms.last().getByLabel(/permission template/i).click();
    await page.getByRole('option').first().click();

    // Submit
    await page.getByRole('button', { name: /add 2 users/i }).click();

    // Wait for success
    await expect(page.getByText(/users added successfully/i)).toBeVisible({ timeout: 10000 });
  });

  test('should open user detail sheet when clicking on user name', async ({ page }) => {
    // Wait for users table to load
    await page.waitForSelector('table', { timeout: 5000 });

    // Click on first user in table
    const firstUser = page.locator('table tbody tr').first();
    await firstUser.click();

    // Check sheet is visible
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Check for Contact Information, Organization, Permissions sections
    await expect(page.getByText('Contact Information')).toBeVisible();
    await expect(page.getByText('Organization')).toBeVisible();
    await expect(page.getByText('Permissions')).toBeVisible();

    // Check for action buttons
    await expect(page.getByRole('button', { name: /edit user/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /remove from project/i })).toBeVisible();
  });

  test('should open edit dialog from user detail sheet', async ({ page }) => {
    // Wait for users table
    await page.waitForSelector('table', { timeout: 5000 });

    // Click first user
    await page.locator('table tbody tr').first().click();

    // Click Edit User button
    await page.getByRole('button', { name: /edit user/i }).click();

    // Verify edit dialog opened
    await expect(page.getByText('Edit User')).toBeVisible();

    // Verify form is pre-filled with user data
    const firstNameInput = page.getByLabel(/first name/i);
    await expect(firstNameInput).not.toHaveValue('');
  });

  test('should edit user details successfully', async ({ page }) => {
    // Wait for table
    await page.waitForSelector('table', { timeout: 5000 });

    // Click first user
    await page.locator('table tbody tr').first().click();

    // Click Edit
    await page.getByRole('button', { name: /edit user/i }).click();

    // Modify job title
    const jobTitleInput = page.getByLabel(/job title/i);
    await jobTitleInput.clear();
    await jobTitleInput.fill(`Updated Job ${Date.now()}`);

    // Submit
    await page.getByRole('button', { name: /save/i }).click();

    // Wait for success
    await expect(page.getByText(/user updated successfully/i)).toBeVisible({ timeout: 5000 });
  });

  test('should manage user permissions', async ({ page }) => {
    // Wait for table
    await page.waitForSelector('table', { timeout: 5000 });

    // Open actions menu for first user
    await page.locator('table tbody tr').first().getByRole('button', { name: /more/i }).click();

    // Click Manage Permissions
    await page.getByRole('menuitem', { name: /manage permissions/i }).click();

    // Verify permissions dialog opened
    await expect(page.getByText(/manage permissions/i)).toBeVisible();

    // Check for permission matrix
    await expect(page.getByText('Directory')).toBeVisible();
    await expect(page.getByText('Budget')).toBeVisible();
    await expect(page.getByText('Read')).toBeVisible();
    await expect(page.getByText('Write')).toBeVisible();

    // Check for Save/Cancel buttons
    await expect(page.getByRole('button', { name: /save permissions/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /reset to template/i })).toBeVisible();

    // Close dialog
    await page.getByRole('button', { name: /cancel/i }).click();
  });

  test('should toggle permission override', async ({ page }) => {
    // Wait for table
    await page.waitForSelector('table', { timeout: 5000 });

    // Open permissions manager
    await page.locator('table tbody tr').first().getByRole('button', { name: /more/i }).click();
    await page.getByRole('menuitem', { name: /manage permissions/i }).click();

    // Find and toggle a permission checkbox
    const checkboxes = page.getByRole('checkbox');
    const firstCheckbox = checkboxes.first();
    await firstCheckbox.click();

    // Verify override indicator appears
    await expect(page.getByText('Override')).toBeVisible();

    // Save changes
    await page.getByRole('button', { name: /save permissions/i }).click();

    // Wait for success
    await expect(page.getByText(/permissions updated successfully/i)).toBeVisible({ timeout: 5000 });
  });

  test('should filter users by status', async ({ page }) => {
    // Wait for users to load
    await page.waitForSelector('table', { timeout: 5000 });

    // Get initial row count
    const initialRows = await page.locator('table tbody tr').count();

    // Click status filter
    await page.getByRole('combobox', { name: /filter by status/i }).click();

    // Select "Active" filter
    await page.getByRole('option', { name: /^active$/i }).click();

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Verify filtered results (may be same or less than initial)
    const filteredRows = await page.locator('table tbody tr').count();
    expect(filteredRows).toBeLessThanOrEqual(initialRows);

    // Reset filter
    await page.getByRole('combobox', { name: /filter by status/i }).click();
    await page.getByRole('option', { name: /all users/i }).click();
  });

  test('should search users by name', async ({ page }) => {
    // Wait for users to load
    await page.waitForSelector('table', { timeout: 5000 });

    // Get first user name
    const firstUserName = await page.locator('table tbody tr').first().locator('[class*="weight-medium"]').textContent();

    if (firstUserName) {
      // Search for first few characters
      const searchTerm = firstUserName.substring(0, 3);
      await page.getByPlaceholder(/search users/i).fill(searchTerm);

      // Wait for search to filter
      await page.waitForTimeout(500);

      // Verify user still visible
      await expect(page.getByText(firstUserName)).toBeVisible();
    }
  });

  test('should show resend invite option for pending users', async ({ page }) => {
    // Wait for table
    await page.waitForSelector('table', { timeout: 5000 });

    // Look for users with "Pending" badge
    const pendingBadge = page.getByText('Pending').first();

    if (await pendingBadge.isVisible()) {
      // Find the row containing this badge
      const row = pendingBadge.locator('xpath=ancestor::tr');

      // Open actions menu
      await row.getByRole('button', { name: /more/i }).click();

      // Verify Resend Invite option is visible
      await expect(page.getByRole('menuitem', { name: /resend invite/i })).toBeVisible();
    }
  });

  test('should remove user from project', async ({ page }) => {
    // Add a test user first
    await page.getByRole('button', { name: /add user/i }).click();

    const timestamp = Date.now();
    await page.getByLabel(/first name/i).fill('ToDelete');
    await page.getByLabel(/last name/i).fill('User');
    await page.getByLabel(/email/i).fill(`todelete.${timestamp}@example.com`);

    await page.getByLabel(/permission template/i).click();
    await page.getByRole('option').first().click();

    await page.getByRole('button', { name: /add user/i }).last().click();
    await page.waitForTimeout(2000);

    // Find and open the user
    await page.getByText('ToDelete User').click();

    // Setup dialog handler for confirmation
    page.on('dialog', dialog => dialog.accept());

    // Click Remove button
    await page.getByRole('button', { name: /remove from project/i }).click();

    // Wait for success
    await expect(page.getByText(/user removed from project/i)).toBeVisible({ timeout: 5000 });
  });

  test('should handle empty state gracefully', async ({ page }) => {
    // This test assumes we might have no users or can create that state
    // For now, just verify the table renders even if empty
    await page.waitForSelector('table', { timeout: 5000 });

    const table = page.locator('table');
    await expect(table).toBeVisible();
  });

  test('should display user activity information in detail sheet', async ({ page }) => {
    // Wait for table
    await page.waitForSelector('table', { timeout: 5000 });

    // Click first user
    await page.locator('table tbody tr').first().click();

    // Check for Activity section
    await expect(page.getByText('Activity')).toBeVisible();

    // Check for added date
    await expect(page.locator('text=/Added \\d/')).toBeVisible();
  });
});
