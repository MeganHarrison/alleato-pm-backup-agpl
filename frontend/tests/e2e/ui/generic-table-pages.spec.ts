import { test, expect } from '@playwright/test'

const pages = [
  { name: 'Risks', path: '/risks', title: 'Risks' },
  { name: 'Opportunities', path: '/opportunities', title: 'Opportunities' },
  { name: 'Decisions', path: '/decisions', title: 'Decisions' },
  { name: 'Daily Logs', path: '/daily-logs', title: 'Daily Logs' },
  { name: 'Daily Recaps', path: '/daily-recaps', title: 'Daily Recaps' },
  { name: 'Issues', path: '/issues', title: 'Issues' },
  { name: 'Meeting Segments', path: '/meeting-segments', title: 'Meeting Segments' },
  { name: 'Notes', path: '/notes', title: 'Notes' },
  { name: 'AI Insights', path: '/insights', title: 'AI Insights' },
]

test.describe('Generic Table Pages', () => {
  for (const page of pages) {
    test.describe(page.name, () => {
      test.beforeEach(async ({ page: browserPage }) => {
        await browserPage.goto(`http://localhost:3000${page.path}`)
        await browserPage.waitForLoadState('networkidle')
      })

      test(`should display ${page.name} page with correct heading`, async ({ page: browserPage }) => {
        const heading = browserPage.locator(`h2:has-text("${page.title}")`)
        await expect(heading).toBeVisible()
      })

      test(`should display search input on ${page.name} page`, async ({ page: browserPage }) => {
        const searchInput = browserPage.locator('input[placeholder*="Search"]')
        await expect(searchInput).toBeVisible()
      })

      test(`should display export button on ${page.name} page`, async ({ page: browserPage }) => {
        const exportButton = browserPage.locator('button:has-text("Export")')
        await expect(exportButton).toBeVisible()
      })

      test(`should display columns toggle on ${page.name} page`, async ({ page: browserPage }) => {
        const columnsButton = browserPage.locator('button:has-text("Columns")')
        await expect(columnsButton).toBeVisible()
      })

      test(`should display data table on ${page.name} page`, async ({ page: browserPage }) => {
        const table = browserPage.locator('table')
        await expect(table).toBeVisible()
      })

      test(`should display record count on ${page.name} page`, async ({ page: browserPage }) => {
        const recordCount = browserPage.locator('text=/\\d+ of \\d+/')
        await expect(recordCount).toBeVisible()
      })

      test(`should take screenshot of ${page.name} page`, async ({ page: browserPage }) => {
        await browserPage.screenshot({
          path: `frontend/tests/screenshots/generic-tables/${page.name.toLowerCase().replace(/ /g, '-')}-page.png`,
          fullPage: true
        })
      })

      test(`should test search functionality on ${page.name} page`, async ({ page: browserPage }) => {
        const searchInput = browserPage.locator('input[placeholder*="Search"]')
        await searchInput.fill('test')

        // Wait a bit for filtering to occur
        await browserPage.waitForTimeout(500)

        // Verify search input has value
        await expect(searchInput).toHaveValue('test')
      })

      test(`should test column toggle on ${page.name} page`, async ({ page: browserPage }) => {
        const columnsButton = browserPage.locator('button:has-text("Columns")')
        await columnsButton.click()

        // Verify dropdown menu appears
        const dropdown = browserPage.locator('text=/Toggle columns/i')
        await expect(dropdown).toBeVisible()

        // Take screenshot of column toggle
        await browserPage.screenshot({
          path: `frontend/tests/screenshots/generic-tables/${page.name.toLowerCase().replace(/ /g, '-')}-columns.png`,
          fullPage: true
        })
      })
    })
  }
})

test.describe('Generic Table Pages - Comprehensive Tests', () => {
  test('all pages should be accessible', async ({ page }) => {
    for (const pageInfo of pages) {
      await page.goto(`http://localhost:3000${pageInfo.path}`)
      await page.waitForLoadState('networkidle')

      // Should not show error state
      const errorMessage = page.locator('text=/Error loading/i')
      await expect(errorMessage).not.toBeVisible()

      // Should show table
      const table = page.locator('table')
      await expect(table).toBeVisible()
    }
  })

  test('all pages should have consistent UI components', async ({ page }) => {
    for (const pageInfo of pages) {
      await page.goto(`http://localhost:3000${pageInfo.path}`)
      await page.waitForLoadState('networkidle')

      // Check for standard components
      await expect(page.locator('input[placeholder*="Search"]')).toBeVisible()
      await expect(page.locator('button:has-text("Export")')).toBeVisible()
      await expect(page.locator('button:has-text("Columns")')).toBeVisible()
      await expect(page.locator('table')).toBeVisible()
    }
  })
})
