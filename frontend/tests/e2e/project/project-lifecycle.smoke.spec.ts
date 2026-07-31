import { test, expect } from '@playwright/test';
import { createTestProject, createAndNavigateToProject } from '../../helpers/bootstrap';

test.describe('Project Bootstrap', () => {
  test('should create fully populated test project via API', async ({ page }) => {
    const project = await createTestProject(page);

    // Verify all entities were created
    expect(project.project).toBeDefined();
    expect(project.project.id).toBeDefined();
    expect(project.project.name).toContain('Test');

    expect(project.contract).toBeDefined();
    expect(project.contract.contract_number).toBe('PC-001');

    expect(project.budgetCodes).toBeDefined();
    expect(project.budgetCodes.length).toBeGreaterThan(10);

    expect(project.budgetLineItems).toBeDefined();
    expect(project.budgetLineItems.length).toBeGreaterThan(10);

    expect(project.commitment).toBeDefined();
    expect(project.commitment.number).toBe('COM-001');

    expect(project.changeEvent).toBeDefined();
    expect(project.changeOrder).toBeDefined();
  });

  test('should navigate to budget page with populated data', async ({ page }) => {
    const project = await createAndNavigateToProject(page, '/budget');

    // Wait for budget page to load
    await expect(page.locator('h1, h2').filter({ hasText: /budget/i }).first()).toBeVisible();

    // Verify budget line items are visible
    await expect(page.locator('table')).toBeVisible();

    // Check for cost codes in the table
    await expect(page.getByText('01-100')).toBeVisible();
    await expect(page.getByText('General Requirements')).toBeVisible();
  });

  test('should navigate to contracts page with prime contract', async ({ page }) => {
    const project = await createAndNavigateToProject(page, '/contracts');

    // Wait for contracts page to load
    await expect(page.locator('h1, h2').filter({ hasText: /contract/i }).first()).toBeVisible();

    // Verify prime contract exists
    await expect(page.getByText('PC-001')).toBeVisible();
  });

  test('should create project with custom name', async ({ page }) => {
    const customName = `Custom Warehouse ${Date.now()}`;
    const project = await createTestProject(page, { name: customName });

    expect(project.project.name).toBe(customName);
  });
});
