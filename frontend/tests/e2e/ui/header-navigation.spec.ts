import { test, expect } from '@playwright/test';

test.describe('Header Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the home page
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');
  });

  test('breadcrumb links should navigate correctly', async ({ page }) => {
    // Click on a navigation link first to get to a deeper page
    await page.goto('http://localhost:3000/directory');
    await page.waitForLoadState('networkidle');
    
    // Click the Home breadcrumb
    const homeBreadcrumb = page.locator('nav[aria-label="Breadcrumb"] a:has-text("Home")');
    if (await homeBreadcrumb.count() > 0) {
      await homeBreadcrumb.click();
      await page.waitForLoadState('networkidle');
      expect(page.url()).toBe('http://localhost:3000/');
    }
  });

  test('project tools dropdown links should work', async ({ page }) => {
    // Open the Project Tools dropdown
    await page.click('button:has-text("Project Tools")');
    
    // Wait for dropdown to appear
    await page.waitForSelector('text=Core Tools', { timeout: 5000 });
    
    // Click on Documents link
    const documentsLink = page.locator('a:has-text("Documents")').first();
    await documentsLink.click();
    
    // Wait for navigation
    await page.waitForLoadState('networkidle');
    
    // Check that we navigated
    expect(page.url()).toContain('/documents');
  });

  test('team chat icon link should work', async ({ page }) => {
    // Click the team chat icon
    const chatButton = page.locator('a[href="/team-chat"]');
    await chatButton.click();
    
    // Wait for navigation
    await page.waitForLoadState('networkidle');
    
    // Check that we navigated to team chat
    expect(page.url()).toContain('/team-chat');
  });

  test('financial tools links should work', async ({ page }) => {
    // Open the Project Tools dropdown
    await page.click('button:has-text("Project Tools")');
    
    // Wait for dropdown to appear
    await page.waitForSelector('text=Financial Management', { timeout: 5000 });
    
    // Click on Prime Contracts link
    const contractsLink = page.locator('a:has-text("Prime Contracts")').first();
    await contractsLink.click();
    
    // Wait for navigation
    await page.waitForLoadState('networkidle');
    
    // Check that we navigated
    expect(page.url()).toContain('/contracts');
  });
});
