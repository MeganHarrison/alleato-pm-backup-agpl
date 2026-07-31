import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

const artifactDir = path.resolve(
  process.cwd(),
  "../tests/agent-browser-runs/2026-07-29-applicant-tracker-release",
);

test.beforeAll(() => {
  fs.mkdirSync(artifactDir, { recursive: true });
});

test("Applicant Tracker exposes the guarded all-phases workspace", async ({
  page,
}) => {
  await page.goto("/recruiting", { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/auth\/login/);
  await expect(
    page.getByRole("heading", { name: "Applicant Tracker" }),
  ).toBeVisible();
  const previewNotice = page.getByText(
    "This is the local all-phases preview.",
    { exact: false },
  );
  const isPreview = await previewNotice.isVisible();
  if (isPreview) {
    await expect(previewNotice).toBeVisible();
  } else {
    await expect(
      page.getByText("Shared recruiting workspace.", { exact: false }),
    ).toBeVisible();
  }

  for (const tab of [
    "Inbox",
    "Pipeline",
    "Requisitions",
    "Interviews",
    "Offers",
    "Talent CRM",
    "Reports",
    "Settings",
  ]) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(page.getByRole("tab", { name: tab })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  }

  await page.getByRole("tab", { name: "Pipeline" }).click();
  if (isPreview) {
    const moveCandidate = page.getByRole("combobox", { name: /^Move / }).first();
    await expect(moveCandidate).toBeVisible();
    await moveCandidate.click();
    await page.getByRole("option", { name: "Review" }).click();
    await expect(
      page.getByText("No production record or external action was created.", {
        exact: false,
      }),
    ).toBeVisible();
  } else {
    await expect(page.getByText("No candidates").first()).toBeVisible();
  }

  await page.screenshot({
    path: path.join(
      artifactDir,
      isPreview
        ? "applicant-tracker-desktop.png"
        : "applicant-tracker-production-desktop.png",
    ),
    fullPage: true,
  });
});

test("Applicant Tracker remains usable at coordinator mobile width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/recruiting", { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/auth\/login/);
  await expect(
    page.getByRole("heading", { name: "Applicant Tracker" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Pipeline" }).click();
  const moveCandidate = page.getByRole("combobox", { name: /^Move / }).first();
  if (await moveCandidate.isVisible()) {
    await expect(moveCandidate).toBeVisible();
  } else {
    await expect(page.getByText("No candidates").first()).toBeVisible();
  }
  await page.screenshot({
    path: path.join(
      artifactDir,
      page.url().startsWith("https://projects.alleatogroup.com")
        ? "applicant-tracker-production-mobile.png"
        : "applicant-tracker-mobile.png",
    ),
    fullPage: true,
  });
});
