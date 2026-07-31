import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load env from frontend root (two levels up from config/playwright/)
dotenv.config({ path: path.join(__dirname, '../../.env.local') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

export default defineConfig({
  testDir: '../../tests',
  testMatch: '**/*.spec.{ts,js}',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : 2,
  reporter: [
    ['html', { outputFolder: '../../tests/playwright-report', open: 'never' }],
    ['json', { outputFile: '../../tests/test-results/results.json' }],
    ...(process.env.CI ? [['github'] as const] : []),
    ['list'],
  ],
  use: {
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL ||
      process.env.BASE_URL ||
      'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on',
  },
  timeout: 120000, // 2 minutes for agent responses
  expect: {
    timeout: 15000,
  },
  projects: [
    // Setup project - runs first to authenticate
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    // Main tests - depend on setup
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Use saved auth state
        storageState: './tests/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    // No-auth tests - for visual checks without authentication
    {
      name: 'no-auth',
      use: {
        ...devices['Desktop Chrome'],
      },
      testMatch: /comprehensive-page-check\.spec\.ts|check-styling\.spec\.ts|project-tools-dropdown\.spec\.ts|meetings2-page\.spec\.ts|employees-page\.spec\.ts|project-home-collapsible\.spec\.ts|project-setup-wizard\.spec\.ts|project-setup-wizard-comprehensive\.spec\.ts|wizard-manual-test\.spec\.ts|project-scoped-routing\.spec\.ts|budget-modals\.spec\.ts|page-title-verification\.spec\.ts|form-testing-simple\.spec\.ts|project-home-navigation\.spec\.ts|ai-chat-widget\.spec\.ts|chat-widget-debug\.spec\.ts|project-meeting-detail\.spec\.ts|contract-form-new\.spec\.ts|contract-form-visual\.spec\.ts|sidebar-collapse-verification\.spec\.ts|sidebar-visual-verification\.spec\.ts|change-event-preview-card\.fixture\.spec\.ts/,
    },
  ],
  outputDir: '../../tests/test-results',
  webServer: {
    command: 'npm run dev',
    url:
      process.env.PLAYWRIGHT_BASE_URL ||
      process.env.BASE_URL ||
      'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
