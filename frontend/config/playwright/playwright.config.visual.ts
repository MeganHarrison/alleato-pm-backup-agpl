import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '../../tests',
  testMatch: '**/visual-regression.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: '../../tests/visual-regression-report' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    
    // Visual regression specific settings
    ignoreHTTPSErrors: true,
    
    // Ensure consistent rendering
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
    
    // Disable animations for consistent screenshots
    actionTimeout: 30000,
    navigationTimeout: 30000,
  },
  
  // Visual comparison settings
  expect: {
    // Time to wait for elements
    timeout: 10000,
    
    // Visual regression thresholds
    toHaveScreenshot: { 
      // Allow up to 5% pixel difference
      threshold: 0.05,
      
      // Maximum pixel difference count
      maxDiffPixels: 100,
      
      // Animation handling
      animations: 'disabled',
    },
  },
  
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Use saved auth state
        storageState: '../../tests/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
  ],
  
  outputDir: '../../tests/visual-regression-results',
  
  // Store snapshots in a dedicated directory
  snapshotDir: '../../tests/visual-regression-baseline',
  snapshotPathTemplate: '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-projectName}{ext}',
});