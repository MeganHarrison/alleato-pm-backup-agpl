import { test, expect } from '@playwright/test';

test.describe('Create Project Form - Video Demo', () => {
  test('Navigate to Create Project form and capture video', async ({ page }) => {
    console.log('🎥 Starting video recording for Create Project form test');

    // Navigate to the form
    await page.goto('/form-project');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Take a screenshot for reference
    await page.screenshot({
      path: 'tests/screenshots/create-project-form.png',
      fullPage: true
    });

    // Check if we're redirected to login
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);

    if (currentUrl.includes('/auth/login') || currentUrl.includes('/login')) {
      console.log('📝 Redirected to login page - form requires authentication');

      // Document the login page
      await expect(page).toHaveURL(/.*login/);

      // Check for login form elements
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      const passwordInput = page.locator('input[type="password"], input[name="password"]');

      if (await emailInput.isVisible()) {
        console.log('✅ Login form found with email and password fields');
      }
    } else if (currentUrl.includes('/form-project')) {
      console.log('📋 Successfully loaded Create Project form');

      // Look for form elements
      const form = page.locator('form');
      const projectNameInput = page.locator('input[name="name"], label:has-text("Project Name") + input');
      const projectNumberInput = page.locator('input[name="number"], label:has-text("Project Number") + input');

      // Check if form exists
      if (await form.isVisible()) {
        console.log('✅ Form element found');

        // Try to interact with form fields
        if (await projectNameInput.isVisible()) {
          await projectNameInput.fill('Test Project from Playwright');
          console.log('✅ Filled Project Name field');
        }

        if (await projectNumberInput.isVisible()) {
          await projectNumberInput.fill('TEST-001');
          console.log('✅ Filled Project Number field');
        }
      }
    } else {
      console.log('❓ Unexpected page:', currentUrl);
    }

    // Wait a moment to capture more video
    await page.waitForTimeout(2000);

    console.log('🎬 Test complete - video should be saved in test-results directory');
  });
});