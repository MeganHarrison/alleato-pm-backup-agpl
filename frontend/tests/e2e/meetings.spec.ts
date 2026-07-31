/**
 * Meetings tool — end-to-end coverage of the core workflow:
 * create meeting via the full-page form → detail page → add category →
 * add item → inline-edit item status → convert to minutes → record
 * official minutes text → create follow-up (carries items) →
 * previous-minutes visible on carried item → soft delete from list →
 * recycle bin restore.
 *
 * Runs against project 876 on this worktree's dedicated dev server
 * (see playwright.config.ts baseURL / PLAYWRIGHT_BASE_URL).
 *
 * Tests run serially and share meeting/follow-up ids captured from the
 * create/follow-up steps — the list page groups meetings by series behind a
 * collapsed expand toggle, so navigating straight to `/PROJECT/meetings/ID`
 * is the reliable way to reach a specific meeting's detail page instead of
 * re-deriving it from the (collapsed) list UI on every test.
 */
import { test, expect, type Locator, type Page } from "@playwright/test";

const PROJECT_ID = "876";
const BASE_MEETINGS_URL = `/${PROJECT_ID}/meetings`;

test.use({ storageState: "tests/.auth/user.json" });

test.describe.configure({ mode: "serial" });

const RUN_ID = Date.now();
const MEETING_NAME = `E2E Meeting ${RUN_ID}`;
const CATEGORY_NAME = `E2E Category ${RUN_ID}`;
const ITEM_TITLE = `E2E Item ${RUN_ID}`;
const OFFICIAL_MINUTES_TEXT = `Official minutes recorded during e2e run ${RUN_ID}.`;

// Populated by the "create meeting" / "create follow-up" tests and reused by
// later tests in the serial run.
let meetingId = "";
let followUpMeetingId = "";

function meetingDetailUrl(id: string): string {
  return `/${PROJECT_ID}/meetings/${id}/agenda`;
}

// Short settle wait after the first hydration-dependent element becomes
// visible. Next.js can paint server-streamed HTML for text content a beat
// before React finishes attaching event handlers to nearby interactive
// elements — clicking immediately on that signal intermittently no-ops.
async function settleAfterHydration(page: Page) {
  await page.waitForTimeout(1500);
}

/**
 * Clicks `trigger` and waits for `expectVisible` to appear, retrying the
 * click a few times if it doesn't. This dev server compiles routes/chunks
 * on first hit (Turbopack), which occasionally delays a click's effect long
 * enough that a single-shot `.click()` + `expect().toBeVisible()` flakes —
 * re-clicking is harmless here (opening an already-open dialog / re-firing
 * an idempotent toggle) and makes the wait resilient to that cold-start tax.
 */
async function clickUntilVisible(
  trigger: Locator,
  expectVisible: Locator,
  attempts = 4,
): Promise<void> {
  await trigger.waitFor({ state: "visible" });
  // First paint can beat hydration on a cold dev server; clicks before React
  // attaches handlers silently no-op, so wait for the network to settle once.
  await trigger.page().waitForLoadState("networkidle").catch(() => undefined);
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await trigger.click();
    try {
      await expect(expectVisible).toBeVisible({ timeout: 15000 });
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
    }
  }
}

/**
 * Opens a dropdown/menu via `menuTrigger` and clicks `menuItem`, treating
 * "open the menu" + "click the item" as one retry-safe unit — a menu opened
 * under the dev server's cold-compile tax can auto-close before a second,
 * separate click reaches it, so re-open + re-click together on failure
 * instead of assuming the menu stays open across two independent steps.
 */
async function openMenuAndClickItem(
  menuTrigger: Locator,
  menuItem: Locator,
  attempts = 4,
): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await menuTrigger.click();
    const itemAppeared = await menuItem
      .waitFor({ state: "visible", timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (!itemAppeared) continue;

    await menuItem.click();
    return;
  }
  // Final attempt — let the natural assertion failure below report why.
  await menuTrigger.click();
  await menuItem.click();
}

