import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '../../tests',
  testMatch: '**/*.spec.{ts,js}',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: '../../tests/playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  timeout: 120000, // 2 minutes for agent responses
  expect: {
    timeout: 15000,
  },
  projects: [
    {
      name: 'no-auth',
      use: {
        ...devices['Desktop Chrome'],
        // No auth state - run without authentication
      },
    },
  ],
  outputDir: '../../tests/test-results',
});