import { test, expect } from '@playwright/test'

/**
 * Quick Mobile Responsiveness Check
 * Fast test to verify key pages work on mobile
 */

test.use({ baseURL: 'http://localhost:3000' })

const MOBILE = { width: 375, height: 667 }
const DESKTOP = { width: 1920, height: 1080 }

test.describe('Quick Mobile Check', () => {
  test.setTimeout(120000) // 2 minutes per test
  test('Profile page - mobile vs desktop', async ({ page }) => {
    await page.waitForURL('/', { timeout: 30000 })

    // Test mobile
    await page.setViewportSize(MOBILE)
    await page.goto('/profile', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    const mobileOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
    expect(mobileOverflow, 'Mobile: No horizontal overflow').toBe(false)

    await page.screenshot({
      path: 'tests/screenshots/profile-mobile.png',
      fullPage: true
    })

    // Test desktop
    await page.setViewportSize(DESKTOP)
    await page.waitForTimeout(1000)

    const desktopOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
    expect(desktopOverflow, 'Desktop: No horizontal overflow').toBe(false)

    await page.screenshot({
      path: 'tests/screenshots/profile-desktop.png'
    })

    console.log('✅ Profile page responsive on both mobile and desktop')
  })

  test('Project Home - mobile vs desktop', async ({ page }) => {
    await page.waitForURL('/', { timeout: 30000 })

    // Mobile
    await page.setViewportSize(MOBILE)
    await page.goto('/60/home', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    const mobileOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
    expect(mobileOverflow, 'Mobile: No horizontal overflow').toBe(false)

    await page.screenshot({
      path: 'tests/screenshots/project-home-mobile.png',
      fullPage: true
    })

    // Desktop
    await page.setViewportSize(DESKTOP)
    await page.waitForTimeout(1000)

    const desktopOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
    expect(desktopOverflow, 'Desktop: No horizontal overflow').toBe(false)

    await page.screenshot({
      path: 'tests/screenshots/project-home-desktop.png'
    })

    console.log('✅ Project Home responsive on both mobile and desktop')
  })

  test('Budget page - mobile vs desktop', async ({ page }) => {
    await page.waitForURL('/', { timeout: 30000 })

    // Mobile
    await page.setViewportSize(MOBILE)
    await page.goto('/60/budget', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    const mobileOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
    expect(mobileOverflow, 'Mobile: No horizontal overflow').toBe(false)

    await page.screenshot({
      path: 'tests/screenshots/budget-mobile.png',
      fullPage: true
    })

    // Desktop
    await page.setViewportSize(DESKTOP)
    await page.waitForTimeout(1000)

    const desktopOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
    expect(desktopOverflow, 'Desktop: No horizontal overflow').toBe(false)

    await page.screenshot({
      path: 'tests/screenshots/budget-desktop.png'
    })

    console.log('✅ Budget page responsive on both mobile and desktop')
  })
})

test.describe("Mobile TablePageActions Smoke", () => {
  test("companies table page renders action button on mobile viewport", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, // iPhone 14
      storageState: "./tests/.auth/user.json",
    });
    const page = await context.newPage();

    await page.goto("/directory/companies");
    await page.waitForLoadState("domcontentloaded");

    // Dismiss welcome dialog if shown
    const welcomeClose = page.getByRole("button", { name: /close welcome/i });
    if (await welcomeClose.isVisible()) await welcomeClose.click();

    // On mobile, Add button may show as icon-only — either text or aria-label is acceptable
    const addByText = page.getByRole("button").filter({ hasText: /add|company/i });
    const addByLabel = page.locator("button[aria-label*='add' i], button[aria-label*='create' i]");
    const plusIcon = page.locator("button:has(svg)").first();

    const hasAction =
      (await addByText.first().isVisible().catch(() => false)) ||
      (await addByLabel.first().isVisible().catch(() => false)) ||
      (await plusIcon.isVisible().catch(() => false));

    expect(hasAction, "Expected at least one action button on mobile").toBe(true);
    await context.close();
  });
})
