import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "../../tests/e2e/drawings",
  testMatch: "drawings-viewer-capability-contract.spec.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [
    ["list"],
    ["json", { outputFile: "../../tests/test-results/drawings-capability/results.json" }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001",
    storageState: "./tests/.auth/user.json",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  timeout: 180_000,
  expect: {
    timeout: 20_000,
  },
  projects: [
    {
      name: "chromium",
      use: devices["Desktop Chrome"],
    },
  ],
  outputDir: "../../tests/test-results/drawings-capability/artifacts",
});
