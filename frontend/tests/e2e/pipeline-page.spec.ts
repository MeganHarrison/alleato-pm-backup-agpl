import { test, expect } from '@playwright/test'

test.describe('Pipeline Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to pipeline page
    await page.goto('http://localhost:3000/admin/documents/pipeline')
  })

  test('should load the pipeline page without errors', async ({ page }) => {
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle')

    // Check that we're not redirected to login
    await expect(page).not.toHaveURL(/\/auth\/login/)

    // Check for page title
    await expect(page.getByRole('heading', { name: 'Document Pipeline Management' })).toBeVisible({ timeout: 10000 })
  })

  test('should display pipeline phases', async ({ page }) => {
    await page.waitForLoadState('networkidle')

    // Look for phase buttons or sections
    const phaseButtons = page.locator('button').filter({ hasText: /Phase|Trigger/i })
    await expect(phaseButtons.first()).toBeVisible({ timeout: 10000 })
  })

  test('should fetch documents without database errors', async ({ page }) => {
    // Listen for console errors
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Check that there are no database errors about updated_at
    const hasUpdatedAtError = consoleErrors.some(err =>
      err.includes('updated_at') && err.includes('does not exist')
    )
    expect(hasUpdatedAtError).toBe(false)
  })

  test('should have working refresh button', async ({ page }) => {
    await page.waitForLoadState('networkidle')

    // Find and click refresh button
    const refreshButton = page.locator('button').filter({ hasText: /Refresh/i }).first()
    if (await refreshButton.isVisible()) {
      await refreshButton.click()

      // Wait for refresh to complete
      await page.waitForTimeout(1000)

      // Should show success toast (sonner toast)
      await expect(page.locator('[data-sonner-toast]').getByText('Document status updated')).toBeVisible({ timeout: 5000 })
    }
  })

  test('should handle trigger pipeline button clicks', async ({ page }) => {
    await page.waitForLoadState('networkidle')

    // Look for specific trigger buttons based on phaseConfig
    const parseButton = page.locator('button').filter({ hasText: 'Trigger Parse Documents' })
    const embedButton = page.locator('button').filter({ hasText: 'Trigger Generate Embeddings' })
    const extractButton = page.locator('button').filter({ hasText: 'Trigger Extract Insights' })

    // Check if any buttons are present and enabled
    const parseExists = await parseButton.count() > 0
    const embedExists = await embedButton.count() > 0
    const extractExists = await extractButton.count() > 0

    console.log(`Parse button exists: ${parseExists}`)
    console.log(`Embed button exists: ${embedExists}`)
    console.log(`Extract button exists: ${extractExists}`)

    // If parse button is enabled (not disabled), click it
    if (parseExists) {
      const isDisabled = await parseButton.getAttribute('disabled')
      console.log(`Parse button disabled: ${isDisabled}`)

      if (isDisabled === null) {
        await parseButton.click()

        // Should either show a toast notification or loading state
        await page.waitForTimeout(1000)

        // Check for toast notification (sonner)
        const hasToast = await page.locator('[data-sonner-toast]').isVisible()
        const hasLoadingState = await page.locator('button').filter({ hasText: 'Processing...' }).isVisible()

        console.log(`Toast visible: ${hasToast}, Loading state: ${hasLoadingState}`)
        expect(hasToast || hasLoadingState).toBe(true)
      }
    }
  })

  test('should not have numpy errors in console', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    await page.goto('http://localhost:3000/admin/documents/pipeline')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Check for numpy/pandas errors
    const hasNumpyError = errors.some(err =>
      err.includes('numpy') || err.includes('missing `numpy`')
    )

    if (hasNumpyError) {
      console.log('Found numpy errors:', errors.filter(e => e.includes('numpy')))
    }

    expect(hasNumpyError).toBe(false)
  })
})
