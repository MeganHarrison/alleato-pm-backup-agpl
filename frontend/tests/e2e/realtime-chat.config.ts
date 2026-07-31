import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "chat/westfield-chat-realtime.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PW_BASE_URL || "http://localhost:3000",
    storageState: "tests/.auth/user.json",
    trace: "on-first-retry",
    screenshot: "on",
    video: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  timeout: 180000,
  expect: {
    timeout: 20000,
  },
  outputDir: "./test-results",
});
