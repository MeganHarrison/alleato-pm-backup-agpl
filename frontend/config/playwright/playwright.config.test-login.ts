import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '../../tests',
  testMatch: '**/test-login-standalone.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3001',
    trace: 'on',
    screenshot: 'on',
    video: 'on',
  },
  timeout: 60000,
  expect: {
    timeout: 15000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  outputDir: '../../tests/test-results',
});
