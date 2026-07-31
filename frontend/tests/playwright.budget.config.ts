import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local file in frontend directory
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

// Use BASE_URL from .env.local or fallback to localhost
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

/**
 * Budget-specific Playwright config
 *
 * Uses existing auth state without running auth.setup.ts
 * This avoids timeout issues when auth state is already valid.
 */
export default defineConfig({
  testDir: './tests/e2e/budget',
  timeout: 120 * 1000, // 2 minutes for budget tests
  expect: {
    timeout: 15000,
  },
  fullyParallel: false, // Run budget tests serially to avoid conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Single worker to ensure test isolation
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/budget', open: 'never' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    // Use existing auth state directly (no setup dependency)
    storageState: 'tests/.auth/user.json',
  },

  projects: [
    {
      name: 'budget-tests',
      use: {
        ...devices['Desktop Chrome'],
      },
      // No dependencies - uses storageState from 'use' config
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: true, // Always reuse existing server
    timeout: 30000,
  },
});
