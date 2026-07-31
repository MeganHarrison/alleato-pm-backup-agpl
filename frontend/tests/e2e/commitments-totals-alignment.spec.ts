import { test, expect } from "@playwright/test";

// Regression guard: the UnifiedTablePage totals footer must align each total
// under its column. Currency columns are right-aligned in the header/body, so
// their totals in the <tfoot> must also be right-aligned. Previously the footer
// cells applied no text-align, so the totals rendered left-aligned and did not
// line up with the numbers above them (reported on /754/commitments).
test("commitments totals footer aligns with its columns", async ({ page }) => {
  await page.goto("/67/commitments", { waitUntil: "domcontentloaded" });

  const footer = page.locator("table tfoot");
  await footer.waitFor({ timeout: 60000 });
  await expect(footer).toBeVisible();

  // Capture the last body rows + the totals footer in one image so the
  // column→total alignment is visible in the report.
  await footer.scrollIntoViewIfNeeded();
  const tfootBox = await footer.boundingBox();
  const firstVisibleRow = await page
    .locator("table tbody tr")
    .nth(2)
    .boundingBox();
  const table = await page.locator("table").first().boundingBox();
  if (tfootBox && firstVisibleRow && table) {
    await page.screenshot({
      path: "test-results/commitments-totals-alignment.png",
      clip: {
        x: table.x,
        y: firstVisibleRow.y,
        width: Math.min(table.width, 1200),
        height: tfootBox.y + tfootBox.height - firstVisibleRow.y,
      },
    });
  }

  // Every currency total in the footer must be right-aligned (not the default
  // left) so it lines up under its right-aligned column.
  const footerCells = footer.locator("td");
  const count = await footerCells.count();
  const aligns: string[] = [];
  for (let i = 0; i < count; i++) {
    aligns.push(
      await footerCells.nth(i).evaluate((el) => getComputedStyle(el).textAlign),
    );
  }
  // At least one right-aligned currency total, and no total should be centered.
  expect(aligns).toContain("right");
  expect(aligns).not.toContain("center");
});
