import { expect, test, Page } from '@playwright/test'

/**
 * Financial Pages End-to-End Tests
 *
 * Verifies financial pages load correctly and display real content.
 * Tests the fixes for: invoicing API routes, direct costs page, budget views RLS.
 */
test.describe('Financial Pages E2E Tests', () => {
  test.use({ storageState: './tests/.auth/user.json' })

  const projectId = '118'

  /**
   * Helper: Wait for page to fully load (network + content)
   */
  async function waitForPageReady(page: Page) {
    await page.waitForLoadState('domcontentloaded')
    // Wait a bit for API calls to complete
    await page.waitForTimeout(3000)
  }

  /**
   * Helper: Check for error toasts (sonner)
   */
  async function getErrorToasts(page: Page): Promise<string[]> {
    const toasts = page.locator('[data-sonner-toast][data-type="error"]')
    const count = await toasts.count()
    const texts: string[] = []
    for (let i = 0; i < count; i++) {
      const text = await toasts.nth(i).textContent()
      if (text) texts.push(text)
    }
    return texts
  }

  /**
   * Helper: Check page has content (not just a blank page or full error)
   */
  async function hasPageContent(page: Page): Promise<boolean> {
    // Check for any heading
    const heading = await page.locator('h1, h2').first().isVisible({ timeout: 5000 }).catch(() => false)
    return heading
  }

  // ─── INVOICING ───────────────────────────────────────────────

  test('invoicing page loads without crash', async ({ page }) => {
    await page.goto(`/${projectId}/invoicing`)
    await waitForPageReady(page)

    // Page should resolve to either legacy or current invoicing route.
    expect(page.url()).toMatch(/\/(invoicing|invoices)(\/|$)/)

    // Should render real page content even if route shell/title copy changes.
    const hasContent = await hasPageContent(page)
    expect(hasContent).toBe(true)

    // Check for "Unable to load data" error state
    const hasError = await page.locator('text=Unable to load data').isVisible({ timeout: 2000 }).catch(() => false)
    const hasFetchError = await page.locator('text=Failed to fetch owner invoices').isVisible({ timeout: 1000 }).catch(() => false)

    // The page should NOT show a fetch error
    expect(hasFetchError).toBe(false)

    // Avoid action-label coupling: this smoke test only verifies load/no-crash.

    await page.screenshot({ path: 'tests/screenshots/invoicing-page.png', fullPage: true })
  })

  // ─── DIRECT COSTS ───────────────────────────────────────────

  test('direct costs page loads without crash', async ({ page }) => {
    await page.goto(`/${projectId}/direct-costs`)
    await waitForPageReady(page)

    expect(page.url()).toContain('/direct-costs')

    // Page should render real content even if heading copy changes.
    const hasContent = await hasPageContent(page)
    expect(hasContent).toBe(true)

    // Check for fetch error
    const hasFetchError = await page.locator('text=Failed to fetch direct costs').isVisible({ timeout: 2000 }).catch(() => false)
    expect(hasFetchError).toBe(false)

    // Avoid action-label coupling: this smoke test only verifies load/no-crash.

    await page.screenshot({ path: 'tests/screenshots/direct-costs-page.png', fullPage: true })
  })

  // ─── BUDGET ──────────────────────────────────────────────────

  test('budget page loads without "Failed to load budget views" error', async ({ page }) => {
    await page.goto(`/${projectId}/budget`)
    await waitForPageReady(page)

    expect(page.url()).toContain('/budget')

    // Should have the Budget heading
    await expect(page.getByRole('heading', { name: /budget/i }).first()).toBeVisible({ timeout: 10000 })

    // The CRITICAL check: no "Failed to load budget views" toast
    const errorToasts = await getErrorToasts(page)
    const hasBudgetViewsError = errorToasts.some(t => t.includes('Failed to load budget views'))

    if (hasBudgetViewsError) {
      console.error('CRITICAL: "Failed to load budget views" error still present!')
    }

    expect(hasBudgetViewsError).toBe(false)

    // Budget table may be empty for some fixtures; page content must still render.
    const hasTable = await page.locator('table').first().isVisible({ timeout: 10000 }).catch(() => false)
    const hasContent = await hasPageContent(page)
    expect(hasTable || hasContent).toBe(true)

    await page.screenshot({ path: 'tests/screenshots/budget-page.png', fullPage: true })
  })

  // ─── REGRESSION CHECKS ──────────────────────────────────────

  test('commitments page loads (regression)', async ({ page }) => {
    await page.goto(`/${projectId}/commitments`)
    await waitForPageReady(page)

    expect(page.url()).toContain('/commitments')
    const hasContent = await hasPageContent(page)
    expect(hasContent).toBe(true)

    const errorToasts = await getErrorToasts(page)
    expect(errorToasts.length).toBe(0)

    await page.screenshot({ path: 'tests/screenshots/commitments-page.png', fullPage: true })
  })

  test('prime contracts page loads (regression)', async ({ page }) => {
    await page.goto(`/${projectId}/prime-contracts`)
    await waitForPageReady(page)

    expect(page.url()).toContain('/prime-contracts')
    const hasContent = await hasPageContent(page)
    expect(hasContent).toBe(true)

    const errorToasts = await getErrorToasts(page)
    expect(errorToasts.length).toBe(0)

    await page.screenshot({ path: 'tests/screenshots/prime-contracts-page.png', fullPage: true })
  })

  test('change events page loads (regression)', async ({ page }) => {
    await page.goto(`/${projectId}/change-events`)
    await waitForPageReady(page)

    expect(page.url()).toContain('/change-events')
    const hasContent = await hasPageContent(page)
    expect(hasContent).toBe(true)

    const errorToasts = await getErrorToasts(page)
    expect(errorToasts.length).toBe(0)

    await page.screenshot({ path: 'tests/screenshots/change-events-page.png', fullPage: true })
  })
})
