import { test, expect } from '@playwright/test';

/**
 * Dropdown Hover Color Verification
 *
 * Purpose: Verify that dropdown menu items and select items have neutral gray hover
 * (NOT orange/brand color) after recent fixes to DropdownMenu and Select components.
 *
 * Expected: Hover state should be light gray (neutral-100 or similar)
 * Bug: Previously showed orange hover on dropdown items
 */

test.describe('Dropdown Hover Colors', () => {
  test('Portfolio page Client filter dropdown has neutral gray hover', async ({ page }) => {
    // Navigate to portfolio page
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Locate the Client dropdown/select filter
    // Looking for a select or button that opens the client filter
    const clientFilter = page.locator('[role="combobox"]').filter({ hasText: /Client/i }).first();

    // If not found, try alternative selectors
    if (await clientFilter.count() === 0) {
      const clientButton = page.locator('button').filter({ hasText: /Client/i }).first();
      await clientButton.click();
    } else {
      await clientFilter.click();
    }

    // Wait for dropdown to open
    await page.waitForTimeout(500);

    // Get the first dropdown item
    const firstDropdownItem = page.locator('[role="option"]').first();

    // Hover over the item
    await firstDropdownItem.hover();

    // Wait a moment for hover state to apply
    await page.waitForTimeout(200);

    // Take screenshot of hover state
    await page.screenshot({
      path: 'tests/screenshots/client-dropdown-hover.png',
      fullPage: false
    });

    // Get computed style of the hovered item
    const backgroundColor = await firstDropdownItem.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    console.log('Client dropdown hover background color:', backgroundColor);

    // Verify it's NOT orange (rgb values around 255, 165, 0 or similar brand orange)
    // Orange brand colors would be something like rgb(255, 107, 0) or similar
    // Gray should be rgb(245, 245, 245) or similar neutral tones

    // Check that R, G, B values are similar (indicating gray, not orange)
    const rgbMatch = backgroundColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      const [, r, g, b] = rgbMatch.map(Number);
      const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));

      // If max difference between RGB values is > 30, it's likely a colored hover (not neutral gray)
      expect(maxDiff).toBeLessThan(30);

      // Also verify it's a light color (high RGB values for light gray)
      expect(r).toBeGreaterThan(200); // Light gray should be > 200
    }
  });

  test('Portfolio page Phase filter dropdown has neutral gray hover', async ({ page }) => {
    // Navigate to portfolio page
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Locate the Phase dropdown/select filter
    const phaseFilter = page.locator('[role="combobox"]').filter({ hasText: /Phase/i }).first();

    // If not found, try alternative selectors
    if (await phaseFilter.count() === 0) {
      const phaseButton = page.locator('button').filter({ hasText: /Phase/i }).first();
      await phaseButton.click();
    } else {
      await phaseFilter.click();
    }

    // Wait for dropdown to open
    await page.waitForTimeout(500);

    // Get the first dropdown item
    const firstDropdownItem = page.locator('[role="option"]').first();

    // Hover over the item
    await firstDropdownItem.hover();

    // Wait a moment for hover state to apply
    await page.waitForTimeout(200);

    // Take screenshot of hover state
    await page.screenshot({
      path: 'tests/screenshots/phase-dropdown-hover.png',
      fullPage: false
    });

    // Get computed style of the hovered item
    const backgroundColor = await firstDropdownItem.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    console.log('Phase dropdown hover background color:', backgroundColor);

    // Verify it's NOT orange and is neutral gray
    const rgbMatch = backgroundColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      const [, r, g, b] = rgbMatch.map(Number);
      const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));

      expect(maxDiff).toBeLessThan(30); // Neutral color
      expect(r).toBeGreaterThan(200); // Light gray
    }
  });
});
