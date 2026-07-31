import { test, expect, Page } from '@playwright/test'
import path from 'path'
import fs from 'fs/promises'

const AUTH_PASSWORD = 'TestPassword123!'
const SCREENSHOT_DIR = path.join('tests', 'screenshots', 'auth')

test.use({ storageState: undefined })

let createdEmail = ''

async function captureScreenshot(page: Page, name: string) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await page.screenshot({ path: filePath, fullPage: true })
  return filePath
}

test.describe('Auth pages', () => {
  test.describe.configure({ mode: 'serial' })

  test('sign up redirects to success page', async ({ page }) => {
    createdEmail = `playwright-auth-${Date.now()}@example.com`

    await page.goto('/auth/sign-up')
    await page.fill('input[name="name"]', 'Playwright Auth User')
    await page.fill('input[name="email"]', createdEmail)
    await page.fill('input[name="password"]', AUTH_PASSWORD)
    await page.fill('input[name="repeat-password"]', AUTH_PASSWORD)

    await captureScreenshot(page, 'signup-filled')
    await page.getByRole('button', { name: /sign up/i }).click()

    await page.waitForURL('/auth/sign-up-success', { timeout: 15000 })
    await captureScreenshot(page, 'signup-success')
  })

  test('login shows inline feedback and redirects home', async ({ page, request }) => {
    if (!createdEmail) {
      createdEmail = `playwright-auth-${Date.now()}@example.com`
    }

    const params = new URLSearchParams({
      email: createdEmail,
      password: AUTH_PASSWORD,
      redirect: '/',
    })
    const bootstrapResponse = await request.get(`/dev-login?${params.toString()}`)
    expect(bootstrapResponse.ok()).toBeTruthy()

    await page.goto('/auth/login')
    await page.fill('input[name="email"]', createdEmail)
    await page.fill('input[name="password"]', AUTH_PASSWORD)

    await captureScreenshot(page, 'login-filled')
    await page.getByRole('button', { name: /^login$/i }).click()

    await expect(page.getByText('Login successful! Redirecting you now...')).toBeVisible({
      timeout: 10000,
    })
    await page.waitForURL('**/', { timeout: 15000 })
    await captureScreenshot(page, 'login-success')
  })

  test('login password can be shown and hidden', async ({ page }) => {
    await page.goto('/auth/login')

    const passwordInput = page.locator('input[name="password"]')
    const showButton = page.getByRole('button', { name: /show password/i })

    await expect(passwordInput).toHaveAttribute('type', 'password')

    await showButton.click()
    await expect(passwordInput).toHaveAttribute('type', 'text')
    await expect(page.getByRole('button', { name: /hide password/i })).toBeVisible()

    await page.getByRole('button', { name: /hide password/i }).click()
    await expect(passwordInput).toHaveAttribute('type', 'password')
  })
})
