import { test, expect } from '@playwright/test'

/**
 * Comprehensive Mobile & Desktop Responsiveness Test Suite
 *
 * Tests all major pages on both mobile and desktop viewports to ensure:
 * - No horizontal overflow
 * - Content is properly contained
 * - Layout adapts appropriately
 * - Interactive elements are accessible
 */

// Configure baseURL
test.use({ baseURL: 'http://localhost:3000' })

const MOBILE_VIEWPORT = { width: 375, height: 667 } // iPhone SE
const DESKTOP_VIEWPORT = { width: 1920, height: 1080 } // Full HD

const TEST_PAGES = [
  { path: '/profile', name: 'Profile' },
  { path: '/60/home', name: 'Project Home' },
  { path: '/60/budget', name: 'Budget' },
  { path: '/60/contracts', name: 'Contracts' },
  { path: '/60/commitments', name: 'Commitments' },
  { path: '/60/meetings', name: 'Meetings' },
  { path: '/directory', name: 'Directory' },
  { path: '/directory/companies', name: 'Companies' },
  { path: '/directory/contacts', name: 'Contacts' },
  { path: '/', name: 'Projects List' },
  { path: '/daily-logs', name: 'Daily Logs' },
  { path: '/daily-reports', name: 'Daily Reports' },
  { path: '/insights', name: 'Insights' },
  { path: '/opportunities', name: 'Opportunities' },
  { path: '/risks', name: 'Risks' },
  { path: '/tasks', name: 'Tasks' },
]

// Helper to check for horizontal overflow
async function checkNoHorizontalOverflow(page) {
  const hasHorizontalScroll = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth
  })
  return !hasHorizontalScroll
}

// Helper to get page dimensions
async function getPageDimensions(page) {
  return await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
  }))
}

test.describe('Mobile Responsiveness Tests', () => {
  test.use({ viewport: MOBILE_VIEWPORT })

  test.beforeEach(async ({ page }) => {
    await page.waitForURL('/', { timeout: 10000 })
  })

  for (const testPage of TEST_PAGES) {
    test(`${testPage.name} - Mobile viewport`, async ({ page }) => {
      await page.goto(testPage.path)
      await page.waitForLoadState('networkidle')

      // Wait for any loading states to complete
      await page.waitForTimeout(1000)

      // Check for horizontal overflow
      const noOverflow = await checkNoHorizontalOverflow(page)
      const dimensions = await getPageDimensions(page)

      expect(noOverflow,
        `Page has horizontal overflow: scrollWidth(${dimensions.scrollWidth}) > clientWidth(${dimensions.clientWidth})`
      ).toBe(true)

      // Take screenshot for visual verification
      await page.screenshot({
        path: `tests/screenshots/mobile/${testPage.name.toLowerCase().replace(/\s+/g, '-')}.png`,
        fullPage: true,
      })

      // Verify page header is visible
      const header = page.locator('header')
      await expect(header).toBeVisible()

      // Verify no elements are cut off (check if content fits in viewport)
      const bodyWidth = await page.locator('body').evaluate(el => el.scrollWidth)
      const viewportWidth = page.viewportSize()?.width || 375
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth)
    })
  }
})

test.describe('Desktop Responsiveness Tests', () => {
  test.use({ viewport: DESKTOP_VIEWPORT })

  test.beforeEach(async ({ page }) => {
    await page.waitForURL('/', { timeout: 10000 })
  })

  for (const testPage of TEST_PAGES) {
    test(`${testPage.name} - Desktop viewport`, async ({ page }) => {
      await page.goto(testPage.path)
      await page.waitForLoadState('networkidle')

      // Wait for any loading states to complete
      await page.waitForTimeout(1000)

      // Check for horizontal overflow
      const noOverflow = await checkNoHorizontalOverflow(page)
      const dimensions = await getPageDimensions(page)

      expect(noOverflow,
        `Page has horizontal overflow: scrollWidth(${dimensions.scrollWidth}) > clientWidth(${dimensions.clientWidth})`
      ).toBe(true)

      // Take screenshot for visual verification
      await page.screenshot({
        path: `tests/screenshots/desktop/${testPage.name.toLowerCase().replace(/\s+/g, '-')}.png`,
        fullPage: false, // Just viewport on desktop
      })

      // Verify page header is visible
      const header = page.locator('header')
      await expect(header).toBeVisible()

      // Verify sidebar is present
      const sidebar = page.locator('[data-sidebar="sidebar"]')
      await expect(sidebar).toBeAttached()
    })
  }
})

