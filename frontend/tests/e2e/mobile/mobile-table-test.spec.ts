import { test, expect, devices } from '@playwright/test'

test.describe('Mobile Table Responsiveness', () => {
  test('should show filter icon instead of filters on mobile', async ({ page, context }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 }) // iPhone 12 dimensions
    // Navigate to commitments page
    await page.goto('/commitments')
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    
    // Check that desktop filters are hidden
    await expect(page.locator('[data-testid="desktop-filters"]')).not.toBeVisible()
    
    // Check that mobile filter button is visible
    const filterButton = page.locator('button:has-text("Open filters")')
    await expect(filterButton).toBeVisible()
    
    // Check for filter indicator if filters are active
    const filterIndicator = page.locator('.absolute.-top-1.-right-1')
    
    // Click filter button to open modal
    await filterButton.click()
    
    // Check that filter modal is open
    await expect(page.locator('[role="dialog"]:has-text("Filters")')).toBeVisible()
    
    // Take screenshot of mobile filter modal
    await page.screenshot({ 
      path: 'tests/screenshots/mobile-filter-modal.png',
      fullPage: false 
    })
  })

  test('should show cards instead of table on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/commitments')
    await page.waitForLoadState('networkidle')
    
    // Check that desktop table is hidden
    await expect(page.locator('table')).not.toBeVisible()
    
    // Check that mobile cards are visible
    await expect(page.locator('[data-testid="mobile-card"]').first()).toBeVisible()
    
    // Take screenshot of mobile cards
    await page.screenshot({ 
      path: 'tests/screenshots/mobile-table-cards.png',
      fullPage: true 
    })
  })

  test('should have mobile-friendly pagination', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/commitments')
    await page.waitForLoadState('networkidle')
    
    // Check for mobile pagination layout
    const mobilePagination = page.locator('.flex.flex-col.gap-4').first()
    await expect(mobilePagination).toBeVisible()
    
    // Check for Previous/Next buttons with text
    await expect(page.locator('button:has-text("Previous")')).toBeVisible()
    await expect(page.locator('button:has-text("Next")')).toBeVisible()
    
    // Check page indicator
    await expect(page.locator('text=/\\d+ \\/ \\d+/')).toBeVisible()
  })
})

test.describe('Desktop Table View', () => {
  test.use({ viewport: { width: 1280, height: 720 } })

  test('should show full table and filters on desktop', async ({ page }) => {
    await page.goto('/commitments')
    await page.waitForLoadState('networkidle')
    
    // Check that table is visible
    await expect(page.locator('table')).toBeVisible()
    
    // Check that desktop filters are visible
    await expect(page.locator('.hidden.lg\\:flex').first()).toBeVisible()
    
    // Check that mobile filter button is hidden
    await expect(page.locator('button:has-text("Open filters")')).not.toBeVisible()
    
    // Take screenshot of desktop view
    await page.screenshot({ 
      path: 'tests/screenshots/desktop-table-view.png',
      fullPage: false 
    })
  })
})