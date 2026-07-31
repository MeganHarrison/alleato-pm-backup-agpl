import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.join(__dirname, "../../.env.local") });
dotenv.config({ path: path.join(__dirname, "../../.env") });

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const serverPort = new URL(baseURL).port || "3000";

export default defineConfig({
  testDir: "../../tests",
  testMatch: "**/company-brain*.spec.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ["html", { outputFolder: "../../tests/company-brain-report", open: "never" }],
    ["list"],
  ],
  timeout: 120_000,
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixelRatio: 0.01,
      threshold: 0.05,
    },
  },
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      // Compiles the route once and fails loudly if COMPANY_BRAIN_TEST_FIXTURES
      // is not set, before any spec can misread either as a product failure.
      name: "warmup",
      testMatch: /company-brain\.warmup\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "./tests/.auth/user.json",
      },
      dependencies: ["setup"],
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "./tests/.auth/user.json",
      },
      dependencies: ["setup", "warmup"],
    },
  ],
  outputDir: "../../tests/company-brain-results",
  snapshotDir: "../../tests/company-brain-visual-baseline",
  snapshotPathTemplate:
    "{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-projectName}{ext}",
  webServer: {
    command: `node node_modules/next/dist/bin/next dev -p ${serverPort}`,
    cwd: path.join(__dirname, "../.."),
    env: {
      ...process.env,
      COMPANY_BRAIN_TEST_FIXTURES: "1",
    },
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
