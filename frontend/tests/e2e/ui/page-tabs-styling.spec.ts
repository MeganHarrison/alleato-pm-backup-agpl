import { expect, test } from "@playwright/test";

test("Page tabs use homepage styling classes", async ({ page }) => {
  await page.setContent(`
    <nav class="-mb-px flex overflow-x-auto border-b border-border" aria-label="Tabs">
      <button class="group inline-flex items-center gap-2 whitespace-nowrap border-b-2 pb-3 pt-4 text-sm font-medium transition-colors border-brand text-brand" aria-label="All Contracts">
        <span>All Contracts</span>
        <span class="rounded-full px-2.5 py-0.5 text-xs font-medium bg-brand/10 text-brand">3</span>
      </button>
      <button class="group inline-flex items-center gap-2 whitespace-nowrap border-b-2 pb-3 pt-4 text-sm font-medium transition-colors border-transparent text-muted-foreground" aria-label="Active">
        <span>Active</span>
      </button>
    </nav>
  `);

  const activeTab = page.getByRole("button", { name: "All Contracts" });
  await expect(activeTab).toHaveClass(/border-brand/);
  await expect(activeTab).toHaveClass(/text-brand/);

  const inactiveTab = page.getByRole("button", { name: "Active" });
  await expect(inactiveTab).toHaveClass(/border-transparent/);
  await expect(inactiveTab).toHaveClass(/text-muted-foreground/);

  const badge = activeTab.getByText("3");
  await expect(badge).toHaveClass(/rounded-full/);
  await expect(badge).toHaveClass(/px-2\.5/);
  await expect(badge).toHaveClass(/py-0\.5/);
});
