import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Sidebar Dashboard Tests', () => {
  test('should display sidebar correctly on dashboard', async ({ page, context }) => {
    // Step 1: Clear cookies and localStorage for fresh state
    console.log('Clearing cookies and localStorage...');
    await context.clearCookies();
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    // Step 2: Re-authenticate by loading saved auth state
    console.log('Loading authentication state...');
    const authFile = path.join(__dirname, '../.auth/user.json');
    const authData = require('fs').readFileSync(authFile, 'utf-8');
    const parsedAuth = JSON.parse(authData);

    // Add auth cookies
    await context.addCookies(parsedAuth.cookies || []);

    // Inject auth into localStorage if available
    if (parsedAuth.origins && parsedAuth.origins.length > 0) {
      const origin = parsedAuth.origins[0];
      await page.goto(origin.origin);

      for (const item of origin.localStorage || []) {
        await page.evaluate(({ name, value }) => {
          localStorage.setItem(name, value);
        }, item);
      }
    }

    // Step 3: Navigate to dashboard
    console.log('Navigating to dashboard...');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Wait for sidebar to render
    await page.waitForTimeout(1000); // Allow React to render

    // Step 4: Take screenshot
    console.log('Capturing screenshot...');
    await page.screenshot({
      path: 'tests/screenshots/sidebar-dashboard-test.png',
      fullPage: true,
    });
    console.log('Screenshot saved to: tests/screenshots/sidebar-dashboard-test.png');

    // Step 5: Measure sidebar state
    console.log('Measuring sidebar dimensions...');

    // Look for sidebar element - try multiple possible selectors
    const sidebarSelectors = [
      '[data-sidebar="sidebar"]',
      'aside[role="complementary"]',
      '.sidebar',
      'nav[class*="sidebar"]',
      '[class*="SidebarProvider"]',
    ];

    let sidebar = null;
    let sidebarSelector = '';

    for (const selector of sidebarSelectors) {
      const element = page.locator(selector).first();
      const count = await element.count();
      if (count > 0) {
        sidebar = element;
        sidebarSelector = selector;
        console.log(`Found sidebar using selector: ${selector}`);
        break;
      }
    }

    if (!sidebar) {
      console.log('Could not find sidebar with standard selectors. Searching for any nav element...');
      sidebar = page.locator('aside, nav').first();
      sidebarSelector = 'aside, nav';
    }

    // Get sidebar dimensions
    const boundingBox = await sidebar.boundingBox();
    const sidebarWidth = boundingBox ? boundingBox.width : 0;

    console.log('\n=== SIDEBAR MEASUREMENTS ===');
    console.log(`Selector used: ${sidebarSelector}`);
    console.log(`Width: ${sidebarWidth}px`);

    // Determine state based on width
    let state = 'UNKNOWN';
    if (sidebarWidth >= 200) {
      state = 'EXPANDED';
    } else if (sidebarWidth >= 40 && sidebarWidth < 200) {
      state = 'COLLAPSED';
    }
    console.log(`State: ${state}`);

    // Step 6: Check for section headings and navigation items
    console.log('\n=== VISIBLE CONTENT ===');

    // Look for section headings (multiple possible patterns)
    const headingSelectors = [
      'h2',
      'h3',
      '[role="heading"]',
      '.sidebar-section-title',
      '[class*="heading"]',
    ];

    const headings: string[] = [];
    for (const selector of headingSelectors) {
      const elements = await page.locator(selector).all();
      for (const element of elements) {
        const text = await element.textContent();
        if (text && text.trim() && !headings.includes(text.trim())) {
          headings.push(text.trim());
        }
      }
    }

    console.log('\nSection Headings Found:');
    if (headings.length === 0) {
      console.log('  - None found');
    } else {
      headings.forEach(heading => console.log(`  - ${heading}`));
    }

    // Look for navigation items
    const navItemSelectors = [
      'a[href]',
      'button[role="menuitem"]',
      '[role="link"]',
      '.nav-item',
      '[class*="nav-link"]',
    ];

    const navItems: string[] = [];
    for (const selector of navItemSelectors) {
      const elements = await page.locator(selector).all();
      for (const element of elements) {
        const text = await element.textContent();
        if (text && text.trim() && !navItems.includes(text.trim())) {
          navItems.push(text.trim());
        }
      }
    }

    console.log('\nNavigation Items Found:');
    if (navItems.length === 0) {
      console.log('  - None found');
    } else {
      navItems.slice(0, 20).forEach(item => console.log(`  - ${item}`)); // Limit to first 20
      if (navItems.length > 20) {
        console.log(`  ... and ${navItems.length - 20} more`);
      }
    }

    // Step 7: Report summary
    console.log('\n=== SUMMARY ===');
    console.log(`Sidebar State: ${state}`);
    console.log(`Sidebar Width: ${sidebarWidth}px`);
    console.log(`Section Headings: ${headings.length} found`);
    console.log(`Navigation Items: ${navItems.length} found`);
    console.log('\n===================\n');

    // Assertions
    expect(sidebarWidth).toBeGreaterThan(0); // Sidebar should exist and have width
    expect(sidebar).toBeTruthy(); // Sidebar element should exist
  });
});
