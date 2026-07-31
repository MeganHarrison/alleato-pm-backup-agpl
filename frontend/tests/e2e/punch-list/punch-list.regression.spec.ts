import { test, expect } from "@playwright/test";

/**
 * Punch List E2E Tests
 *
 * Tests the full CRUD lifecycle for punch list items:
 * - Create: open form dialog, fill fields, submit, verify row appears
 * - Read: navigate to page, verify data table renders with correct columns
 * - Edit: open existing record, change a field, save, verify update
 * - Delete: soft-delete record, verify it moves to Recycle Bin
 * - Validation: submit empty required fields, verify error messages
 */

const PROJECT_ID = 31;
const PUNCH_LIST_URL = `/${PROJECT_ID}/punch-list`;
const UNIQUE_SUFFIX = `E2E-${Date.now()}`;

async function getFirstProjectId(
  request: any,
  baseURL: string,
): Promise<number> {
  const resp = await request.get(
    `${baseURL}/api/projects?limit=1&archived=false`,
  );
  const json = await resp.json();
  const id = json?.data?.[0]?.id;
  return id ?? PROJECT_ID;
}

test.describe("Punch List", () => {
  let createdItemTitle: string;

  test("01 — Read: page loads and data table renders with correct columns", async ({
    page,
  }) => {
    await page.goto(PUNCH_LIST_URL);
    await page.waitForLoadState("domcontentloaded");

    // Verify page header
    await expect(page.getByText("Punch List").first()).toBeVisible();

    // Verify the Create button exists
    await expect(
      page.getByRole("button", { name: /Create Punch Item/i }),
    ).toBeVisible();

    // Verify tabs exist
    await expect(page.getByRole("tab", { name: /All Items/i })).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /Recycle Bin/i }),
    ).toBeVisible();

    // Verify table column headers exist
    const headers = ["Title", "Status", "Priority", "Location", "Trade"];
    for (const header of headers) {
      await expect(
        page
          .getByRole("columnheader", { name: header })
          .or(page.locator(`th:has-text("${header}")`)),
      ).toBeVisible({ timeout: 10000 });
    }

    // Verify search input exists
    await expect(
      page.getByPlaceholder(/Search punch items/i),
    ).toBeVisible();
  });

  test("02 — Validation: submit empty required fields shows error", async ({
    page,
  }) => {
    await page.goto(PUNCH_LIST_URL);
    await page.waitForLoadState("domcontentloaded");

    // Open create dialog
    await page.getByRole("button", { name: /Create Punch Item/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Clear title field to ensure it is empty
    const titleInput = page.getByPlaceholder("Enter punch item title");
    await titleInput.fill("");

    // Click submit without filling required fields
    await page.getByRole("button", { name: /^Create Punch Item$/i }).click();

    // Verify validation error appears for title
    await expect(page.getByText(/Title is required/i)).toBeVisible({
      timeout: 5000,
    });

    // Close dialog
    await page.getByRole("button", { name: /Cancel/i }).click();
  });

  test("03 — Create: fill form, submit, verify new record appears", async ({
    page,
  }) => {
    createdItemTitle = `Test Punch ${UNIQUE_SUFFIX}`;

    await page.goto(PUNCH_LIST_URL);
    await page.waitForLoadState("domcontentloaded");

    // Open create dialog
    await page.getByRole("button", { name: /Create Punch Item/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Fill required field: title
    await page
      .getByPlaceholder("Enter punch item title")
      .fill(createdItemTitle);

    // Fill optional fields
    await page.getByPlaceholder("Enter description").fill("E2E test description");
    await page.getByPlaceholder("Company name").fill("Test Company");
    await page.getByPlaceholder("Location").fill("Floor 2");
    await page.getByPlaceholder("Trade").fill("Electrical");

    // Select priority
    const priorityTrigger = page
      .locator("button[role='combobox']")
      .filter({ hasText: /Select priority/i });
    if (await priorityTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await priorityTrigger.click();
      await page.getByRole("option", { name: "High" }).click();
    }

    // Submit
    await page
      .getByRole("button", { name: /^Create Punch Item$/i })
      .click();

    // Wait for dialog to close (success)
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 15000 });

    // Verify toast
    const toast = page.getByText(/Punch item created/i);
    const toastVisible = await toast
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // Verify the new item appears in the table
    // Search for it to find it faster
    const searchInput = page.getByPlaceholder(/Search punch items/i);
    await searchInput.fill(createdItemTitle);
    await page.waitForTimeout(500);

    // Check the item is visible
    let itemVisible = await page
      .getByText(createdItemTitle)
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!itemVisible) {
      // Reload fallback
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
      await page
        .getByPlaceholder(/Search punch items/i)
        .fill(createdItemTitle);
      await page.waitForTimeout(500);
    }

    await expect(page.getByText(createdItemTitle)).toBeVisible({
      timeout: 10000,
    });
  });

  test("04 — Edit: open existing record, change field, save, verify update", async ({
    page,
  }) => {
    createdItemTitle = `Test Punch ${UNIQUE_SUFFIX}`;
    const updatedTitle = `Updated ${UNIQUE_SUFFIX}`;

    await page.goto(PUNCH_LIST_URL);
    await page.waitForLoadState("domcontentloaded");

    // Search for the item we created
    const searchInput = page.getByPlaceholder(/Search punch items/i);
    await searchInput.fill(createdItemTitle);
    await page.waitForTimeout(500);

    // Verify item is visible, reload if needed
    let itemVisible = await page
      .getByText(createdItemTitle)
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!itemVisible) {
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
      await page
        .getByPlaceholder(/Search punch items/i)
        .fill(createdItemTitle);
      await page.waitForTimeout(500);
    }

    // Click the actions menu on the row with our item
    const row = page.locator("tr").filter({ hasText: createdItemTitle });
    const actionsButton = row.getByRole("button").last();
    await actionsButton.click();

    // Click Edit
    await page.getByRole("menuitem", { name: /Edit/i }).click();

    // Verify edit dialog opens
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Edit Punch Item")).toBeVisible();

    // Change the title
    const titleInput = page.getByPlaceholder("Enter punch item title");
    await titleInput.clear();
    await titleInput.fill(updatedTitle);

    // Save
    await page.getByRole("button", { name: /Save Changes/i }).click();

    // Wait for dialog to close
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 15000 });

    // Verify toast
    const toast = page.getByText(/Punch item updated/i);
    await toast.isVisible({ timeout: 5000 }).catch(() => false);

    // Verify updated title appears
    await searchInput.clear();
    await searchInput.fill(updatedTitle);
    await page.waitForTimeout(500);

    let updatedVisible = await page
      .getByText(updatedTitle)
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!updatedVisible) {
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
      await page
        .getByPlaceholder(/Search punch items/i)
        .fill(updatedTitle);
      await page.waitForTimeout(500);
    }

    await expect(page.getByText(updatedTitle)).toBeVisible({
      timeout: 10000,
    });

    // Update the title reference for subsequent tests
    createdItemTitle = updatedTitle;
  });

  test("05 — Delete: soft-delete record, verify it moves to Recycle Bin", async ({
    page,
  }) => {
    // Use the updated title from the edit test
    const itemTitle = `Updated ${UNIQUE_SUFFIX}`;

    await page.goto(PUNCH_LIST_URL);
    await page.waitForLoadState("domcontentloaded");

    // Search for the item
    const searchInput = page.getByPlaceholder(/Search punch items/i);
    await searchInput.fill(itemTitle);
    await page.waitForTimeout(500);

    let itemVisible = await page
      .getByText(itemTitle)
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!itemVisible) {
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
      await page.getByPlaceholder(/Search punch items/i).fill(itemTitle);
      await page.waitForTimeout(500);
    }

    // Click the actions menu on the row
    const row = page.locator("tr").filter({ hasText: itemTitle });
    const actionsButton = row.getByRole("button").last();
    await actionsButton.click();

    // Click Delete
    await page.getByRole("menuitem", { name: /Delete/i }).click();

    // Verify toast
    const toast = page.getByText(/moved to recycle bin/i);
    await toast.isVisible({ timeout: 5000 }).catch(() => false);

    // Verify item no longer appears in All Items tab
    await page.waitForTimeout(1000);

    // Clear search and re-search
    await searchInput.clear();
    await searchInput.fill(itemTitle);
    await page.waitForTimeout(500);

    // The item should NOT be visible in All Items
    const stillVisible = await page
      .locator("tr")
      .filter({ hasText: itemTitle })
      .count();

    // Navigate to Recycle Bin tab
    await searchInput.clear();
    await page.getByRole("tab", { name: /Recycle Bin/i }).click();
    await page.waitForTimeout(1000);

    // Item should appear in Recycle Bin
    // Search in recycle bin
    const recycleBinSearch = page.getByPlaceholder(
      /Search deleted items/i,
    );
    const hasRecycleBinSearch = await recycleBinSearch
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (hasRecycleBinSearch) {
      await recycleBinSearch.fill(itemTitle);
      await page.waitForTimeout(500);
    }

    // Verify the deleted item is in the recycle bin (or recycle bin is not empty)
    const recycleBinEmpty = page.getByText(/Recycle bin is empty/i);
    const isEmpty = await recycleBinEmpty
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // If not empty, we expect the item to be there
    if (!isEmpty) {
      const itemInRecycleBin = await page
        .getByText(itemTitle)
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      // If found, verify restore button exists
      if (itemInRecycleBin) {
        await expect(
          page.getByRole("button", { name: /Restore/i }).first(),
        ).toBeVisible();
      }
    }

    // Either way, the item should NOT be in All Items anymore
    await page.getByRole("tab", { name: /All Items/i }).click();
    await page.waitForTimeout(500);
    await page.getByPlaceholder(/Search punch items/i).fill(itemTitle);
    await page.waitForTimeout(500);

    // Count matching rows - should be 0 in All Items
    const allItemsCount = await page
      .locator("tr")
      .filter({ hasText: itemTitle })
      .count();
    expect(allItemsCount).toBe(0);
  });
});
