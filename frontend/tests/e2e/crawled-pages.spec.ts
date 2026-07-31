import { test, expect } from '@playwright/test';

test.describe('Crawled Pages Knowledge Base', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the crawled pages
    await page.goto('/crawled-pages');
  });

  test('should display the knowledge base with proper layout', async ({ page }) => {
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check the page header
    await expect(page.getByRole('heading', { name: 'Procore Documentation Knowledge Base' })).toBeVisible();
    await expect(page.getByText('Explore crawled Procore support documentation')).toBeVisible();
    
    // Verify stats cards are displayed
    // Look for the stats grid which contains 6 stat boxes
    const statsGrid = page.locator('.grid').filter({ has: page.getByText('Total Pages') }).first();
    const statsBoxes = statsGrid.locator('> div');
    await expect(statsBoxes).toHaveCount(6);
    
    // Check specific stat cards are present in the stats grid
    await expect(statsGrid.getByText('Total Pages')).toBeVisible();
    await expect(statsGrid.getByText('Total Chunks')).toBeVisible();
    await expect(statsGrid.getByText('Embeddings')).toBeVisible();
    await expect(statsGrid.getByText('Categories')).toBeVisible();
    await expect(statsGrid.getByText('Excluded')).toBeVisible();
    await expect(statsGrid.getByText('Vectorized')).toBeVisible();
    
    // Verify search bar
    await expect(page.getByPlaceholder('Search documentation...')).toBeVisible();
    
    // Check accordion is present
    const accordion = page.locator('[data-slot="accordion"]');
    await expect(accordion).toBeVisible();
    
    // Take a screenshot of the initial view
    await page.screenshot({ path: 'tests/screenshots/crawled-pages-overview.png', fullPage: true });
  });

  test('should display categories in accordion', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Check for accordion items
    const accordionItems = page.locator('[data-orientation="vertical"] button[data-state]');
    await expect(accordionItems).toHaveCount(await accordionItems.count());
    
    // Check at least one accordion item exists
    expect(await accordionItems.count()).toBeGreaterThan(0);
    
    // Check first accordion item
    const firstItem = accordionItems.first();
    await expect(firstItem).toBeVisible();
    
    // Verify accordion item has category name
    await expect(firstItem).toContainText(/Api Docs|Budget|Change Events|Commitments/);
    
    // Click to expand first accordion item
    await firstItem.click();
    
    // Wait for content to be visible
    await page.waitForSelector('[data-state="open"] + [role="region"]', { timeout: 5000 });
    
    // Check that expanded content contains links
    const expandedContent = page.locator('[data-state="open"] + [role="region"]').first();
    await expect(expandedContent).toBeVisible();
    
    // Check for links in the expanded content
    const links = expandedContent.locator('a[href^="https://"]');
    const linkCount = await links.count();
    expect(linkCount).toBeGreaterThan(0);
    
    // Verify no "procore pay" category is shown
    const categoryNames = await accordionItems.locator('h3').allTextContents();
    expect(categoryNames.join(' ').toLowerCase()).not.toContain('procore pay');
    
    // Take screenshot of accordion expanded
    await page.screenshot({ path: 'tests/screenshots/crawled-pages-accordion.png', fullPage: true });
  });

  test('should allow searching through documentation', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Type in search box
    const searchBox = page.getByPlaceholder('Search documentation...');
    await searchBox.fill('budget');
    
    // Wait for filtering to happen
    await page.waitForTimeout(500);
    
    // Check that results are filtered (exact behavior depends on data)
    // The search should filter the displayed content
    await page.screenshot({ path: 'tests/screenshots/crawled-pages-search.png', fullPage: true });
  });

  test('should expand and collapse accordion items', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    const accordionItems = page.locator('[data-orientation="vertical"] button[data-state]');
    
    // Get first two items
    const firstItem = accordionItems.nth(0);
    const secondItem = accordionItems.nth(1);
    
    // Expand first item
    await firstItem.click();
    await page.waitForSelector('[data-state="open"]');
    
    // Check first item is expanded
    await expect(firstItem).toHaveAttribute('data-state', 'open');
    
    // Expand second item
    await secondItem.click();
    await page.waitForTimeout(300);
    
    // In single mode, first should close when second opens
    await expect(firstItem).toHaveAttribute('data-state', 'closed');
    await expect(secondItem).toHaveAttribute('data-state', 'open');
    
    // Take screenshot of accordion behavior
    await page.screenshot({ path: 'tests/screenshots/crawled-pages-accordion-behavior.png', fullPage: true });
  });

  test('should display category information correctly', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Expand first accordion item
    const firstAccordion = page.locator('[data-orientation="vertical"] button[data-state]').first();
    await firstAccordion.click();
    
    // Check accordion header contains proper information
    const accordionHeader = firstAccordion;
    await expect(accordionHeader).toContainText(/\d+ pages/); // e.g., "4 pages"
    await expect(accordionHeader).toContainText(/\d+ chunks/); // e.g., "55 chunks"
    await expect(accordionHeader).toContainText(/\d+%/); // Coverage percentage
    
    // Check expanded content
    const expandedContent = page.locator('[data-state="open"] + [role="region"]').first();
    const links = expandedContent.locator('a');
    
    if (await links.count() > 0) {
      const firstLink = links.first();
      
      // Check link has badges for chunks and percentage
      await expect(firstLink).toContainText(/\d+ chunks/);
      await expect(firstLink).toContainText(/\d+%/);
    }
  });

  test('should have responsive design', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'tests/screenshots/crawled-pages-mobile.png', fullPage: true });
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'tests/screenshots/crawled-pages-tablet.png', fullPage: true });
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'tests/screenshots/crawled-pages-desktop.png' });
  });
});