import { expect, test } from "@playwright/test";

test.describe("GenericConfigUnifiedTable", () => {
  test("supports columns, filters, and export on the FM Global table page", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem(
        "fm-global-tables-directory:visibleColumns",
      );
    });

    await page.goto("/fm-global/fm_global_tables");
    await expect(
      page.getByRole("heading", { name: "FM Global Tables" }),
    ).toBeVisible();

    await expect(page.getByRole("button", { name: "Export" })).toBeVisible();

    await page.getByRole("button", { name: "Toggle columns" }).click();
    await expect(
      page.getByRole("menuitemcheckbox", { name: "Container Type" }),
    ).toBeVisible();
    const containerTypeColumn = page.getByRole("menuitemcheckbox", {
      name: "Container Type",
    });
    await containerTypeColumn.click();
    await expect(containerTypeColumn).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Filters" }).click();
    const filtersPopover = page
      .locator("[data-radix-popper-content-wrapper]")
      .filter({ hasText: "Filters" })
      .last();
    await expect(filtersPopover.getByText("Status")).toBeVisible();

    await filtersPopover.getByRole("combobox").click();
    await page.getByRole("option", { name: "Pending" }).click();

    await expect(page).toHaveURL(/extraction_status=pending/);
  });
});
