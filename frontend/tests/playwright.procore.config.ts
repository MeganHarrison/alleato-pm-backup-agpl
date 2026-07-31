import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Procore website verification
 * This config is separate from our local app testing
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/procore-*.spec.ts',
  timeout: 60 * 1000,
  expect: {
    timeout: 10000
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/procore' }],
  ],
  use: {
    baseURL: 'https://us02.procore.com',
    trace: 'on',
    screenshot: 'on',
    video: 'on',
    headless: false,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
