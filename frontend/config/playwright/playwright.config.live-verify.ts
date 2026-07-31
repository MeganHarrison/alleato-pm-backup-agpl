import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

export default defineConfig({
  testDir: '../../tests',
  testMatch: ['**/live-verify-all-tools.spec.ts', '**/live-verify-invoicing-new.spec.ts'],
  fullyParallel: false,
  forbidOnly: false,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: '../../tests/test-results/live-verify-results.json' }]],
  use: {
    baseURL: 'http://localhost:3000',
    storageState: './tests/.auth/user.json',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  timeout: 120000,  // 2 minutes per test
  expect: {
    timeout: 15000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: './tests/.auth/user.json',
      },
    },
  ],
});
