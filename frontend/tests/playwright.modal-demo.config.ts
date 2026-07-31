import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for modal-demo page testing (no auth required)
 */
export default defineConfig({
  testDir: './tests',
  testMatch: /modal-demo-visual\.spec\.ts/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
