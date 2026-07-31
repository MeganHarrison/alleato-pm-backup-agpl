import { test, expect } from "@playwright/test";

function ymd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function getFirstProjectId(request: any, baseURL: string) {
  const resp = await request.get(`${baseURL}/api/projects?limit=1&archived=false`);
  const json = await resp.json();
  const id = json?.data?.[0]?.id;
  return id;
}

test.describe("Daily Logs CRUD", () => {
  test("create, edit, and delete a daily log", async ({ page, request, baseURL }) => {
    const projectId = await getFirstProjectId(request, baseURL!);
    test.skip(!projectId, "No project available for testing");

    const today = ymd(new Date());

    // Navigate
    await page.goto(`/${projectId}/daily-log`);
    await page.waitForLoadState('networkidle');

    // Create
    await page.getByRole('button', { name: 'Create Log Entry' }).click();
    await page.getByLabel('Date (YYYY-MM-DD)').fill(today);
    await page.getByRole('button', { name: 'Create' }).click();

    // Refresh to fetch server data
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Filter by date to locate the row
    const search = page.locator('input[placeholder*="Search" i]').first();
    await search.fill(today);
    await page.waitForTimeout(300);

    // Open row actions and edit
    const actions = page.getByRole('button', { name: 'Row actions' }).first();
    await actions.click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    // Fill Weather textarea with simple JSON
    await page.getByLabel('Weather').fill('{"conditions":"Clear"}');
    await page.getByRole('button', { name: 'Save changes' }).click();

    // Verify cell shows updated content (truncated JSON containing Clear)
    await expect(page.locator('text=Clear')).toBeVisible();

    // Delete the row
    await actions.click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();

    // Refresh and confirm absence
    await page.reload();
    await page.waitForLoadState('networkidle');
    await search.fill(today);
    await page.waitForTimeout(300);
    // No table row with that date
    const hasDate = await page.locator(`text=${today}`).count();
    expect(hasDate).toBe(0);
  });
});
