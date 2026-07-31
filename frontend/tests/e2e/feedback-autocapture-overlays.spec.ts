import { test, expect } from "@playwright/test";

// Regression: the admin feedback composer auto-capture must produce a real
// screenshot even when Velt overlays cover the page.
//
// Root cause this guards against: Velt (formerly Snippyly) injects full-viewport
// overlay custom elements (<snippyly-*>/<velt-*>). The capture root used to
// resolve to one of these overlays, which html-to-image renders as an empty
// `data:,` image, so auto-capture failed with "Capture produced an empty image".
const PAGES = ["/25125/rfis", "/67/budget"];

for (const path of PAGES) {
  test(`auto-capture produces a screenshot: ${path}`, async ({ page }) => {
    const captureErrors: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      if (
        text.includes("Screenshot capture failed") ||
        text.includes("empty image")
      ) {
        captureErrors.push(text);
      }
    });

    await page.goto(path, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(9000); // deferred feedback widget mounts at 6s

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("admin-feedback:open-composer"));
    });

    // Poll for the captured screenshot — toPng + compression on a heavy page
    // (e.g. Budget) can take several seconds.
    const readState = () =>
      page.evaluate(() => {
        const dataImg = [...document.querySelectorAll("img")].find((i) =>
          (i.getAttribute("src") ?? "").startsWith("data:image/"),
        );
        const src = dataImg?.getAttribute("src") ?? "";
        return {
          dialogOpen: !!document.querySelector("[role='dialog']"),
          hasScreenshot: src.startsWith("data:image/"),
          srcLen: src.length,
        };
      });

    let state = await readState();
    for (let i = 0; i < 20 && !state.hasScreenshot && captureErrors.length === 0; i++) {
      await page.waitForTimeout(1000);
      state = await readState();
    }

    console.log(`\n===== ${path} =====`);
    console.log("state:", JSON.stringify(state));
    console.log("captureErrors:", JSON.stringify(captureErrors));

    expect(state.dialogOpen, "composer dialog should open").toBe(true);
    expect(captureErrors, "no capture failures").toEqual([]);
    expect(
      state.hasScreenshot,
      "a real screenshot data URL should be attached",
    ).toBe(true);
    expect(state.srcLen, "screenshot should be non-trivial").toBeGreaterThan(2000);
  });
}
