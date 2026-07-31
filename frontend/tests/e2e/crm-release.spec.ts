import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

const artifactDir = path.resolve(
  process.cwd(),
  "../tests/agent-browser-runs/2026-07-29-crm-release-playwright",
);

test.beforeAll(() => {
  fs.mkdirSync(artifactDir, { recursive: true });
});

test("authenticated CRM workspace loads every primary surface", async ({
  page,
}) => {
  test.setTimeout(900_000);
  const relationshipsWorkspace = page.waitForResponse(
    (response) =>
      response.url().includes("/api/crm/workspace") &&
      response.status() === 200,
    { timeout: 120_000 },
  );
  await page.goto("/crm", { waitUntil: "domcontentloaded" });
  await relationshipsWorkspace;
  await expect(page).not.toHaveURL(/\/auth\/login/);
  await expect(
    page.getByRole("heading", { name: "CRM relationships" }),
  ).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByText(/Disconnected local|browser only/i)).toHaveCount(
    0,
  );
  await page.screenshot({
    path: path.join(artifactDir, "crm-relationships-desktop.png"),
    fullPage: true,
  });

  const routes = [
    ["/crm/pipeline", "Sales pipeline", "crm-pipeline-desktop.png"],
    ["/crm/deals", "Deals", "crm-deals-desktop.png"],
    ["/crm/activities", "Activity", "crm-activity-desktop.png"],
    [
      "/crm/settings/matching",
      "Communication matching",
      "crm-matching-desktop.png",
    ],
    ["/crm/settings", "CRM settings", "crm-settings-desktop.png"],
  ] as const;

  for (const [route, heading, screenshotName] of routes) {
    const workspaceLoaded = page.waitForResponse(
      (response) =>
        response.url().includes("/api/crm/workspace") &&
        response.status() === 200,
      { timeout: 120_000 },
    );
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await workspaceLoaded;
    await expect(page).not.toHaveURL(/\/auth\/login/);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    if (route === "/crm/pipeline") {
      await expect(page.getByText("Lead", { exact: true })).toBeVisible({
        timeout: 120_000,
      });
    }
    await page.waitForTimeout(500);
    await expect(
      page.getByText(/Disconnected local|browser only/i),
    ).toHaveCount(0);
    await page.screenshot({
      path: path.join(artifactDir, screenshotName),
      fullPage: true,
    });
  }

  await page.goto("/tasks", { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/auth\/login/);
  await expect(page.getByText("Tasks", { exact: true }).first()).toBeVisible();
});

test("CRM pipeline remains readable at mobile width", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const workspaceLoaded = page.waitForResponse(
    (response) =>
      response.url().includes("/api/crm/workspace") &&
      response.status() === 200,
    { timeout: 120_000 },
  );
  await page.goto("/crm/pipeline", { waitUntil: "domcontentloaded" });
  await workspaceLoaded;
  await expect(page).not.toHaveURL(/\/auth\/login/);
  await expect(
    page.getByRole("heading", { name: "Sales pipeline" }),
  ).toBeVisible();
  await expect(page.getByText("Lead", { exact: true })).toBeVisible({
    timeout: 120_000,
  });
  await expect(page.getByTestId("crm-pipeline-board")).toBeVisible();
  await page.screenshot({
    path: path.join(artifactDir, "crm-pipeline-mobile.png"),
    fullPage: true,
  });
});
