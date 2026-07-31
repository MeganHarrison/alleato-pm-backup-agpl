import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Sidebar Collapse Behavior', () => {
  test.use({ storageState: path.join(__dirname, '../.auth/user.json') });

  test('should verify sidebar collapse functionality', async ({ page }) => {
    // Listen to console logs from the page
    page.on('console', msg => {
      if (msg.text().includes('AppSidebar') || msg.text().includes('collapsible')) {
        console.log('PAGE LOG:', msg.text());
      }
    });

    // Set viewport to desktop size (md breakpoint is 768px)
    await page.setViewportSize({ width: 1280, height: 720 });

    // Step 1: Navigate to dashboard
    await page.goto('/dashboard');

    // Step 2: Wait for page load with networkidle
    await page.waitForLoadState('networkidle');

    // Step 3: Hard refresh the page to ensure latest code is loaded
    console.log('Performing hard refresh to load latest code...');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForLoadState('networkidle');

    // Additional wait to ensure all components are fully rendered
    await page.waitForTimeout(1000);

    // Debug: Let's see what data- attributes exist AND check the AppSidebar component
    const debugInfo = await page.evaluate(() => {
      const sidebar = document.querySelector('.group.peer');
      const sidebarInner = document.querySelector('[data-sidebar="sidebar"]');

      // Try to find the actual Sidebar element in React DevTools
      const sidebarElements = document.querySelectorAll('[data-collapsible]');

      return {
        sidebarOuter: sidebar ? {
          found: true,
          html: sidebar.outerHTML.substring(0, 500),
          attributes: Array.from(sidebar.attributes).map(attr => `${attr.name}=${attr.value}`)
        } : { found: false },
        sidebarInner: sidebarInner ? {
          found: true,
          attributes: Array.from(sidebarInner.attributes).map(attr => `${attr.name}=${attr.value}`)
        } : { found: false },
        allCollapsibleElements: Array.from(sidebarElements).map(el => ({
          tag: el.tagName,
          collapsible: el.getAttribute('data-collapsible'),
          classes: el.className
        }))
      };
    });
    console.log('Debug info:', JSON.stringify(debugInfo, null, 2));

    // Try to find by the classes we know exist
    const sidebarOuter = page.locator('.group.peer.text-sidebar-foreground').first();

    // The inner sidebar div
    const sidebarInner = page.locator('[data-sidebar="sidebar"]').first();
    await expect(sidebarInner).toBeVisible();

    // Step 4: Take screenshot of expanded sidebar
    console.log('Step 4: Taking screenshot of expanded sidebar...');
    await page.screenshot({
      path: 'tests/screenshots/sidebar-expanded.png',
      fullPage: true
    });

    // Check initial state - should be collapsed (defaultOpen=false in ConditionalLayout)
    const initialCollapsibleState = await sidebarOuter.getAttribute('data-collapsible');
    const initialState = await sidebarOuter.getAttribute('data-state');
    console.log('Initial data-collapsible:', initialCollapsibleState);
    console.log('Initial data-state:', initialState);

    // Check if section titles are visible when expanded
    const sectionTitles = page.locator('[data-sidebar="group-label"]');
    const sectionCount = await sectionTitles.count();
    console.log('Number of section titles found:', sectionCount);

    if (sectionCount > 0) {
      const firstSectionVisible = await sectionTitles.first().isVisible();
      console.log('First section title visible (expanded):', firstSectionVisible);
    }

    // Get sidebar width when expanded
    const expandedWidth = await sidebarInner.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width;
    });
    console.log('Sidebar width (expanded):', expandedWidth, 'px');

    // Step 5: Find and click the SidebarTrigger button to collapse
    console.log('Step 5: Finding and clicking sidebar trigger to collapse...');
    const sidebarTrigger = page.locator('[data-sidebar="trigger"]');
    await expect(sidebarTrigger).toBeVisible();
    await sidebarTrigger.click();

    // Step 6: Wait for animation to complete
    console.log('Step 6: Waiting for collapse animation...');
    await page.waitForTimeout(500);

    // Step 7: Take screenshot of collapsed sidebar
    console.log('Step 7: Taking screenshot of collapsed sidebar...');
    await page.screenshot({
      path: 'tests/screenshots/sidebar-collapsed.png',
      fullPage: true
    });

    // Step 8: Check the data-collapsible attribute on sidebar wrapper div
    console.log('Step 8: Checking data-collapsible attribute...');
    const collapsedCollapsibleState = await sidebarOuter.getAttribute('data-collapsible');
    const collapsedState = await sidebarOuter.getAttribute('data-state');
    console.log('Collapsed data-collapsible:', collapsedCollapsibleState);
    console.log('Collapsed data-state:', collapsedState);

    // Step 9: Check sidebar width when collapsed (should be around 64px, not 240px)
    console.log('Step 9: Measuring collapsed sidebar width...');
    const collapsedWidth = await sidebarInner.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width;
    });
    console.log('Sidebar width (collapsed):', collapsedWidth, 'px');

    // Check if section titles are hidden when collapsed
    if (sectionCount > 0) {
      const firstSectionVisibleCollapsed = await sectionTitles.first().isVisible();
      console.log('First section title visible (collapsed):', firstSectionVisibleCollapsed);
    }

    // Assertions
    console.log('\nAssertion Results:');
    console.log('- data-collapsible should be "icon":', collapsedCollapsibleState === 'icon' ? '✅' : '❌');
    console.log('- data-state should be "collapsed":', collapsedState === 'collapsed' ? '✅' : '❌');
    console.log('- Collapsed width should be less than expanded:', collapsedWidth < expandedWidth ? '✅' : '❌');
    console.log('- Collapsed width should be around 64px (50-100px):', collapsedWidth > 50 && collapsedWidth < 100 ? '✅' : '❌');

    expect(collapsedCollapsibleState).toBe('icon');
    expect(collapsedState).toBe('collapsed');
    expect(collapsedWidth).toBeLessThan(expandedWidth);
    expect(collapsedWidth).toBeGreaterThan(50);
    expect(collapsedWidth).toBeLessThan(100);

    // Section titles should be hidden when collapsed (or at least not taking space)
    if (sectionCount > 0) {
      const isTitleHidden = await sectionTitles.first().evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return styles.display === 'none' ||
               styles.visibility === 'hidden' ||
               styles.opacity === '0' ||
               parseInt(styles.width) === 0;
      });
      console.log('Section title hidden state (collapsed):', isTitleHidden);
      expect(isTitleHidden).toBe(true);
    }

    // Test expanding again
    await sidebarTrigger.click();
    await page.waitForTimeout(500);

    const reExpandedState = await sidebarOuter.getAttribute('data-state');
    console.log('Re-expanded data-state:', reExpandedState);
    expect(reExpandedState).toBe('expanded');
  });
});
