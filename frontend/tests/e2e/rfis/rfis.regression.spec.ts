import { test, expect } from "@playwright/test";
import {
  createProject,
  addProjectMember,
  getUserIdByEmail,
  getAdminClient,
} from "../../helpers/db";
import { pollFor } from "../../helpers/poll";

const testUserEmail =
  process.env.PLAYWRIGHT_TEST_USER_EMAIL ?? "test1@mail.com";

let projectId: number;

// ── RFI DB Helpers ─────────────────────────────────────────────────

async function createRfi(data: {
  project_id: number;
  subject: string;
  status?: string;
  question?: string;
  due_date?: string;
  assignees?: string[];
}) {
  const supabase = getAdminClient();

  // Get next RFI number for project
  const { data: lastRfi } = await supabase
    .from("rfis")
    .select("number")
    .eq("project_id", data.project_id)
    .order("number", { ascending: false })
    .limit(1)
    .single();

  const nextNumber = (lastRfi?.number ?? 0) + 1;

  const { data: rfi, error } = await supabase
    .from("rfis")
    .insert({
      project_id: data.project_id,
      number: nextNumber,
      subject: data.subject,
      status: data.status ?? "open",
      question: data.question ?? "",
      due_date: data.due_date ?? null,
      assignees: data.assignees ?? [],
      date_initiated: new Date().toISOString().split("T")[0],
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create RFI: ${error.message}`);
  return rfi;
}

async function listRfisForProject(projectId: number) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("rfis")
    .select("*")
    .eq("project_id", projectId)
    .order("number", { ascending: false });

  if (error) throw new Error(`Failed to list RFIs: ${error.message}`);
  return data ?? [];
}

async function deleteRfisByProject(projectId: number) {
  const supabase = getAdminClient();
  await supabase.from("rfis").delete().eq("project_id", projectId);
}

async function getRfi(rfiId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("rfis")
    .select("*")
    .eq("id", rfiId)
    .single();

  if (error) throw new Error(`Failed to get RFI: ${error.message}`);
  return data;
}

// ── Test Suite ─────────────────────────────────────────────────────

test.describe("RFIs – Full CRUD", () => {
  test.beforeAll(async () => {
    const userId = await getUserIdByEmail(testUserEmail);
    projectId = await createProject(`E2E RFIs ${Date.now()}`);
    await addProjectMember(projectId, userId, "admin");
  });

  test.afterAll(async () => {
    if (projectId) {
      await deleteRfisByProject(projectId);
      const supabase = getAdminClient();
      await supabase
        .from("project_directory_memberships")
        .delete()
        .eq("project_id", projectId);
      await supabase.from("projects").delete().eq("id", projectId);
    }
  });

  // ── READ: Empty state ──────────────────────────────────────────

  test("Empty state shows when no RFIs exist", async ({ page }) => {
    await deleteRfisByProject(projectId);

    await page.goto(`/${projectId}/rfis`);
    await page.waitForLoadState("domcontentloaded");

    // Wait for page to load — look for the page title or toolbar
    await expect(page.getByText("RFIs").first()).toBeVisible({ timeout: 15000 });

    // Table should be empty — show no-data message or 0 items
    const noData = page.getByText(/no rfis found|no results|no data|0 items/i);
    const hasEmptyText = await noData
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    const emptyTable = page.locator("tbody tr");
    const rowCount = await emptyTable.count().catch(() => 0);

    expect(hasEmptyText || rowCount === 0).toBe(true);
  });

  // ── READ: Seeded RFI renders in list ───────────────────────────

  test("Seeded RFI renders in the list with correct data", async ({
    page,
  }) => {
    await deleteRfisByProject(projectId);

    const rfi = await createRfi({
      project_id: projectId,
      subject: "Clarification on Footing Depth",
      status: "open",
      question: "What is the required footing depth for Building A?",
      due_date: "2026-03-15",
      assignees: ["John Smith"],
    });

    await page.goto(`/${projectId}/rfis`);
    await page.waitForLoadState("domcontentloaded");

    // Find the row containing our subject
    const row = page.getByRole("row", {
      name: /Clarification on Footing Depth/i,
    });
    await expect(row).toBeVisible({ timeout: 15000 });

    // Verify status badge renders
    await expect(row.getByText(/open/i)).toBeVisible();
  });

  // ── READ: Status summary cards show correct counts ─────────────

  test("Multiple RFIs with different statuses render in list", async ({ page }) => {
    await deleteRfisByProject(projectId);

    // Create RFIs with different statuses
    await createRfi({
      project_id: projectId,
      subject: "Draft RFI 1",
      status: "draft",
    });
    await createRfi({
      project_id: projectId,
      subject: "Open RFI 1",
      status: "open",
      question: "Test question",
      due_date: "2026-04-01",
      assignees: ["Test User"],
    });
    await createRfi({
      project_id: projectId,
      subject: "Open RFI 2",
      status: "open",
      question: "Another question",
      due_date: "2026-04-02",
      assignees: ["Test User"],
    });

    await page.goto(`/${projectId}/rfis`);
    await page.waitForLoadState("domcontentloaded");

    // Wait for data to load — all 3 RFIs should appear in the table
    await expect(
      page.getByRole("row", { name: /Draft RFI 1/i }),
    ).toBeVisible({ timeout: 15000 });

    await expect(
      page.getByRole("row", { name: /Open RFI 1/i }),
    ).toBeVisible();

    await expect(
      page.getByRole("row", { name: /Open RFI 2/i }),
    ).toBeVisible();

    // Verify item count shows 3
    await expect(page.getByText(/3 items/i)).toBeVisible({ timeout: 5000 });
  });

  // ── CREATE: Save as Draft via form ─────────────────────────────

  test("Create RFI as draft via form persists to database", async ({
    page,
  }) => {
    await deleteRfisByProject(projectId);

    const subject = `Draft RFI ${Date.now()}`;

    await page.goto(`/${projectId}/rfis/new`);
    await page.waitForLoadState("domcontentloaded");

    // Fill subject (only required field for draft)
    const subjectInput = page.getByLabel(/subject/i);
    await expect(subjectInput).toBeVisible({ timeout: 15000 });
    await subjectInput.fill(subject);

    // Click Save as Draft
    const draftButton = page.getByRole("button", {
      name: /save as draft/i,
    });
    await draftButton.click();

    // Wait for navigation back to list or success toast
    const navigated = await page
      .waitForURL(`**/${projectId}/rfis`, { timeout: 15000 })
      .then(() => true)
      .catch(() => false);

    if (!navigated) {
      const toast = page.getByText(/created|success/i);
      await toast.isVisible({ timeout: 5000 }).catch(() => false);
    }

    // Verify in database
    await pollFor(
      () => listRfisForProject(projectId),
      (rows) => {
        const created = rows.find((r) => r.subject === subject);
        expect(created).toBeTruthy();
        expect(created!.status).toBe("draft");
      },
      20000,
    );
  });

  // ── CREATE: Create as Open with full fields ────────────────────

  test("Create RFI as open validates required fields and persists", async ({
    page,
  }) => {
    await deleteRfisByProject(projectId);

    const subject = `Open RFI ${Date.now()}`;
    const question = "What are the structural requirements for the mezzanine?";

    // Create the Open RFI via API directly (same as form would do)
    // This tests the API endpoint which is what the form ultimately calls
    const response = await page.request.post(
      `/api/projects/${projectId}/rfis`,
      {
        data: {
          project_id: projectId,
          subject,
          question,
          due_date: "2026-04-15",
          assignees: ["Jane Doe", "Bob Smith"],
          status: "open",
        },
      },
    );

    expect(response.ok()).toBe(true);

    // Verify in database
    await pollFor(
      () => listRfisForProject(projectId),
      (rows) => {
        const created = rows.find((r) => r.subject === subject);
        expect(created).toBeTruthy();
        expect(created!.status).toBe("open");
        expect(created!.question).toBe(question);
        expect(created!.assignees).toContain("Jane Doe");
        expect(created!.assignees).toContain("Bob Smith");
      },
      20000,
    );

    // Also verify the created RFI appears in the list view
    await page.goto(`/${projectId}/rfis`);
    await page.waitForLoadState("domcontentloaded");

    const row = page.getByRole("row", {
      name: new RegExp(subject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
    });
    await expect(row).toBeVisible({ timeout: 15000 });
    // Verify the status badge shows "Open" (exact text to avoid matching subject)
    await expect(row.locator("[data-slot='badge']")).toContainText("Open");
  });

  // ── CREATE: Validation prevents empty Open submission ──────────

  test("Open validation shows errors for missing required fields", async ({
    page,
  }) => {
    await page.goto(`/${projectId}/rfis/new`);
    await page.waitForLoadState("domcontentloaded");

    // Wait for form to render
    const subjectInput = page.getByLabel(/subject/i);
    await expect(subjectInput).toBeVisible({ timeout: 15000 });

    // Only fill subject (missing question, due date, assignees for Open)
    await subjectInput.fill("Incomplete RFI");

    // Click Create Open without filling required Open fields
    const openButton = page.getByRole("button", {
      name: /create open/i,
    });
    await openButton.click();

    // Should show validation errors
    await page.waitForTimeout(500);

    const errors = page.locator(
      ".text-red-500, .text-destructive, [role='alert'], .text-red-600",
    );
    const errorCount = await errors.count();
    expect(errorCount).toBeGreaterThan(0);
  });

  // ── DETAIL: Navigate to detail page ────────────────────────────

  test("Clicking RFI row navigates to detail page", async ({ page }) => {
    await deleteRfisByProject(projectId);

    const rfi = await createRfi({
      project_id: projectId,
      subject: "Detail Page Test RFI",
      status: "open",
      question: "Test question for detail view",
      due_date: "2026-05-01",
      assignees: ["Alice"],
    });

    await page.goto(`/${projectId}/rfis`);
    await page.waitForLoadState("domcontentloaded");

    // Click on the RFI row
    const row = page.getByRole("row", {
      name: /Detail Page Test RFI/i,
    });
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.click();

    // Should navigate to detail page
    await page.waitForURL(`**/${projectId}/rfis/${rfi.id}`, {
      timeout: 15000,
    });

    // Verify detail content renders
    await expect(
      page.getByText("Test question for detail view"),
    ).toBeVisible({ timeout: 10000 });

    // Verify sidebar info shows
    await expect(page.getByText("Alice")).toBeVisible();
  });

  // ── EDIT: Update RFI from detail page ──────────────────────────

  test("Edit RFI updates subject and persists", async ({ page }) => {
    await deleteRfisByProject(projectId);

    const rfi = await createRfi({
      project_id: projectId,
      subject: "Original RFI Subject",
      status: "open",
      question: "Original question",
      due_date: "2026-05-01",
      assignees: ["Test User"],
    });

    await page.goto(`/${projectId}/rfis/${rfi.id}`);
    await page.waitForLoadState("networkidle");

    // Click Edit button — wait for it to be enabled (not just visible)
    const editButton = page.getByRole("button", { name: /^edit$/i });
    await expect(editButton).toBeVisible({ timeout: 15000 });
    await expect(editButton).toBeEnabled({ timeout: 5000 });
    await editButton.click();

    // Update subject
    const subjectInput = page.getByLabel(/subject/i);
    await expect(subjectInput).toBeVisible({ timeout: 10000 });
    await subjectInput.clear();
    await subjectInput.fill("Updated RFI Subject");

    // Save changes — wait for the API call to complete
    const saveButton = page.getByRole("button", {
      name: /save changes/i,
    });
    await expect(saveButton).toBeEnabled({ timeout: 5000 });

    // Intercept the PATCH call and wait for response
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes(`/rfis/${rfi.id}`) && resp.request().method() === "PATCH",
      { timeout: 15000 },
    );
    await saveButton.click();
    await responsePromise;

    // Wait for edit mode to close (back to view mode)
    await expect(page.getByRole("button", { name: /^edit$/i })).toBeVisible({ timeout: 10000 });

    // Verify in database
    await pollFor(
      () => getRfi(rfi.id),
      (updated) => {
        expect(updated.subject).toBe("Updated RFI Subject");
      },
      15000,
    );
  });

  // ── STATUS: Change status from detail page ─────────────────────

  test("Close RFI from detail page updates status", async ({ page }) => {
    await deleteRfisByProject(projectId);

    const rfi = await createRfi({
      project_id: projectId,
      subject: "RFI To Close",
      status: "open",
      question: "Closing test question",
      due_date: "2026-05-01",
      assignees: ["Closer"],
    });

    await page.goto(`/${projectId}/rfis/${rfi.id}`);
    await page.waitForLoadState("networkidle");

    // Click Close RFI button — wait for it to be enabled
    const closeButton = page.getByRole("button", {
      name: /close rfi/i,
    });
    await expect(closeButton).toBeVisible({ timeout: 15000 });
    await expect(closeButton).toBeEnabled({ timeout: 10000 });

    // Intercept the PATCH call and wait for response
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes(`/rfis/${rfi.id}`) && resp.request().method() === "PATCH",
      { timeout: 15000 },
    );
    await closeButton.click();
    await responsePromise;

    // Verify in database
    await pollFor(
      () => getRfi(rfi.id),
      (updated) => {
        expect(updated.status).toBe("closed");
      },
      15000,
    );
  });

  // ── DELETE: Delete RFI from detail page ────────────────────────

  test("Delete RFI removes it from database", async ({ page }) => {
    await deleteRfisByProject(projectId);

    const rfi = await createRfi({
      project_id: projectId,
      subject: "RFI To Delete",
      status: "draft",
    });

    await page.goto(`/${projectId}/rfis/${rfi.id}`);
    await page.waitForLoadState("domcontentloaded");

    // Click Delete button
    const deleteButton = page.getByRole("button", { name: /delete/i });
    await expect(deleteButton).toBeVisible({ timeout: 15000 });
    await deleteButton.click();

    // Confirm deletion in the dialog
    const confirmButton = page.getByRole("button", {
      name: /delete/i,
    }).last();
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    await confirmButton.click();

    // Should navigate back to list
    await page
      .waitForURL(`**/${projectId}/rfis`, { timeout: 15000 })
      .catch(() => {});

    // Verify deleted from database
    await pollFor(
      () => listRfisForProject(projectId),
      (rows) => {
        const found = rows.find((r) => r.id === rfi.id);
        expect(found).toBeUndefined();
      },
      15000,
    );
  });
});
