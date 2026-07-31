import { test, expect } from '@playwright/test'

// Mirrors the drawing QR-code deep link: an unauthenticated scan should land
// on /auth/login with the original path preserved as callbackUrl, and after
// signing in the user should land back on that exact path — not the
// portfolio home page. This is the round trip the drawings QR code depends
// on (frontend/src/app/api/projects/[projectId]/drawings/[drawingId]/qr-code/route.ts).
const TEST_EMAIL = process.env.TEST_USER_1 ?? 'test1@mail.com'
const TEST_PASSWORD = process.env.TEST_PASSWORD_1 ?? 'test12026!!!'
const DEEP_LINK_PATH = '/47/drawings/viewer/00000000-0000-0000-0000-000000000000'

test.describe('Post-login deep-link callback redirect', () => {
  test.use({ storageState: undefined })

  test('unauthenticated deep link redirects to login, then back to the same URL after sign-in', async ({ page }) => {
    await page.goto(DEEP_LINK_PATH)

    await page.waitForURL(/\/auth\/login\?callbackUrl=/, { timeout: 10000 })
    const loginUrl = new URL(page.url())
    expect(loginUrl.searchParams.get('callbackUrl')).toBe(DEEP_LINK_PATH)

    await page.locator('#email').fill(TEST_EMAIL)
    await page.locator('#password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: /^sign in$/i }).click()

    await page.waitForURL((url) => url.pathname === DEEP_LINK_PATH, { timeout: 15000 })
    expect(new URL(page.url()).pathname).toBe(DEEP_LINK_PATH)
  })
})
