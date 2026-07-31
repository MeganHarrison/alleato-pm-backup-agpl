import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('redirects to login when not authenticated', async ({ page }) => {
    // Try to access the homepage without being logged in
    await page.goto('/')

    // Should redirect to login page
    await expect(page).toHaveURL(/\/auth\/login/)
    await expect(page.locator('h1, h2').filter({ hasText: 'Login' }).first()).toBeVisible()
  })

  test('logout redirects to login page', async ({ page }) => {
    // Wait for redirect to homepage
    await page.waitForURL('/', { timeout: 10000 })

    // Verify we're logged in by checking for sidebar
    await expect(page.getByRole('button', { name: /menu/i }).or(page.locator('[data-sidebar-trigger]')).first()).toBeVisible({ timeout: 10000 })

    // Open the sidebar if it's not already open
    const sidebarTrigger = page.getByRole('button', { name: /menu/i }).or(page.locator('[data-sidebar-trigger]')).first()
    if (await sidebarTrigger.isVisible()) {
      await sidebarTrigger.click()
      await page.waitForTimeout(500)
    }

    // Click on user menu dropdown to reveal logout
    const userDropdown = page.getByRole('button').filter({ has: page.locator('text=/test@example.com/i') }).first()
    await userDropdown.click()
    await page.waitForTimeout(300)

    // Take screenshot before logout
    await page.screenshot({ path: 'tests/screenshots/before-logout.png', fullPage: true })

    // Click logout
    const logoutButton = page.getByRole('menuitem', { name: /log out/i })
    await logoutButton.click()

    // Should redirect to login page
    await page.waitForURL(/\/auth\/login/, { timeout: 5000 })

    // Verify we're on login page
    await expect(page.locator('h1, h2').filter({ hasText: 'Login' }).first()).toBeVisible()

    // Take screenshot after logout
    await page.screenshot({ path: 'tests/screenshots/after-logout.png', fullPage: true })

    // Try to access homepage again - should redirect back to login
    await page.goto('/')
    await page.waitForURL(/\/auth\/login/)
    await expect(page.locator('h1, h2').filter({ hasText: 'Login' }).first()).toBeVisible()
  })
})
