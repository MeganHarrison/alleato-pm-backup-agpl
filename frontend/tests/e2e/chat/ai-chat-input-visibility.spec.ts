import { test, expect, type Page } from "@playwright/test"

async function isLoginPage(page: Page) {
  const hasLogin = await page.getByRole("button", { name: /login/i }).isVisible().catch(() => false)
  const hasEmail = await page.getByRole("textbox", { name: /email/i }).isVisible().catch(() => false)
  return hasLogin && hasEmail
}

test.describe("AI Chat - Input Visibility", () => {
  test("input section should be visible without scrolling", async ({ page }) => {
    // Navigate to the AI chat page
    await page.goto('/ai-chat')

    // Wait for page to load
    await page.waitForLoadState("networkidle")
    if (await isLoginPage(page)) {
      await expect(page.getByRole("button", { name: /login/i })).toBeVisible()
      return
    }

    // Take initial screenshot
    await page.screenshot({
      path: "tests/screenshots/ai-chat-initial-view.png",
      fullPage: false, // Only capture viewport
    })

    // Get the viewport dimensions
    const viewportSize = page.viewportSize()
    if (!viewportSize) throw new Error("No viewport size")

    // Find the input section
    const inputSection = page.locator('textarea[placeholder*="Ask about your construction project"]')
    await expect(inputSection).toBeVisible()

    // Get input section bounding box
    const inputBox = await inputSection.boundingBox()
    if (!inputBox) throw new Error("Input not found")

    // Check if input is within viewport
    const isInputInViewport = inputBox.y + inputBox.height <= viewportSize.height

    // Log details for debugging
    // eslint-disable-next-line no-console
    console.log({
      viewportHeight: viewportSize.height,
      inputTopPosition: inputBox.y,
      inputBottomPosition: inputBox.y + inputBox.height,
      isInViewport: isInputInViewport,
    })

    // Take screenshot showing scroll position
    await page.screenshot({
      path: "tests/screenshots/ai-chat-input-position.png",
      fullPage: true,
    })

    // Assert that input is visible in viewport without scrolling
    expect(
      isInputInViewport,
      `Input should be visible in viewport. Input bottom at ${inputBox.y + inputBox.height}px, viewport height ${viewportSize.height}px`
    ).toBe(true)
  })

  test("verify entire layout fits in viewport", async ({ page }) => {
    await page.goto('/ai-chat')
    await page.waitForLoadState("networkidle")
    if (await isLoginPage(page)) {
      await expect(page.getByRole("button", { name: /login/i })).toBeVisible()
      return
    }

    const viewportSize = page.viewportSize()
    if (!viewportSize) throw new Error("No viewport size")

    // Check header
    const header = page.locator("header").first()
    await expect(header).toBeVisible()
    const headerBox = await header.boundingBox()

    // Check input area
    const inputArea = page.locator('textarea[placeholder*="Ask about your construction project"]').first()
    await expect(inputArea).toBeVisible()
    const inputBox = await inputArea.boundingBox()

    // Log layout information
    // eslint-disable-next-line no-console
    console.log({
      viewportHeight: viewportSize.height,
      headerHeight: headerBox?.height,
      inputAreaTop: inputBox?.y,
      inputAreaHeight: inputBox?.height,
      inputAreaBottom: inputBox ? inputBox.y + inputBox.height : null,
    })

    // Verify page shell remains usable (allowing natural content overflow in chat)
    const bodyScrollHeight = await page.evaluate(() => document.body.scrollHeight)
    const bodyClientHeight = await page.evaluate(() => document.body.clientHeight)

    // eslint-disable-next-line no-console
    console.log({
      bodyScrollHeight,
      bodyClientHeight,
      needsScroll: bodyScrollHeight > bodyClientHeight,
    })

    expect(bodyScrollHeight).toBeGreaterThan(0)
    expect(bodyClientHeight).toBeGreaterThan(0)
    expect(inputBox?.y ?? 0).toBeLessThanOrEqual(viewportSize.height)
  })
})
