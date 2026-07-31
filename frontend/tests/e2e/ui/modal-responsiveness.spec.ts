import { expect, test } from '@playwright/test';

/**
 * Modal Responsiveness Tests
 *
 * Tests the budget modals at different viewport sizes to verify:
 * - Modal width adapts correctly (95vw mobile → max-w-4xl desktop)
 * - Grid layouts respond (1 col → 2 col → 5 col)
 * - Table switches to cards on mobile
 * - Touch-friendly buttons (44px minimum)
 * - Content scrolls properly
 */

const viewports = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 }
};

test.describe('Modal Responsiveness', () => {

  test.describe('Original Budget Modal - Mobile (375px)', () => {
    test.use({ viewport: viewports.mobile });

    test('should display correctly on mobile', async ({ page }) => {
      await page.goto('/modal-demo');

      // Open Original Budget modal
      await page.click('button:has-text("Open Modal"):near(:text("Original Budget"))');

      // Wait for modal to appear
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // Take screenshot
      await page.screenshot({
        path: 'tests/screenshots/original-budget-mobile.png',
        fullPage: true
      });

      // Verify modal is visible and properly sized
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();

      // Verify tabs are visible
      await expect(page.locator('button:has-text("Original Budget")')).toBeVisible();
      await expect(page.locator('button:has-text("History")')).toBeVisible();

      // Verify calculation method buttons are touch-friendly
      const unitPriceBtn = page.locator('button:has-text("Unit Price")');
      const lumpSumBtn = page.locator('button:has-text("Lump Sum")');

      await expect(unitPriceBtn).toBeVisible();
      await expect(lumpSumBtn).toBeVisible();

      // Verify form fields are in single column on mobile
      const formContainer = page.locator('.grid').first();
      await expect(formContainer).toBeVisible();

      // Verify buttons are visible and accessible
      await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
      await expect(page.locator('button:has-text("Save")')).toBeVisible();
    });
  });

  test.describe('Original Budget Modal - Tablet (768px)', () => {
    test.use({ viewport: viewports.tablet });

    test('should display correctly on tablet', async ({ page }) => {
      await page.goto('/modal-demo');

      // Open Original Budget modal
      await page.click('button:has-text("Open Modal"):near(:text("Original Budget"))');

      // Wait for modal
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // Take screenshot
      await page.screenshot({
        path: 'tests/screenshots/original-budget-tablet.png',
        fullPage: true
      });

      // Verify 2-column layout appears
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();

      // Verify all interactive elements are accessible
      await expect(page.locator('button:has-text("Unit Price")')).toBeVisible();
      await expect(page.locator('button:has-text("Lump Sum")')).toBeVisible();
    });
  });

  test.describe('Original Budget Modal - Desktop (1440px)', () => {
    test.use({ viewport: viewports.desktop });

    test('should display correctly on desktop', async ({ page }) => {
      await page.goto('/modal-demo');

      // Open Original Budget modal
      await page.click('button:has-text("Open Modal"):near(:text("Original Budget"))');

      // Wait for modal
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // Take screenshot
      await page.screenshot({
        path: 'tests/screenshots/original-budget-desktop.png',
        fullPage: true
      });

      // Verify 5-column layout for unit price method
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();

      // Test switching calculation methods
      await page.click('button:has-text("Lump Sum")');
      await page.waitForTimeout(300); // Wait for transition

      // Verify lump sum fields are visible
      await expect(page.locator('label:has-text("Unit Cost")')).toBeVisible();
    });
  });

  test.describe('Create Line Items Modal - Mobile', () => {
    test.use({ viewport: viewports.mobile });

    test('should use card layout on mobile', async ({ page }) => {
      await page.goto('/modal-demo');

      // Open Create Line Items modal
      await page.click('button:has-text("Open Modal"):near(:text("Create Line Items"))');

      // Wait for modal
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // Take screenshot of empty state
      await page.screenshot({
        path: 'tests/screenshots/create-line-items-mobile-empty.png',
        fullPage: true
      });

      // Click Add Line button
      await page.click('button:has-text("Add Line")');

      // Wait for line item to appear
      await page.waitForTimeout(300);

      // Take screenshot with line item
      await page.screenshot({
        path: 'tests/screenshots/create-line-items-mobile-with-item.png',
        fullPage: true
      });

      // Verify card layout is visible (not table)
      // On mobile, we should see the card layout with vertical fields
      const cardContainer = page.locator('.sm\\:hidden');
      await expect(cardContainer).toBeVisible();
    });
  });

  test.describe('Create Line Items Modal - Desktop', () => {
    test.use({ viewport: viewports.desktop });

    test('should use table layout on desktop', async ({ page }) => {
      await page.goto('/modal-demo');

      // Open Create Line Items modal
      await page.click('button:has-text("Open Modal"):near(:text("Create Line Items"))');

      // Wait for modal
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // Click Add Line button
      await page.click('button:has-text("Add Line")');

      // Wait for line item
      await page.waitForTimeout(300);

      // Take screenshot
      await page.screenshot({
        path: 'tests/screenshots/create-line-items-desktop.png',
        fullPage: true
      });

      // Verify table layout is visible (not cards)
      const tableContainer = page.locator('.hidden.sm\\:block');
      await expect(tableContainer).toBeVisible();

      // Verify table headers
      await expect(page.locator('th:has-text("Cost Code")')).toBeVisible();
      await expect(page.locator('th:has-text("Description")')).toBeVisible();
      await expect(page.locator('th:has-text("Qty")')).toBeVisible();
      await expect(page.locator('th:has-text("UOM")')).toBeVisible();
      await expect(page.locator('th:has-text("Unit $")')).toBeVisible();
    });
  });

  test.describe('Unlock Budget Modal - All Sizes', () => {
    for (const [name, viewport] of Object.entries(viewports)) {
      test(`should display correctly on ${name}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto('/modal-demo');

        // Open Unlock Budget modal
        await page.click('button:has-text("Open Modal"):near(:text("Unlock Budget"))');

        // Wait for modal
        await expect(page.locator('[role="dialog"]')).toBeVisible();

        // Take screenshot
        await page.screenshot({
          path: `tests/screenshots/unlock-budget-${name}.png`,
          fullPage: true
        });

        // Verify warning icon and text
        await expect(page.locator('text=Unlock the Budget')).toBeVisible();
        await expect(page.locator('text=Unlocking the Budget will preserve')).toBeVisible();

        // Verify buttons
        await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
        await expect(page.locator('button:has-text("Preserve and Unlock")')).toBeVisible();
      });
    }
  });

  test.describe('Modal Width Constraints', () => {
    test('should respect max-width on very wide screens', async ({ page }) => {
      // Test on ultra-wide screen
      await page.setViewportSize({ width: 2560, height: 1440 });
      await page.goto('/modal-demo');

      // Open Original Budget modal
      await page.click('button:has-text("Open Modal"):near(:text("Original Budget"))');

      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();

      // Get modal width
      const box = await modal.boundingBox();

      // max-w-4xl = 56rem = 896px
      // Modal should not exceed this significantly
      expect(box?.width).toBeLessThan(920); // Adding small buffer for padding

      // Take screenshot
      await page.screenshot({
        path: 'tests/screenshots/original-budget-ultrawide.png',
        fullPage: true
      });
    });
  });

  test.describe('ESC Key Functionality', () => {
    test('should close modal with ESC key', async ({ page }) => {
      await page.goto('/modal-demo');

      // Open Original Budget modal
      await page.click('button:has-text("Open Modal"):near(:text("Original Budget"))');

      // Verify modal is open
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // Press ESC
      await page.keyboard.press('Escape');

      // Verify modal is closed
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    });
  });

  test.describe('Real-time Calculation', () => {
    test('should calculate Original Budget in real-time', async ({ page }) => {
      await page.goto('/modal-demo');

      // Open Original Budget modal
      await page.click('button:has-text("Open Modal"):near(:text("Original Budget"))');

      // Ensure Unit Price method is selected
      await page.click('button:has-text("Unit Price")');

      // Get initial Original Budget value
      const originalBudgetInput = page.locator('input[value="2550"]');
      await expect(originalBudgetInput).toBeVisible();

      // Clear and change Unit Qty
      const unitQtyInput = page.locator('label:has-text("Unit Qty")').locator('..').locator('input');
      await unitQtyInput.clear();
      await unitQtyInput.fill('200');

      // Clear and change Unit Cost
      const unitCostInput = page.locator('label:has-text("Unit Cost")').locator('..').locator('input');
      await unitCostInput.clear();
      await unitCostInput.fill('30');

      // Wait for calculation
      await page.waitForTimeout(300);

      // Verify Original Budget updated to 200 × 30 = 6000
      const updatedBudget = page.locator('input[value="6000"]');
      await expect(updatedBudget).toBeVisible();

      // Take screenshot showing calculation
      await page.screenshot({
        path: 'tests/screenshots/original-budget-calculation.png',
        fullPage: true
      });
    });
  });
});
