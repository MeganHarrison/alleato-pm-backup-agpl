import { test, expect } from '@playwright/test';

test.describe('Homepage Projects Loading', () => {
  test('should load and display projects on homepage', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');

    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Take screenshot of initial state
    await page.screenshot({
      path: 'tests/screenshots/homepage-initial.png',
      fullPage: true
    });

    // Check if loading state appears first
    const loadingText = page.getByText('Loading projects...');

    // Wait for either loading to appear or projects to load
    await page.waitForTimeout(1000);

    // Take screenshot after wait
    await page.screenshot({
      path: 'tests/screenshots/homepage-after-wait.png',
      fullPage: true
    });

    // Check for API request to /api/projects
    const apiRequests: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/projects')) {
        apiRequests.push(request.url());
      }
    });

    // Reload to capture API requests
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Take screenshot after reload
    await page.screenshot({
      path: 'tests/screenshots/homepage-after-reload.png',
      fullPage: true
    });

    // Check console for errors
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    });

    // Wait a bit more to collect console messages
    await page.waitForTimeout(2000);

    // Log findings
    console.log('API Requests:', apiRequests);
    console.log('Console Messages:', consoleMessages);

    // Check if projects table exists
    const projectsTable = page.locator('table').first();
    const tableExists = await projectsTable.count() > 0;

    console.log('Projects table exists:', tableExists);

    // Check for "Loading projects..." text
    const stillLoading = await loadingText.isVisible().catch(() => false);
    console.log('Still showing loading:', stillLoading);

    // Take final screenshot
    await page.screenshot({
      path: 'tests/screenshots/homepage-final.png',
      fullPage: true
    });
  });

  test('should make API request to /api/projects', async ({ page }) => {
    const apiRequests: Array<{ url: string; status: number; response?: unknown }> = [];

    // Intercept API requests
    page.on('response', async response => {
      if (response.url().includes('/api/projects')) {
        const status = response.status();
        let responseData: unknown;
        try {
          responseData = await response.json();
        } catch {
          responseData = await response.text();
        }
        apiRequests.push({
          url: response.url(),
          status,
          response: responseData
        });
      }
    });

    // Navigate to homepage
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for API calls
    await page.waitForTimeout(3000);

    // Log API requests
    console.log('API Requests captured:', JSON.stringify(apiRequests, null, 2));

    // Take screenshot
    await page.screenshot({
      path: 'tests/screenshots/homepage-api-check.png',
      fullPage: true
    });

    // Verify at least one API call was made
    expect(apiRequests.length).toBeGreaterThan(0);

    // Check if response was successful
    if (apiRequests.length > 0) {
      expect(apiRequests[0].status).toBe(200);
    }
  });
});