async function openMeetingDetail(page: Page, id: string) {
  await page.goto(meetingDetailUrl(id), { waitUntil: "domcontentloaded" });
  const generalInfo = page.getByText("General Information");
  try {
    await expect(generalInfo).toBeVisible({ timeout: 20000 });
  } catch {
    // Turbopack compiles API routes on first hit in dev, which can push a
    // cold request past the first timeout window. Reload once and give it
    // a longer runway before treating this as a real failure.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(generalInfo).toBeVisible({ timeout: 30000 });
  }
  await settleAfterHydration(page);
}

test.describe("Meetings tool", () => {
  test("create meeting via full page form", async ({ page }) => {
    // Complaint #2: create meeting must be a full page, not a modal — there
    // is no more "open dialog" step here, just a direct navigation.
    await page.goto(`/${PROJECT_ID}/meetings/new`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Create Meeting" })).toBeVisible({
      timeout: 20000,
    });
    // No modal/dialog role should be present — this is a full page.
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.getByLabel("Meeting Name *").fill(MEETING_NAME);

    // Complaint #1: start/end time fields must accept natural typing
    // (including a literal colon) and actually hold the value.
    const startTimeInput = page.getByLabel("Start Time");
    await startTimeInput.click();
    await startTimeInput.pressSequentially("9:00 AM", { delay: 30 });
    await startTimeInput.blur();
    await expect(startTimeInput).toHaveValue("09:00");

    const endTimeInput = page.getByLabel("End Time");
    await endTimeInput.click();
    await endTimeInput.pressSequentially("10:30 AM", { delay: 30 });
    await endTimeInput.blur();
    await expect(endTimeInput).toHaveValue("10:30");

    // Complaint #3: attendee picker must actually let you select people.
    const attendeesTrigger = page.getByRole("combobox").last();
    await attendeesTrigger.scrollIntoViewIfNeeded();
    await attendeesTrigger.click();
    const firstOption = page.getByRole("option").first();
    await expect(firstOption).toBeVisible({ timeout: 10000 });
    await firstOption.click();
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-slot="badge"]').first()).toBeVisible();

    await page.getByRole("button", { name: "Create Meeting" }).click();

    // Submitting navigates to the new meeting's agenda route.
    await page.waitForURL(new RegExp(`/${PROJECT_ID}/meetings/[^/]+/agenda$`), {
      timeout: 15000,
      waitUntil: "commit",
    });
    meetingId = new URL(page.url()).pathname.split("/").at(-2)!;
    expect(meetingId).toBeTruthy();

    await expect(page.getByText(MEETING_NAME).first()).toBeVisible();
  });

  test("detail page shows general information and default agenda section", async ({ page }) => {
    await openMeetingDetail(page, meetingId);

    await expect(page.getByText("General Information")).toBeVisible();
    await expect(page.getByTestId("agenda-section")).toBeVisible();
    // A freshly-created meeting starts with an "Uncategorized Items" category.
    await expect(page.getByTestId("agenda-category").first()).toBeVisible();
  });

  test("add category", async ({ page }) => {
    await openMeetingDetail(page, meetingId);

    const categoryInput = page.getByPlaceholder("Category name");
    await clickUntilVisible(page.getByRole("button", { name: "Add category" }), categoryInput);
    await categoryInput.fill(CATEGORY_NAME);
    // `fill()` sets the value without a real keyboard event; give React's
    // controlled-input state a beat to catch up before pressing Enter,
    // otherwise the keydown handler can read stale (empty) state and skip
    // the create call entirely.
    await page.waitForTimeout(300);

    const createCategoryResponsePromise = page.waitForResponse(
      (res) =>
        res.request().method() === "POST" &&
        /\/api\/projects\/\d+\/meetings\/[^/]+\/categories$/.test(new URL(res.url()).pathname),
      { timeout: 15000 },
    );
    await categoryInput.press("Enter");
    const createCategoryResponse = await createCategoryResponsePromise;
    expect(createCategoryResponse.status()).toBe(201);

    await expect(page.getByText(CATEGORY_NAME)).toBeVisible();
  });

  test("add item to the new category", async ({ page }) => {
    await openMeetingDetail(page, meetingId);

    const categoryBlock = page.getByTestId("agenda-category").filter({ hasText: CATEGORY_NAME });
    await expect(categoryBlock).toBeVisible();

    const quickAddInput = categoryBlock.getByPlaceholder("Add item…");
    await quickAddInput.fill(ITEM_TITLE);
    await page.waitForTimeout(300);

    const createItemResponsePromise = page.waitForResponse(
      (res) =>
        res.request().method() === "POST" &&
        /\/api\/projects\/\d+\/meetings\/[^/]+\/items$/.test(new URL(res.url()).pathname),
      { timeout: 15000 },
    );
    await quickAddInput.press("Enter");
    const createItemResponse = await createItemResponsePromise;
    expect(createItemResponse.status()).toBe(201);

    await expect(page.getByTestId("agenda-item-row").filter({ hasText: ITEM_TITLE })).toBeVisible();
  });

  test("inline-edit item status", async ({ page }) => {
    await openMeetingDetail(page, meetingId);

    const itemRow = page.getByTestId("agenda-item-row").filter({ hasText: ITEM_TITLE });
    await expect(itemRow).toBeVisible();

    // Status select is the first combobox-style trigger in the item row.
    const statusTrigger = itemRow.getByRole("combobox").first();
    const inProgressOption = page.getByRole("option", { name: "In Progress" });

    const patchResponsePromise = page.waitForResponse(
      (res) =>
        res.request().method() === "PATCH" &&
        /\/api\/projects\/\d+\/meetings\/[^/]+\/items\/[^/]+$/.test(new URL(res.url()).pathname),
      { timeout: 15000 },
    );
    await openMenuAndClickItem(statusTrigger, inProgressOption);
    const patchResponse = await patchResponsePromise;
    expect(patchResponse.status()).toBe(200);
    const patchBody = (await patchResponse.json()) as { status?: string };
    expect(patchBody.status).toBe("in_progress");

    await expect(statusTrigger).toContainText("In Progress");
  });

  test("convert to minutes and record official minutes text", async ({ page }) => {
    await openMeetingDetail(page, meetingId);

    // A single click, not a retry loop — this is a mutating POST, and
    // re-clicking while a cold-compiled route is still resolving the first
    // request can fire the mutation multiple times concurrently. Give the
    // (possibly first-hit / Turbopack-compiling) route a generous timeout
    // instead of retrying the click.
    const convertResponsePromise = page.waitForResponse(
      (res) =>
        res.request().method() === "POST" &&
        /\/api\/projects\/\d+\/meetings\/[^/]+\/convert$/.test(new URL(res.url()).pathname),
      { timeout: 60000 },
    );
    await page.getByRole("button", { name: "Convert to Minutes" }).click();
    const convertResponse = await convertResponsePromise;
    expect(convertResponse.status()).toBe(200);
    await expect(page.getByRole("button", { name: "Revert to Agenda" })).toBeVisible({
      timeout: 15000,
    });

    const itemRow = page.getByTestId("agenda-item-row").filter({ hasText: ITEM_TITLE });
    // Expand the item to reveal the Official Minutes textarea.
    await itemRow.getByRole("button", { name: "Expand item" }).click();

    const minutesField = itemRow.getByPlaceholder("Record the official minutes for this item…");
    await expect(minutesField).toBeVisible();
    await minutesField.fill(OFFICIAL_MINUTES_TEXT);
    // `fill()` sets the value without a real keyboard event; give React's
    // controlled-input state a beat to catch up before blurring, otherwise
    // the blur handler can read stale state and the PATCH commits nothing
    // (UI still shows the typed value locally, masking the failed persist).
    await page.waitForTimeout(300);

    const commitResponsePromise = page.waitForResponse(
      (res) =>
        res.request().method() === "PATCH" &&
        /\/api\/projects\/\d+\/meetings\/[^/]+\/items\/[^/]+$/.test(new URL(res.url()).pathname),
      { timeout: 15000 },
    );
    // Blur commits the draft.
    await itemRow.getByText("Tasks").click();
    const commitResponse = await commitResponsePromise;
    expect(commitResponse.status()).toBe(200);
    const commitBody = (await commitResponse.json()) as { official_minutes?: string | null };
    expect(commitBody.official_minutes).toBe(OFFICIAL_MINUTES_TEXT);

    await expect(minutesField).toHaveValue(OFFICIAL_MINUTES_TEXT);
  });

  test("create follow-up meeting carries open items with previous minutes visible", async ({
    page,
  }) => {
    await openMeetingDetail(page, meetingId);

    const moreActionsButton = page.getByRole("button", { name: "More actions" });
    const createFollowUpItem = page.getByRole("menuitem", { name: "Create Follow-Up Meeting" });

    // Opening the menu is safe to retry (idempotent toggle), but creating
    // the follow-up is a real POST — retrying that click risks creating
    // multiple follow-up meetings. So: retry only the "menu opened" step,
    // then click the item exactly once and confirm success via the actual
    // network response rather than a URL-shape guess (the destination URL
    // has the same shape as the source, so `waitForURL` can't disambiguate
    // "navigated" from "already there").
    await clickUntilVisible(moreActionsButton, createFollowUpItem);

    const followUpResponsePromise = page.waitForResponse(
      (res) =>
        res.request().method() === "POST" &&
        /\/api\/projects\/\d+\/meetings\/[^/]+\/follow-up$/.test(new URL(res.url()).pathname),
      { timeout: 15000 },
    );
    await createFollowUpItem.click();
    const followUpResponse = await followUpResponsePromise;
    expect(followUpResponse.status()).toBe(201);
    const followUpBody = (await followUpResponse.json()) as { meeting: { id: string } };
    followUpMeetingId = followUpBody.meeting.id;
    expect(followUpMeetingId).toBeTruthy();
    expect(followUpMeetingId).not.toBe(meetingId);

    await page.waitForURL(new RegExp(`/${PROJECT_ID}/meetings/${followUpMeetingId}$`), {
      timeout: 15000,
      waitUntil: "commit",
    });

    const carriedItemRow = page.getByTestId("agenda-item-row").filter({ hasText: ITEM_TITLE });
    await expect(carriedItemRow).toBeVisible();

    await carriedItemRow.getByRole("button", { name: "Expand item" }).click();
    await carriedItemRow.getByText("Previous Minutes").click();

    await expect(carriedItemRow.getByText(OFFICIAL_MINUTES_TEXT)).toBeVisible();
  });

  test("soft delete and restore round-trip (API contract)", async ({ page }) => {
    // The project meetings list is the legacy transcript table (reverted per
    // product decision 2026-07-02); structured planning meetings have no list
    // UI for delete/restore right now, so this covers the API contract the
    // future UI will call.
    const base = `/api/projects/${PROJECT_ID}/meetings/${meetingId}`;

    const del = await page.request.delete(base);
    expect(del.status()).toBe(200);

    // Soft-deleted meetings 404 on detail fetch...
    const afterDelete = await page.request.get(base);
    expect(afterDelete.status()).toBe(404);

    // ...and restore brings the full detail back.
    const restore = await page.request.post(`${base}/restore`);
    expect(restore.status()).toBe(200);
    const afterRestore = await page.request.get(base);
    expect(afterRestore.status()).toBe(200);
    const detail = (await afterRestore.json()) as { meeting?: { id?: string } };
    expect(detail.meeting?.id).toBe(meetingId);
  });
});
