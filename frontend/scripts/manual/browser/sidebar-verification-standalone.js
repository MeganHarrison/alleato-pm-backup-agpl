const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Step 1: Navigating to http://localhost:3000');
  await page.goto('http://localhost:3000');

  console.log('Step 2: Hard refresh (reload with waitUntil networkidle)');
  await page.reload({ waitUntil: 'networkidle' });

  // Check if login is required
  const emailInput = page.locator('input[type="email"]');
  const isLoginPage = await emailInput.isVisible({ timeout: 2000 }).catch(() => false);

  if (isLoginPage) {
    console.log('Login page detected - authenticating with test1@mail.com');
    await emailInput.fill('test1@mail.com');
    await page.locator('input[type="password"]').fill('test12026!!!');
    await page.locator('button[type="submit"]').click();
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    console.log('Login complete');
  } else {
    console.log('Already authenticated or no login required');
  }

  // Wait for sidebar
  console.log('Waiting for sidebar to be visible...');
  await page.waitForSelector('[data-sidebar]', { state: 'visible', timeout: 10000 });
  await page.waitForTimeout(1000);

  // STEP 3: Screenshot EXPANDED state
  console.log('\n=== STEP 3: Taking screenshot of EXPANDED sidebar ===');
  await page.screenshot({
    path: 'sidebar-expanded-fixed.png',
    fullPage: true
  });
  console.log('Screenshot saved: sidebar-expanded-fixed.png');

  // Analyze EXPANDED state
  console.log('\n=== EXPANDED SIDEBAR ANALYSIS ===');

  const sidebar = page.locator('[data-sidebar="sidebar"]').first();
  const sidebarBox = await sidebar.boundingBox();
  console.log(`Sidebar width: ${sidebarBox?.width}px (expected ~256px)`);
  console.log(`Sidebar is wider (expected)? ${sidebarBox?.width > 200 ? 'YES ✓' : 'NO ✗'}`);

  // Check for section headings
  const sectionHeadings = [
    'Core Tools',
    'Project Management',
    'Financial Management',
    'Admin'
  ];

  console.log('\nSection headings visibility:');
  for (const heading of sectionHeadings) {
    const headingElement = page.locator(`text="${heading}"`);
    const isVisible = await headingElement.isVisible().catch(() => false);
    console.log(`  "${heading}": ${isVisible ? 'VISIBLE ✓' : 'HIDDEN ✗'}`);
  }

  // Check navigation items
  const navItems = page.locator('[data-sidebar-menu-item]');
  const navCount = await navItems.count();
  console.log(`\nNavigation items found: ${navCount}`);

  if (navCount > 0) {
    const firstNavItem = navItems.first();
    const firstNavText = await firstNavItem.textContent();
    console.log(`First nav item text: "${firstNavText?.trim()}"`);
    console.log(`Has text labels? ${firstNavText?.trim()?.length > 0 ? 'YES ✓' : 'NO ✗'}`);
  }

  // STEP 5: Click toggle to COLLAPSE
  console.log('\n=== STEP 5: Clicking sidebar toggle to COLLAPSE ===');
  const toggleButton = page.locator('[data-sidebar-trigger]');
  const toggleExists = await toggleButton.isVisible().catch(() => false);
  console.log(`Toggle button visible? ${toggleExists ? 'YES' : 'NO'}`);

  if (toggleExists) {
    await toggleButton.click();
    console.log('Toggle clicked');
  } else {
    console.log('WARNING: Toggle button not found, trying alternative selector');
    const altToggle = page.locator('button').filter({ hasText: /toggle/i });
    await altToggle.first().click();
  }

  // STEP 6: Wait for animation
  console.log('\n=== STEP 6: Waiting 1 second for animation ===');
  await page.waitForTimeout(1000);

  // STEP 7: Screenshot COLLAPSED state
  console.log('\n=== STEP 7: Taking screenshot of COLLAPSED sidebar ===');
  await page.screenshot({
    path: 'sidebar-collapsed-fixed.png',
    fullPage: true
  });
  console.log('Screenshot saved: sidebar-collapsed-fixed.png');

  // STEP 8: Analyze COLLAPSED state
  console.log('\n=== STEP 8: COLLAPSED SIDEBAR ANALYSIS ===');

  const collapsedBox = await sidebar.boundingBox();
  console.log(`Sidebar width: ${collapsedBox?.width}px (expected ~64px)`);
  console.log(`Sidebar is narrow (expected)? ${collapsedBox?.width < 100 ? 'YES ✓' : 'NO ✗'}`);

  console.log('\nSection headings visibility (should be HIDDEN):');
  for (const heading of sectionHeadings) {
    const headingElement = page.locator(`text="${heading}"`);
    const isVisible = await headingElement.isVisible().catch(() => false);
    console.log(`  "${heading}": ${isVisible ? 'VISIBLE ✗ (SHOULD BE HIDDEN)' : 'HIDDEN ✓'}`);
  }

  const collapsedNavItems = page.locator('[data-sidebar-menu-item]');
  const collapsedNavCount = await collapsedNavItems.count();
  console.log(`\nNavigation items still present: ${collapsedNavCount}`);

  // Check for icons
  const icons = page.locator('svg[data-icon], svg.lucide');
  const iconCount = await icons.count();
  console.log(`Icons visible: ${iconCount} (only icons should be visible now)`);

  console.log('\n=== VERIFICATION COMPLETE ===');
  console.log('\nScreenshots saved:');
  console.log('  ✓ sidebar-expanded-fixed.png');
  console.log('  ✓ sidebar-collapsed-fixed.png');
  console.log('\nPlease review the screenshots to verify:');
  console.log('  EXPANDED: Wide sidebar (~256px) with section headings and text labels');
  console.log('  COLLAPSED: Narrow sidebar (~64px) with only icons, no headings/text');

  await browser.close();
})();
