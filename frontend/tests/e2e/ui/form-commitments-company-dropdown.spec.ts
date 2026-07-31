import { test, expect } from '@playwright/test';

test.describe('Form Commitments - Company Dropdown', () => {
  test('should display and populate company dropdown on form-commitments page', async ({ page }) => {
    // Navigate to the form-commitments page with the exact URL from the user
    await page.goto('/118/commitments/new?type=subcontract');

    // Wait for the page to load completely
    await page.waitForLoadState('networkidle');

    // Wait for companies to load - give it a few seconds
    await page.waitForTimeout(3000);

    // Check if the "Contract Company" label is visible
    const companyLabel = page.getByText('Contract Company*');
    await expect(companyLabel).toBeVisible();

    // Find the company dropdown
    const companyDropdown = page.getByRole('combobox').filter({ hasText: 'Select a company' });
    await expect(companyDropdown).toBeVisible();

    // Take a screenshot before clicking
    await page.screenshot({
      path: 'tests/screenshots/form-commitments-before-click.png',
      fullPage: true
    });

    // Click the dropdown to open it
    await companyDropdown.click();

    // Wait for the dropdown to open
    await page.waitForTimeout(1000);

    // Take a screenshot after clicking
    await page.screenshot({
      path: 'tests/screenshots/form-commitments-after-click.png',
      fullPage: true
    });

    // Wait for dropdown options to appear (with a longer timeout)
    await page.waitForSelector('[role="option"]', { timeout: 10000 }).catch(() => {
      console.log('No options found after 10 seconds');
    });

    // Count how many company options are available
    const companyOptions = page.locator('[role="option"]');
    const optionCount = await companyOptions.count();
    console.log('Number of company options:', optionCount);

    // If no options, let's check what companies are in the page
    if (optionCount === 0) {
      const pageHTML = await page.content();
      console.log('Page has "Radial":', pageHTML.includes('Radial'));
      console.log('Page has "Ceva":', pageHTML.includes('Ceva'));

      // Check if companies were loaded into the component
      const debugInfo = await page.evaluate(() => {
        const selectElements = document.querySelectorAll('select');
        const buttonElements = document.querySelectorAll('button');
        return {
          selectCount: selectElements.length,
          buttonCount: buttonElements.length,
          bodyText: document.body.innerText.substring(0, 500)
        };
      });
      console.log('Debug info:', debugInfo);
    }

    // Verify that we have at least some companies loaded
    expect(optionCount).toBeGreaterThan(0);
  });

  test('should check if companies are loaded in the store', async ({ page }) => {
    await page.goto('/118/commitments/new?type=subcontract');
    await page.waitForLoadState('networkidle');

    // Check the state of the financial store via browser console
    const storeState = await page.evaluate(() => {
      // Access the zustand store from window if exposed
      return {
        location: window.location.href,
        // We'll need to check what's actually rendered
      };
    });

    console.log('Store state:', storeState);

    // Check if there are any vendor/subcontractor companies in the DOM
    const selectTrigger = page.locator('label:has-text("Contract Company")').locator('..').locator('[role="combobox"]');
    await expect(selectTrigger).toBeVisible();

    const placeholderText = await selectTrigger.textContent();
    console.log('Select placeholder/value:', placeholderText);
  });
});