test.describe('Responsive Layout Transitions', () => {
  test('Layout adapts between mobile and desktop breakpoints', async ({ page }) => {
    await page.waitForURL('/', { timeout: 10000 })

    await page.goto('/profile')
    await page.waitForLoadState('networkidle')

    // Test mobile viewport
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.waitForTimeout(500)

    let noOverflow = await checkNoHorizontalOverflow(page)
    expect(noOverflow, 'Mobile: Page should not have horizontal overflow').toBe(true)

    await page.screenshot({
      path: 'tests/screenshots/responsive/profile-mobile.png',
      fullPage: true,
    })

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.waitForTimeout(500)

    noOverflow = await checkNoHorizontalOverflow(page)
    expect(noOverflow, 'Tablet: Page should not have horizontal overflow').toBe(true)

    await page.screenshot({
      path: 'tests/screenshots/responsive/profile-tablet.png',
      fullPage: true,
    })

    // Test desktop viewport
    await page.setViewportSize(DESKTOP_VIEWPORT)
    await page.waitForTimeout(500)

    noOverflow = await checkNoHorizontalOverflow(page)
    expect(noOverflow, 'Desktop: Page should not have horizontal overflow').toBe(true)

    await page.screenshot({
      path: 'tests/screenshots/responsive/profile-desktop.png',
      fullPage: false,
    })
  })
})

test.describe('Critical UI Elements - Mobile', () => {
  test.use({ viewport: MOBILE_VIEWPORT })

  test.beforeEach(async ({ page }) => {
    await page.waitForURL('/', { timeout: 10000 })
  })

  test('Sidebar menu is accessible on mobile', async ({ page }) => {
    await page.goto('/profile')

    // Check if sidebar trigger button is visible
    const sidebarTrigger = page.locator('[data-sidebar="trigger"]')
    await expect(sidebarTrigger).toBeVisible()

    // Click to open sidebar
    await sidebarTrigger.click()
    await page.waitForTimeout(500)

    // Verify sidebar opens
    const sidebar = page.locator('[data-sidebar="sidebar"]')
    await expect(sidebar).toBeVisible()

    await page.screenshot({
      path: 'tests/screenshots/mobile/sidebar-open.png',
      fullPage: true,
    })
  })

  test('Header navigation works on mobile', async ({ page }) => {
    await page.goto('/60/home')

    // Verify header is visible
    const header = page.locator('header')
    await expect(header).toBeVisible()

    // Check project switcher is accessible
    const projectSwitcher = header.locator('button').filter({ hasText: /project/i }).first()
    if (await projectSwitcher.isVisible()) {
      await projectSwitcher.click()
      await page.waitForTimeout(300)

      await page.screenshot({
        path: 'tests/screenshots/mobile/project-switcher-open.png',
        fullPage: true,
      })
    }
  })

  test('Cards and content are readable on mobile', async ({ page }) => {
    await page.goto('/profile')
    await page.waitForLoadState('networkidle')

    // Find all cards
    const cards = page.locator('[class*="card"]').first()

    if (await cards.isVisible()) {
      const cardBox = await cards.boundingBox()
      const viewportWidth = page.viewportSize()?.width || 375

      // Card should not be wider than viewport
      expect(cardBox?.width).toBeLessThanOrEqual(viewportWidth)
    }
  })
})

test.describe('Form Elements - Mobile', () => {
  test.use({ viewport: MOBILE_VIEWPORT })

  test.beforeEach(async ({ page }) => {
    await page.waitForURL('/', { timeout: 10000 })
  })

  test('Form inputs are usable on mobile', async ({ page }) => {
    // Navigate to a page with forms
    await page.goto('/60/contracts/new')
    await page.waitForLoadState('networkidle')

    // Check that inputs don't overflow
    const noOverflow = await checkNoHorizontalOverflow(page)
    expect(noOverflow, 'Form page should not have horizontal overflow').toBe(true)

    // Take screenshot
    await page.screenshot({
      path: 'tests/screenshots/mobile/form-page.png',
      fullPage: true,
    })

    // Verify inputs are within viewport
    const inputs = page.locator('input[type="text"]').first()
    if (await inputs.isVisible()) {
      const inputBox = await inputs.boundingBox()
      const viewportWidth = page.viewportSize()?.width || 375
      expect(inputBox?.width).toBeLessThanOrEqual(viewportWidth)
    }
  })
})
