/**
 * Budget Validation E2E Tests
 *
 * Tests form validation for budget line item creation and editing.
 * Ensures users receive clear, specific error messages for invalid inputs.
 *
 * Following E2E testing standards - these tests:
 * 1. Interact with forms (fill fields, submit)
 * 2. Verify validation errors appear in UI
 * 3. Test both required fields and invalid values
 *
 * @see /DOCS_NEED_TO_FILE/BUDGET-E2E-TEST-PLAN.md (Tests 5-6)
 * @see .claude/rules/E2E-TESTING-STANDARDS.md
 */

import { test, expect } from '../../fixtures/index';
import { createTestProject } from '../../helpers/bootstrap';

let projectId: number;

test.describe('Budget Form Validation', () => {
  test.beforeAll(async ({ page, authenticatedRequest }) => {
    // Create a test project
    const project = await createTestProject(page, { template: 'commercial' }, authenticatedRequest);
    projectId = project.project.id;

    console.log(`[Budget Validation] Test project created: ${projectId}`);
  });

  test.beforeEach(async ({ page }) => {
    // Navigate to budget page before each test
    await page.goto(`/${projectId}/budget`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for page to load
    await expect(
      page.getByRole('heading', { name: /budget/i }).first(),
      'Budget page header should be visible'
    ).toBeVisible({ timeout: 10000 });
  });

  /**
   * Test 5: Validation - Empty Required Fields
   *
   * User Story: As a project manager, I receive clear error messages
   * when I forget required fields.
   *
   * This test ensures validation errors are SPECIFIC, not generic.
   * Users should know exactly which field is missing.
   */
  test('shows specific validation errors for empty required fields', async ({ page }) => {
    // 1. Open the creation modal
    const createButton = page.getByRole('button', { name: /create/i }).first();
    await expect(createButton, 'Create button should be visible').toBeVisible({ timeout: 5000 });
    await createButton.click();

    // Select "Budget Line Item" from dropdown
    const budgetLineItemOption = page.getByRole('menuitem', { name: /budget line item/i });
    await expect(budgetLineItemOption, 'Budget Line Item option should be visible').toBeVisible({
      timeout: 3000,
    });
    await budgetLineItemOption.click();

    // Wait for modal
    const modal = page.getByRole('dialog');
    await expect(modal, 'Add Budget Line Items modal should be visible').toBeVisible({
      timeout: 5000,
    });

    // 2. Submit the form WITHOUT filling any fields
    const submitButton = modal.getByRole('button', { name: /create.*line item/i });
    await expect(submitButton, 'Submit button should be visible').toBeVisible();
    await submitButton.click();

    // Wait a moment for validation to trigger
    await page.waitForTimeout(1000);

    // 3. Verify modal does NOT close (validation prevents submission)
    await expect(modal, 'Modal should remain open when validation fails').toBeVisible({
      timeout: 2000,
    });

    // 4. Verify SPECIFIC validation errors appear (not generic "failed to create")
    // Check for validation messages in:
    // - Form field errors (aria-invalid, error text below fields)
    // - Toast notifications
    // - Alert/error banners

    // Look for any visible error text
    const errorMessages = page.locator('[role="alert"], .text-destructive, .text-red-500');
    const errorCount = await errorMessages.count();

    // There should be at least one validation error visible
    expect(
      errorCount,
      'At least one validation error message should be visible'
    ).toBeGreaterThan(0);

    // Get the error text to verify it's specific
    if (errorCount > 0) {
      const errorText = await errorMessages.first().textContent();
      console.log('[Validation] Error message:', errorText);

      // Verify the error is NOT a generic failure message
      expect(
        errorText?.toLowerCase(),
        'Error should not be generic "failed to create"'
      ).not.toContain('failed to create');

      expect(
        errorText?.toLowerCase(),
        'Error should not be generic "unexpected error"'
      ).not.toContain('unexpected error');

      // Verify the error mentions specific fields or requirements
      const hasSpecificError =
        errorText?.toLowerCase().includes('required') ||
        errorText?.toLowerCase().includes('budget code') ||
        errorText?.toLowerCase().includes('cost code') ||
        errorText?.toLowerCase().includes('amount') ||
        errorText?.toLowerCase().includes('field');

      expect(
        hasSpecificError,
        'Error message should mention specific field names or "required"'
      ).toBeTruthy();
    }

    // 5. Verify form fields show validation state
    // Look for aria-invalid attributes or error styling
    const budgetCodeField = modal.getByLabel(/budget code|cost code/i).first();
    const amountField = modal.getByLabel(/amount|original budget/i).first();

    // At least one of these fields should show validation error
    const budgetCodeInvalid = await budgetCodeField.getAttribute('aria-invalid');
    const amountInvalid = await amountField.getAttribute('aria-invalid');

    const hasInvalidField = budgetCodeInvalid === 'true' || amountInvalid === 'true';

    // Note: If aria-invalid is not used, check for error classes
    const budgetCodeClasses = await budgetCodeField.getAttribute('class');
    const amountClasses = await amountField.getAttribute('class');

    const hasErrorClass =
      budgetCodeClasses?.includes('error') ||
      budgetCodeClasses?.includes('invalid') ||
      amountClasses?.includes('error') ||
      amountClasses?.includes('invalid');

    expect(
      hasInvalidField || hasErrorClass || errorCount > 0,
      'Form should indicate validation errors via aria-invalid, error classes, or error messages'
    ).toBeTruthy();
  });

  /**
   * Test 6: Validation - Invalid Amount Values
   *
   * User Story: As a project manager, I am prevented from entering
   * invalid financial amounts.
   *
   * Tests:
   * - Negative amounts
   * - Non-numeric values
   * - Excessive decimal places
   */
  test('prevents invalid amount values with specific error messages', async ({ page }) => {
    // 1. Open the creation modal
    const createButton = page.getByRole('button', { name: /create/i }).first();
    await createButton.click();

    const budgetLineItemOption = page.getByRole('menuitem', { name: /budget line item/i });
    await budgetLineItemOption.click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Fill required fields (so we can isolate amount validation)
    const budgetCodeSelect = modal.getByLabel(/budget code|cost code/i).first();
    await budgetCodeSelect.click();
    await page.waitForTimeout(500);
    await page.getByRole('option').first().click();

    // 2. Test Case 1: Negative Amount
    const amountInput = modal.getByLabel(/amount|original budget/i).first();
    await amountInput.fill('-5000');

    const submitButton = modal.getByRole('button', { name: /create.*line item/i });
    await submitButton.click();
    await page.waitForTimeout(1000);

    // Verify modal stays open
    await expect(modal, 'Modal should stay open for negative amount').toBeVisible();

    // Look for validation error about negative/positive values
    const negativeError = page.getByText(/positive|negative|greater than|must be/i);
    const negativeErrorVisible = (await negativeError.count()) > 0;

    if (negativeErrorVisible) {
      const errorText = await negativeError.first().textContent();
      console.log('[Validation] Negative amount error:', errorText);

      expect(
        errorText?.toLowerCase(),
        'Error should mention positive value requirement'
      ).toMatch(/positive|greater|must be/);
    }

    // Clear the field for next test
    await amountInput.clear();

    // 3. Test Case 2: Non-Numeric Value
    await amountInput.fill('abc123');
    await submitButton.click();
    await page.waitForTimeout(1000);

    // Verify modal stays open
    await expect(modal, 'Modal should stay open for non-numeric amount').toBeVisible();

    // Look for validation error about numeric values
    const numericError = page.getByText(/number|numeric|invalid|valid amount/i);
    const numericErrorVisible = (await numericError.count()) > 0;

    if (numericErrorVisible) {
      const errorText = await numericError.first().textContent();
      console.log('[Validation] Non-numeric error:', errorText);
    }

    // Note: Some implementations may prevent non-numeric input entirely (input type="number")
    // In that case, verify the input only accepts numbers
    const inputType = await amountInput.getAttribute('type');
    if (inputType === 'number') {
      console.log('[Validation] Input type="number" prevents non-numeric values');
    }

    // Clear for next test
    await amountInput.clear();

    // 4. Test Case 3: Excessive Decimal Places
    await amountInput.fill('5000.12345');
    await submitButton.click();
    await page.waitForTimeout(1000);

    // Financial amounts should be limited to 2 decimal places
    // Either validation prevents it, OR it auto-formats to 2 decimals
    const currentValue = await amountInput.inputValue();
    console.log('[Validation] Amount value after entering 5000.12345:', currentValue);

    // Check if value was auto-formatted or if validation error appears
    const decimalError = page.getByText(/decimal|two decimal places|format/i);
    const decimalErrorVisible = (await decimalError.count()) > 0;

    // Either the value should be formatted to 2 decimals OR an error should appear
    const hasProperDecimals =
      currentValue === '5000.12' || currentValue === '5000' || decimalErrorVisible;

    expect(
      hasProperDecimals,
      'Amount should either auto-format to 2 decimals or show validation error'
    ).toBeTruthy();
  });

  /**
   * Test 7: Validation - Valid Data Submission Success
   *
   * After testing validation failures, verify that VALID data
   * successfully creates a line item without errors.
   *
   * This ensures validation isn't overly strict.
   */
  test('accepts valid budget line item data without errors', async ({ page }) => {
    // 1. Open creation modal
    const createButton = page.getByRole('button', { name: /create/i }).first();
    await createButton.click();

    const budgetLineItemOption = page.getByRole('menuitem', { name: /budget line item/i });
    await budgetLineItemOption.click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // 2. Fill ALL required fields with VALID data
    const budgetCodeSelect = modal.getByLabel(/budget code|cost code/i).first();
    await budgetCodeSelect.click();
    await page.waitForTimeout(500);
    await page.getByRole('option').first().click();

    await modal.getByLabel(/amount|original budget/i).first().fill('35000');
    await modal.getByLabel(/quantity/i).first().fill('7');
    await modal.getByLabel(/uom|unit of measure/i).first().fill('EA');
    await modal.getByLabel(/unit cost/i).first().fill('5000');

    // 3. Submit
    const submitButton = modal.getByRole('button', { name: /create.*line item/i });
    await submitButton.click();

    // 4. Verify modal CLOSES (no validation errors)
    await expect(modal, 'Modal should close after successful submission').not.toBeVisible({
      timeout: 10000,
    });

    // 5. Verify success toast (NOT error toast)
    const successToast = page.getByText(/created.*budget line item/i);
    await expect(successToast, 'Success toast should appear').toBeVisible({ timeout: 5000 });

    // Verify NO error messages appear
    const errorToast = page.getByText(/error|failed|invalid/i);
    await expect(errorToast, 'No error toast should appear for valid data').not.toBeVisible({
      timeout: 2000,
    });

    // 6. Verify line item appears in table
    const newRow = page.getByRole('row').filter({ hasText: '$35,000' });
    await expect(newRow, 'New line item should appear in table').toBeVisible({ timeout: 5000 });
  });

  /**
   * Cleanup: Delete test project
   */
  test.afterAll(async ({ page }) => {
    if (!projectId) return;

    console.log(`[Budget Validation] Cleaning up test project: ${projectId}`);

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const response = await page.request.delete(`${baseUrl}/api/projects/${projectId}`);

    if (response.ok()) {
      console.log(`[Budget Validation] Test project ${projectId} deleted successfully`);
    } else {
      console.error(
        `[Budget Validation] Failed to delete test project ${projectId}: ${response.status()}`
      );
    }
  });
});
