import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

export default defineConfig({
  testDir: '../../tests',
  testMatch: '**/*.spec.{ts,js}',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: '../../tests/test-results/s20-onboarding-results.json' }],
  ],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:3000',
    storageState: './tests/.auth/user.json',
    trace: 'on',
    screenshot: 'only-on-failure',
    video: 'on',
  },
  timeout: 120000,
  expect: { timeout: 15000 },
  outputDir: '../../tests/test-results/s20-onboarding',
});
