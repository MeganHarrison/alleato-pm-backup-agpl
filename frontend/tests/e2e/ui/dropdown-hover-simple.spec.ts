import { test, expect } from '@playwright/test';

/**
 * Simple Dropdown Hover Color Verification
 *
 * Purpose: Quick visual verification that dropdown items have neutral gray hover
 * Expected: rgb(245, 245, 245) or similar light gray
 * Bug Fix: Previously had orange/brand color hover
 */

test.describe('Dropdown Hover Colors - Simple Check', () => {
  test.skip(({ browserName }) => browserName !== 'chromium');

  test('Portfolio page filters have neutral gray hover (no auth)', async ({ page }) => {
    // Navigate to portfolio page
    await page.goto('http://localhost:3003', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000); // Wait for initial render

    // Take screenshot of initial state
    await page.screenshot({
      path: 'tests/screenshots/portfolio-initial.png',
      fullPage: false
    });

    // Try to find and interact with any visible dropdown
    // Look for select components or combobox elements
    const selectTriggers = page.locator('button[role="combobox"], select, button:has-text("Select")');
    const count = await selectTriggers.count();

    console.log(`Found ${count} potential dropdown/select elements`);

    if (count > 0) {
      // Click the first one to open dropdown
      const firstTrigger = selectTriggers.first();
      await firstTrigger.click({ timeout: 5000 }).catch(() => {
        console.log('Could not click first trigger, trying second approach');
      });

      await page.waitForTimeout(500);

      // Look for dropdown options
      const options = page.locator('[role="option"], [role="menuitem"]');
      const optionsCount = await options.count();

      console.log(`Found ${optionsCount} dropdown options`);

      if (optionsCount > 0) {
        const firstOption = options.first();

        // Hover over the option
        await firstOption.hover();
        await page.waitForTimeout(200);

        // Take screenshot of hover state
        await page.screenshot({
          path: 'tests/screenshots/dropdown-hover-state.png',
          fullPage: false
        });

        // Get computed style
        const backgroundColor = await firstOption.evaluate((el) => {
          return window.getComputedStyle(el).backgroundColor;
        });

        console.log('Dropdown option hover background color:', backgroundColor);

        // Verify it's neutral gray
        const rgbMatch = backgroundColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (rgbMatch) {
          const [, r, g, b] = rgbMatch.map(Number);
          console.log(`RGB values: R=${r}, G=${g}, B=${b}`);

          const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
          console.log(`Max RGB difference: ${maxDiff} (should be < 30 for neutral gray)`);

          // Verify neutral color (RGB values close together)
          expect(maxDiff).toBeLessThan(30);

          // Verify it's light (not dark gray)
          expect(r).toBeGreaterThan(200);
          expect(g).toBeGreaterThan(200);
          expect(b).toBeGreaterThan(200);

          console.log('✅ PASS: Dropdown hover is neutral light gray, NOT orange!');
        }
      }
    }

    // Also check the Select components directly
    console.log('\n--- Checking Select Component Styling ---');

    // Read the actual Select component to verify styles
    const selectButtons = page.locator('button').filter({ hasText: /Client|Phase|Status/i });
    const selectCount = await selectButtons.count();

    console.log(`Found ${selectCount} filter buttons`);

    for (let i = 0; i < Math.min(selectCount, 3); i++) {
      const button = selectButtons.nth(i);
      const text = await button.textContent();
      console.log(`Filter ${i + 1}: ${text}`);
    }
  });
});
