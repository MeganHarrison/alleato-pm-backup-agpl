/**
 * Directory Test Helpers
 * Utility functions for Directory E2E tests
 */

import { Page, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Test data generation
export const generateTestData = () => {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(7);

  return {
    user: {
      firstName: `Test`,
      lastName: `User${timestamp}`,
      email: `testuser${timestamp}@example.com`,
      phone: '555-0100',
      company: 'Test Company',
      role: 'Project Manager',
      permission: 'Admin'
    },
    contact: {
      firstName: `Contact`,
      lastName: `Person${timestamp}`,
      email: `contact${timestamp}@example.com`,
      phone: '555-0200',
      company: 'Vendor Company',
      jobTitle: 'Sales Representative'
    },
    company: {
      name: `Company ${timestamp}`,
      type: 'Subcontractor',
      address: '123 Test Street',
      city: 'Test City',
      state: 'CA',
      zip: '12345',
      phone: '555-0300',
      website: 'https://example.com'
    },
    group: {
      name: `Distribution Group ${timestamp}`,
      description: 'Test distribution group for automated testing',
      emailEnabled: true
    }
  };
};

// Navigation helpers
export const navigateToDirectory = async (page: Page, projectId: string, tab?: string) => {
  const baseUrl = `/INI-2026-01-09-001/directory${tab ? `/${tab}` : ''}`;
  await page.goto(baseUrl);
  await page.waitForLoadState('networkidle');

  // Wait for directory to load
  await expect(page.locator('h1').first()).toBeVisible();
  await page.waitForTimeout(500); // Small delay for data loading
};

// Table interaction helpers
export const waitForTable = async (page: Page) => {
  // Wait for table to be visible
  const table = page.locator('table, [role="table"], .directory-table').first();
  await expect(table).toBeVisible({ timeout: 10000 });

  // Wait for at least one row or "no data" message
  await Promise.race([
    page.waitForSelector('tbody tr, [role="row"]', { timeout: 5000 }).catch(() => {}),
    page.waitForSelector('text=/no.*found/i', { timeout: 5000 }).catch(() => {})
  ]);
};

export const searchInDirectory = async (page: Page, searchTerm: string) => {
  const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
  await searchInput.fill(searchTerm);
  await page.waitForTimeout(500); // Debounce delay
  await waitForTable(page);
};

export const filterDirectory = async (page: Page, filterType: string, filterValue: string) => {
  // Open filter dropdown or panel
  const filterButton = page.locator('button:has-text("Filter"), button:has-text("Filters")').first();
  if (await filterButton.isVisible()) {
    await filterButton.click();
  }

  // Select filter option
  await page.locator(`text="${filterType}"`).click();
  await page.locator(`text="${filterValue}"`).click();

  await waitForTable(page);
};

// Form interaction helpers
export const openAddPersonDialog = async (page: Page) => {
  const addButton = page.locator('button:has-text("Add Person"), button:has-text("Add User"), button:has-text("New")').first();
  await expect(addButton).toBeVisible();
  await addButton.click();

  // Wait for dialog to open
  await expect(page.locator('[role="dialog"], .modal, .dialog')).toBeVisible();
};

export const fillPersonForm = async (page: Page, data: any) => {
  // Fill basic information
  await page.locator('input[name="firstName"], input[placeholder*="First"]').fill(data.firstName);
  await page.locator('input[name="lastName"], input[placeholder*="Last"]').fill(data.lastName);
  await page.locator('input[name="email"], input[type="email"]').fill(data.email);

  if (data.phone) {
    await page.locator('input[name="phone"], input[type="tel"]').fill(data.phone);
  }

  // Select company if dropdown exists
  const companySelect = page.locator('select[name="company"], [role="combobox"]:has-text("Company")');
  if (await companySelect.isVisible()) {
    await companySelect.click();
    await page.locator(`text="${data.company}"`).click();
  }

  // Select role/permission if available
  if (data.role) {
    const roleSelect = page.locator('select[name="role"], [role="combobox"]:has-text("Role")');
    if (await roleSelect.isVisible()) {
      await roleSelect.click();
      await page.locator(`text="${data.role}"`).click();
    }
  }
};

export const saveForm = async (page: Page) => {
  const saveButton = page.locator('button:has-text("Save"), button:has-text("Create"), button:has-text("Add")').filter({ hasText: /^(Save|Create|Add)$/i });
  await saveButton.click();

  // Wait for dialog to close or success message
  await Promise.race([
    page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 5000 }).catch(() => {}),
    page.waitForSelector('.toast-success, [role="alert"]:has-text("success")', { timeout: 5000 }).catch(() => {})
  ]);

  // Small delay for data to update
  await page.waitForTimeout(1000);
};

// Row action helpers
export const findTableRow = async (page: Page, searchText: string) => {
  await waitForTable(page);
  const row = page.locator('tr, [role="row"]').filter({ hasText: searchText });
  return row.first();
};

export const clickRowAction = async (page: Page, rowText: string, action: 'edit' | 'delete' | 'invite' | 'deactivate') => {
  const row = await findTableRow(page, rowText);
  await expect(row).toBeVisible();

  // Click more menu or action button
  const moreButton = row.locator('button[aria-label*="More"], button:has-text("⋮"), button:has-text("...")').first();
  if (await moreButton.isVisible()) {
    await moreButton.click();
  }

  // Click specific action
  const actionButton = page.locator(`button:has-text("${action}"), [role="menuitem"]:has-text("${action}")`).first();
  await actionButton.click();
};

