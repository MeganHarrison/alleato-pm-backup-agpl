import { test, expect } from '@playwright/test'

test.use({ storageState: 'tests/.auth/user.json' })

test.describe('Form layout alignment', () => {
  test('keeps header aligned with form width and background', async ({ page }) => {
    await page.route('**/api/dev/schema', async (route, request) => {
      const body =
        request.method() === 'GET'
          ? { tables: [] }
          : { columns: [], tables: [] }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })
    })

    await page.goto('/dev/table-generator')
    await page.waitForLoadState('networkidle')

    const layout = page.locator('[data-layout="form"]').first()
    await expect(layout).toBeVisible()

    const header = layout.locator('h1', { hasText: 'Table Page Generator' })
    await expect(header).toBeVisible()

    const layoutBox = await layout.boundingBox()
    const headerBox = await header.boundingBox()

    expect(layoutBox).not.toBeNull()
    expect(headerBox).not.toBeNull()

    if (layoutBox && headerBox) {
      expect(headerBox.x).toBeGreaterThanOrEqual(layoutBox.x)

      const layoutRight = layoutBox.x + layoutBox.width
      const headerRight = headerBox.x + headerBox.width

      expect(headerRight).toBeLessThanOrEqual(layoutRight)
    }

    const backgroundColor = await layout.evaluate((node) =>
      getComputedStyle(node as HTMLElement).backgroundColor
    )

    expect(backgroundColor).toBe('rgb(250, 250, 250)')
  })
})
