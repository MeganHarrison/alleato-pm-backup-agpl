import path from "node:path";
import { expect, test } from "@playwright/test";

test.describe("Own Your Growth", () => {
  test("opens the authenticated growth assessment and action plan", async ({
    page,
  }) => {
    const applicationErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on("pageerror", (error) => applicationErrors.push(error.message));
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        !message.text().startsWith("Failed to load resource:")
      ) {
        consoleErrors.push(message.text());
      }
    });
    page.on("response", (response) => {
      if (
        response.status() >= 400 &&
        response.url().includes("/api/training/growth")
      ) {
        applicationErrors.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.goto("/training/growth");

    await expect(page).not.toHaveURL(/\/auth\/login/);
    await expect(
      page.getByRole("heading", { name: "My Growth" }),
    ).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "Score each skill" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Build the 30/60/90 plan" }),
    ).toBeVisible();
    const saveButton = page.getByRole("button", {
      name: /Save check-in|Update check-in/,
    });
    await expect(saveButton).toBeDisabled();
    // The local Next.js development runtime can finish hydrating after the
    // first server-rendered controls become visible.
    await page.waitForTimeout(1_000);

    const currentScores = page.getByRole("spinbutton", {
      name: /current score$/,
    });
    const targetScores = page.getByRole("spinbutton", {
      name: /target score$/,
    });
    const scoreCount = await currentScores.count();
    expect(scoreCount).toBeGreaterThanOrEqual(2);
    for (let index = 0; index < scoreCount; index += 1) {
      await currentScores.nth(index).fill(String(30 + (index % 3) * 5));
      await targetScores.nth(index).fill(String(70 + (index % 3) * 5));
    }
    await expect(page.getByTestId("skill-wheel")).toBeVisible();

    for (const [label, prefix] of [
      [/evidence situation$/, "Playwright situation"],
      [/evidence behavior$/, "Playwright behavior"],
      [/evidence outcome$/, "Playwright outcome"],
    ] as const) {
      const inputs = page.getByRole("textbox", { name: label });
      for (let index = 0; index < (await inputs.count()); index += 1) {
        await inputs.nth(index).fill(`${prefix} ${index + 1}`);
      }
    }

    const focusChoices = page.getByRole("checkbox", {
      name: /Select .* as a focus skill/,
    });
    await focusChoices.nth(0).check();
    await focusChoices.nth(1).check();

    for (const [label, value] of [
      ["Practice frequency", "Every Thursday"],
      ["Resource or support", "Training SOP and active project"],
      ["Feedback path", "Manager reviews it the next day"],
    ] as const) {
      const inputs = page.getByLabel(label);
      for (let index = 0; index < (await inputs.count()); index += 1) {
        await inputs.nth(index).fill(value);
      }
    }
    for (const days of [30, 60, 90]) {
      const actions = page.getByLabel(`${days}-day action`);
      const measures = page.getByLabel(`${days}-day measure`);
      for (let index = 0; index < (await actions.count()); index += 1) {
        await actions.nth(index).fill(`Complete the ${days}-day project rep.`);
        await measures.nth(index).fill(`Review the ${days}-day evidence.`);
      }
    }

    await expect(saveButton).toBeEnabled();
    const saveResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/training/growth") &&
        response.request().method() === "POST",
    );
    await saveButton.click();
    if (
      await page
        .getByText("Update this saved check-in?")
        .isVisible()
        .catch(() => false)
    ) {
      await page
        .getByRole("button", { name: "Update check-in" })
        .last()
        .click();
    }
    const saveResponse = await saveResponsePromise;
    expect(saveResponse.status()).toBe(200);
    await expect(page.getByText("Skill Wheel check-in saved.")).toBeVisible();
    const savedPayload = (await saveResponse.json()) as {
      checkin: { id: string; checkinDate: string; roleName: string };
    };
    const history = page.getByRole("region", { name: "Recent check-ins" });
    await expect(history).toContainText(savedPayload.checkin.roleName);
    await expect(history).toContainText("Average");

    await page.reload();
    const reloadedHistory = page.getByRole("region", {
      name: "Recent check-ins",
    });
    await expect(reloadedHistory).toContainText(savedPayload.checkin.roleName);
    await expect(reloadedHistory).toContainText("Average");
    await reloadedHistory.locator("summary").first().click();
    await expect(reloadedHistory).toContainText("Playwright situation 1");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/training/growth");
    await expect(
      page.getByRole("heading", { name: "My Growth" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth === window.innerWidth,
      ),
    ).toBe(true);
    await expect(page.getByRole("main")).toHaveCount(1);
    await page.screenshot({
      path: path.resolve(
        "..",
        "docs/ops/evidence/2026-07-29-training-growth-contract-final/mobile.png",
      ),
      fullPage: true,
    });
    expect(applicationErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