// Invitation helpers
export const sendInvitation = async (page: Page, email: string, customMessage?: string) => {
  // Wait for invite dialog
  await expect(page.locator('[role="dialog"]:has-text("Invite"), .modal:has-text("Invite")')).toBeVisible();

  // Fill email if not pre-filled
  const emailInput = page.locator('input[type="email"], input[name="email"]');
  const currentValue = await emailInput.inputValue();
  if (!currentValue) {
    await emailInput.fill(email);
  }

  // Add custom message if provided
  if (customMessage) {
    const messageInput = page.locator('textarea[name="message"], textarea[placeholder*="message"]');
    await messageInput.fill(customMessage);
  }

  // Send invitation
  const sendButton = page.locator('button:has-text("Send"), button:has-text("Invite")').filter({ hasText: /^(Send|Send Invite|Invite)$/i });
  await sendButton.click();

  // Wait for success
  await expect(page.locator('.toast-success, [role="alert"]:has-text("sent")')).toBeVisible();
};

// Permission helpers
export const changePermission = async (page: Page, userName: string, newPermission: string) => {
  const row = await findTableRow(page, userName);

  // Find permission dropdown in row
  const permissionSelect = row.locator('select[name*="permission"], [role="combobox"]').first();
  await permissionSelect.click();
  await page.locator(`text="${newPermission}"`).click();

  // Wait for update
  await page.waitForTimeout(500);
};

// Bulk operation helpers
export const selectMultipleRows = async (page: Page, rowTexts: string[]) => {
  for (const text of rowTexts) {
    const row = await findTableRow(page, text);
    const checkbox = row.locator('input[type="checkbox"]').first();
    await checkbox.check();
  }
};

export const performBulkAction = async (page: Page, action: string) => {
  // Click bulk actions button
  const bulkButton = page.locator('button:has-text("Bulk"), button:has-text("Actions")').first();
  await bulkButton.click();

  // Select action
  await page.locator(`text="${action}"`).click();

  // Confirm if needed
  const confirmButton = page.locator('button:has-text("Confirm")');
  if (await confirmButton.isVisible()) {
    await confirmButton.click();
  }
};

// Verification helpers
export const verifyPersonInTable = async (page: Page, personData: any) => {
  await waitForTable(page);
  const row = await findTableRow(page, personData.email);
  await expect(row).toBeVisible();

  // Verify key fields are visible in row
  if (personData.firstName && personData.lastName) {
    await expect(row).toContainText(`${personData.firstName} ${personData.lastName}`);
  }
  if (personData.company) {
    await expect(row).toContainText(personData.company);
  }
};

export const verifyPersonNotInTable = async (page: Page, searchText: string) => {
  await waitForTable(page);
  const row = page.locator('tr, [role="row"]').filter({ hasText: searchText });
  await expect(row).not.toBeVisible();
};

// Company grouping helpers
export const expandCompanyGroup = async (page: Page, companyName: string) => {
  const groupHeader = page.locator(`[role="row"]:has-text("${companyName}"), tr:has-text("${companyName}")`).first();
  const expandButton = groupHeader.locator('button[aria-label*="Expand"], button:has-text("▶"), button:has-text("▼")').first();

  if (await expandButton.isVisible()) {
    const isExpanded = await expandButton.getAttribute('aria-expanded');
    if (isExpanded !== 'true') {
      await expandButton.click();
      await page.waitForTimeout(300);
    }
  }
};

export const collapseCompanyGroup = async (page: Page, companyName: string) => {
  const groupHeader = page.locator(`[role="row"]:has-text("${companyName}"), tr:has-text("${companyName}")`).first();
  const collapseButton = groupHeader.locator('button[aria-label*="Collapse"], button:has-text("▼"), button:has-text("▶")').first();

  if (await collapseButton.isVisible()) {
    const isExpanded = await collapseButton.getAttribute('aria-expanded');
    if (isExpanded === 'true') {
      await collapseButton.click();
      await page.waitForTimeout(300);
    }
  }
};

// Distribution group helpers
export const createDistributionGroup = async (page: Page, groupData: any) => {
  // Navigate to groups tab
  await page.locator('a:has-text("Groups"), button:has-text("Groups")').click();
  await waitForTable(page);

  // Open create dialog
  const addButton = page.locator('button:has-text("Add Group"), button:has-text("New Group")').first();
  await addButton.click();

  // Fill form
  await page.locator('input[name="name"], input[placeholder*="Group name"]').fill(groupData.name);
  if (groupData.description) {
    await page.locator('textarea[name="description"]').fill(groupData.description);
  }

  // Save
  await saveForm(page);
};

export const addMembersToGroup = async (page: Page, groupName: string, memberEmails: string[]) => {
  // Find group row
  const row = await findTableRow(page, groupName);

  // Click manage members
  await clickRowAction(page, groupName, 'edit');

  // Add members
  for (const email of memberEmails) {
    const memberInput = page.locator('input[placeholder*="Add member"], input[placeholder*="Email"]');
    await memberInput.fill(email);
    await page.keyboard.press('Enter');
  }

  // Save changes
  await saveForm(page);
};

// Cleanup helpers
export const cleanupTestData = async (page: Page, supabaseUrl: string, supabaseKey: string) => {
  // This would connect to Supabase and clean up test data
  // Implementation depends on your specific cleanup requirements
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Example: Delete test users created during tests
  // await supabase.from('people').delete().like('email', '%@example.com%');
};

// Export all helpers
export default {
  generateTestData,
  navigateToDirectory,
  waitForTable,
  searchInDirectory,
  filterDirectory,
  openAddPersonDialog,
  fillPersonForm,
  saveForm,
  findTableRow,
  clickRowAction,
  sendInvitation,
  changePermission,
  selectMultipleRows,
  performBulkAction,
  verifyPersonInTable,
  verifyPersonNotInTable,
  expandCompanyGroup,
  collapseCompanyGroup,
  createDistributionGroup,
  addMembersToGroup,
  cleanupTestData
};