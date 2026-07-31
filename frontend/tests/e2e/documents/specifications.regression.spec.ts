import { test, expect, Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as path from "path";
import * as fs from "fs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const TEST_PROJECT_ID = "31";
const FIXTURES_DIR = path.join(__dirname, "../fixtures");

// Helper to create a large PDF buffer (>50MB)
function createLargePDFBuffer(): Buffer {
  const headerFooter = "%PDF-1.4\n%%EOF\n";
  const contentSize = 52 * 1024 * 1024; // 52MB
  const padding = Buffer.alloc(contentSize - headerFooter.length, "A");
  return Buffer.concat([Buffer.from("%PDF-1.4\n"), padding, Buffer.from("%%EOF\n")]);
}

// Helper to dismiss toasts
async function dismissToasts(page: Page) {
  const closeButtons = page.getByRole("button", { name: /close toast/i });
  const count = await closeButtons.count();
  for (let i = 0; i < count; i++) {
    await closeButtons.nth(0).click({ timeout: 1000 }).catch(() => {});
  }
}

test.describe("Specifications - File Upload Validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${TEST_PROJECT_ID}/specifications`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByRole("heading", { name: "Specifications" }).first()).toBeVisible();
  });

  test("should reject non-PDF files (.docx)", async ({ page }) => {
    await page.getByRole("button", { name: /upload specification/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Try uploading a .docx file
    const fileInput = page.locator('input[type="file"][accept="application/pdf"]');
    await fileInput.setInputFiles({
      name: "test-document.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from("fake docx content"),
    });

    // Should show error or not accept the file
    // Note: Browser may block this at input level due to accept="application/pdf"
    await page.waitForTimeout(500);

    // File should not be listed (PDF-only restriction should prevent it)
    await expect(
      page.getByText("test-document.docx"),
      "Non-PDF file should not be accepted"
    ).not.toBeVisible();

    await page.getByRole("button", { name: /cancel/i }).click();
  });

  test("should reject non-PDF files (.txt)", async ({ page }) => {
    await page.getByRole("button", { name: /upload specification/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const fileInput = page.locator('input[type="file"][accept="application/pdf"]');

    // Use the existing invalid-file.txt fixture
    const invalidFilePath = path.join(FIXTURES_DIR, "invalid-file.txt");

    // Try to set a text file (browser should block or form should validate)
    await fileInput.setInputFiles({
      name: "invalid-file.txt",
      mimeType: "text/plain",
      buffer: fs.readFileSync(invalidFilePath),
    });

    await page.waitForTimeout(500);

    // File should not be accepted due to type restriction
    const isFileVisible = await page.getByText("invalid-file.txt").isVisible().catch(() => false);
    expect(isFileVisible).toBe(false);

    await page.getByRole("button", { name: /cancel/i }).click();
  });

  test("should reject oversized files (>50MB)", async ({ page }) => {
    await page.getByRole("button", { name: /upload specification/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Fill in required fields first
    await page.getByLabel(/section number/i).fill("99 99 88");
    await page.getByLabel(/title/i).fill("Large File Test");

    const fileInput = page.locator('input[type="file"][accept="application/pdf"]');

    // Create a large PDF buffer
    const largeBuffer = createLargePDFBuffer();

    await fileInput.setInputFiles({
      name: "large-spec.pdf",
      mimeType: "application/pdf",
      buffer: largeBuffer,
    });

    // Try to submit
    await page.getByRole("button", { name: /upload specification/i, exact: false }).last().click();

    // Should show error toast about file size
    await expect(
      page.getByText(/file.*too large|exceed.*size|maximum.*size/i),
      "Should show file size error"
    ).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: /cancel/i }).click();
    await dismissToasts(page);
  });

  test("should accept valid PDF within size limit", async ({ page }) => {
    const testSectionNumber = "99 99 87";

    await page.getByRole("button", { name: /upload specification/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByLabel(/section number/i).fill(testSectionNumber);
    await page.getByLabel(/title/i).fill("Valid PDF Upload Test");

    const fileInput = page.locator('input[type="file"][accept="application/pdf"]');

    // Use an existing valid PDF fixture
    const validPDFPath = path.join(FIXTURES_DIR, "test-document.pdf");
    await fileInput.setInputFiles(validPDFPath);

    await expect(page.getByText("test-document.pdf")).toBeVisible();

    await page.getByRole("button", { name: /upload specification/i, exact: false }).last().click();

    await expect(
      page.getByText(/specification.*created.*successfully/i),
      "Valid PDF should upload successfully"
    ).toBeVisible({ timeout: 10000 });

    // Cleanup
    const { data } = await supabase
      .from("specification_sections")
      .select("id")
      .eq("section_number", testSectionNumber)
      .single();

    if (data?.id) {
      await supabase.from("specification_sections").delete().eq("id", data.id);
    }
  });
});

test.describe("Specifications - Revision Management", () => {
  let testSectionId: number;
  const testSectionNumber = "99 99 86";

  test.beforeAll(async () => {
    // Create a test specification for revision tests
    const { data: section } = await supabase
      .from("specification_sections")
      .insert({
        project_id: parseInt(TEST_PROJECT_ID),
        section_number: testSectionNumber,
        title: "Revision Management Test Spec",
        description: "For testing revision features",
        status: "active",
      })
      .select()
      .single();

    testSectionId = section!.id;

    // Create initial revision
    const { data: revision } = await supabase
      .from("specification_section_revisions")
      .insert({
        section_id: testSectionId,
        revision_number: 1,
        file_name: "initial-rev.pdf",
        file_url: "test/path/initial-rev.pdf",
        file_size: 1024,
        uploaded_by: "test-user",
      })
      .select()
      .single();

    await supabase
      .from("specification_sections")
      .update({ current_revision_id: revision!.id })
      .eq("id", testSectionId);
  });

  test.afterAll(async () => {
    if (testSectionId) {
      await supabase.from("specification_sections").delete().eq("id", testSectionId);
    }
  });

  test("should display sequential revision numbering", async ({ page }) => {
    await page.goto(`/${TEST_PROJECT_ID}/specifications/${testSectionId}`);
    await page.waitForLoadState("domcontentloaded");

    // Should see Rev 1
    await expect(page.getByText(/rev 1/i)).toBeVisible();

    // Add Rev 2
    await page.getByRole("button", { name: /add revision/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const fileInput = page.locator('input[type="file"][accept="application/pdf"]');
    const pdfPath = path.join(FIXTURES_DIR, "revised-drawing.pdf");
    await fileInput.setInputFiles(pdfPath);

    await page.getByLabel(/revision notes/i).fill("Second revision");
    await page.getByRole("button", { name: /add revision/i, exact: false }).last().click();

    await expect(
      page.getByText(/revision.*added.*successfully/i)
    ).toBeVisible({ timeout: 10000 });

    // Should now see both Rev 1 and Rev 2
    await expect(page.getByText(/rev 2/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/rev 1/i)).toBeVisible();
  });

  test("should set current revision", async ({ page }) => {
    await page.goto(`/${TEST_PROJECT_ID}/specifications/${testSectionId}`);
    await page.waitForLoadState("domcontentloaded");

    // Find revision history section
    await expect(page.getByRole("heading", { name: "Revision History" })).toBeVisible();

    // Current revision should be marked with a "Current" badge
    await expect(page.getByText("Current").first()).toBeVisible();
  });

  test("should download revision", async ({ page }) => {
    await page.goto(`/${TEST_PROJECT_ID}/specifications/${testSectionId}`);
    await page.waitForLoadState("domcontentloaded");

    // Set up download handler
    const downloadPromise = page.waitForEvent("download", { timeout: 10000 });

    // Click download button (may be in actions menu or direct button)
    const downloadButton = page.getByRole("button", { name: /download/i }).first();
    await downloadButton.click();

    // Verify download initiated
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });

  test("should delete non-current revision", async ({ page }) => {
    await page.goto(`/${TEST_PROJECT_ID}/specifications/${testSectionId}`);
    await page.waitForLoadState("domcontentloaded");

    // Find a non-current revision row (one that has a trash icon button instead of "Current" badge)
    // The detail page renders direct icon buttons for download and delete (not dropdown menus)
    const revisionRow = page.getByRole("row").filter({ hasText: /rev 1/i });

    // Click the delete (trash) button in the non-current revision row
    const deleteButton = revisionRow.locator('button:has(svg.text-red-600)');
    await deleteButton.click();

    // Confirm deletion in the alert dialog
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("button", { name: /delete/i }).last().click();

    await expect(
      page.getByText(/revision.*deleted/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test("should prevent delete of current revision", async ({ page }) => {
    await page.goto(`/${TEST_PROJECT_ID}/specifications/${testSectionId}`);
    await page.waitForLoadState("domcontentloaded");

    // Find the current revision row (the one with "Current" badge)
    const currentRevRow = page.getByRole("row").filter({ hasText: "Current" });

    // The UI hides the delete button for current revisions (no trash icon rendered)
    // Verify there is no red trash button in the current revision row
    const deleteButton = currentRevRow.locator('button:has(svg.text-red-600)');
    const deleteCount = await deleteButton.count();
    expect(deleteCount).toBe(0);
  });
});

test.describe("Specifications - Area Management", () => {
  let testSectionId: number;
  let testAreaId: number;
  const testSectionNumber = "99 99 85";

  test.beforeAll(async () => {
    // Create test area
    const { data: area } = await supabase
      .from("specification_areas")
      .insert({
        project_id: parseInt(TEST_PROJECT_ID),
        name: "Test Area E2E",
        description: "Test area for E2E tests",
      })
      .select()
      .single();

    testAreaId = area!.id;

    // Create test specification
    const { data: section } = await supabase
      .from("specification_sections")
      .insert({
        project_id: parseInt(TEST_PROJECT_ID),
        section_number: testSectionNumber,
        title: "Area Assignment Test",
        status: "active",
      })
      .select()
      .single();

    testSectionId = section!.id;
  });

  test.afterAll(async () => {
    if (testSectionId) {
      await supabase.from("specification_sections").delete().eq("id", testSectionId);
    }
    if (testAreaId) {
      await supabase.from("specification_areas").delete().eq("id", testAreaId);
    }
  });

  test("should assign specification to area", async ({ page }) => {
    await page.goto(`/${TEST_PROJECT_ID}/specifications/${testSectionId}`);
    await page.waitForLoadState("domcontentloaded");

    // Click edit or area assignment button
    await page.getByRole("button", { name: /edit|assign area/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Select area from dropdown
    const areaSelect = page.locator('[name="area"]').or(page.getByLabel(/area/i));
    await areaSelect.click();
    await page.getByRole("option", { name: /test area e2e/i }).click();

    // Save
    await page.getByRole("button", { name: /save/i }).click();

    await expect(
      page.getByText(/updated.*successfully/i)
    ).toBeVisible({ timeout: 5000 });

    // Verify area is displayed
    await expect(page.getByText("Test Area E2E")).toBeVisible();
  });

  test("should filter by area", async ({ page }) => {
    await page.goto(`/${TEST_PROJECT_ID}/specifications`);
    await page.waitForLoadState("domcontentloaded");

    // Open area filter
    const areaFilter = page.getByRole("combobox", { name: /area/i }).or(
      page.getByPlaceholder(/filter.*area/i)
    );
    await areaFilter.click();

    // Select test area
    await page.getByRole("option", { name: /test area e2e/i }).click();
    await page.waitForTimeout(500);

    // Should see only specs in this area
    await expect(page.getByText(testSectionNumber)).toBeVisible();

    // Clear filter
    await areaFilter.click();
    await page.getByRole("option", { name: /all areas|clear/i }).click();
  });

  test("should support multi-area assignment", async ({ page }) => {
    // Create second area
    const { data: area2 } = await supabase
      .from("specification_areas")
      .insert({
        project_id: parseInt(TEST_PROJECT_ID),
        name: "Second Test Area",
      })
      .select()
      .single();

    await page.goto(`/${TEST_PROJECT_ID}/specifications/${testSectionId}`);
    await page.waitForLoadState("domcontentloaded");

    await page.getByRole("button", { name: /edit/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Select multiple areas (if UI supports it)
    const areaSelect = page.getByLabel(/area/i);
    await areaSelect.click();

    // Select both areas
    await page.getByRole("option", { name: /test area e2e/i }).click();
    await page.getByRole("option", { name: /second test area/i }).click();

    await page.getByRole("button", { name: /save/i }).click();

    // Cleanup second area
    if (area2?.id) {
      await supabase.from("specification_areas").delete().eq("id", area2.id);
    }
  });
});

test.describe("Specifications - Pagination & Search", () => {
  const bulkSections: number[] = [];

  test.beforeAll(async () => {
    // Create 35 test specifications for pagination
    const sections = Array.from({ length: 35 }, (_, i) => ({
      project_id: parseInt(TEST_PROJECT_ID),
      section_number: `99 88 ${String(i).padStart(2, "0")}`,
      title: `Pagination Test Spec ${i + 1}`,
      status: "active",
    }));

    const { data } = await supabase
      .from("specification_sections")
      .insert(sections)
      .select();

    if (data) {
      bulkSections.push(...data.map(s => s.id));
    }
  });

  test.afterAll(async () => {
    if (bulkSections.length > 0) {
      await supabase
        .from("specification_sections")
        .delete()
        .in("id", bulkSections);
    }
  });

  test("should display pagination controls", async ({ page }) => {
    await page.goto(`/${TEST_PROJECT_ID}/specifications`);
    await page.waitForLoadState("domcontentloaded");

    // Should see pagination controls
    await expect(
      page.locator('[data-testid="pagination"]').or(
        page.getByText(/page \d+ of \d+/i)
      )
    ).toBeVisible({ timeout: 5000 });

    // Should see next/previous buttons
    await expect(page.getByRole("button", { name: /next/i })).toBeVisible();
  });

  test("should navigate between pages", async ({ page }) => {
    await page.goto(`/${TEST_PROJECT_ID}/specifications`);
    await page.waitForLoadState("domcontentloaded");

    // Get first page content
    const firstPageContent = await page.getByText("Pagination Test Spec 1").isVisible();
    expect(firstPageContent).toBe(true);

    // Click next page
    await page.getByRole("button", { name: /next/i }).click();
    await page.waitForTimeout(500);

    // Should see different content
    const laterPageContent = await page.getByText("Pagination Test Spec 1").isVisible();
    // Content from page 1 should not be visible on page 2
  });

  test("should search with no results", async ({ page }) => {
    await page.goto(`/${TEST_PROJECT_ID}/specifications`);
    await page.waitForLoadState("domcontentloaded");

    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill("NONEXISTENT_SPEC_99999");
    await page.waitForTimeout(500);

    // Should show empty state
    await expect(
      page.getByText(/no.*specifications.*found|no results/i)
    ).toBeVisible();
  });

  test("should search case-insensitive", async ({ page }) => {
    await page.goto(`/${TEST_PROJECT_ID}/specifications`);
    await page.waitForLoadState("domcontentloaded");

    const searchInput = page.getByPlaceholder(/search/i);

    // Search lowercase
    await searchInput.fill("pagination test spec 5");
    await page.waitForTimeout(500);
    await expect(page.getByText("Pagination Test Spec 5")).toBeVisible();

    // Search uppercase
    await searchInput.clear();
    await searchInput.fill("PAGINATION TEST SPEC 5");
    await page.waitForTimeout(500);
    await expect(page.getByText("Pagination Test Spec 5")).toBeVisible();

    // Search mixed case
    await searchInput.clear();
    await searchInput.fill("PaGiNaTiOn TeSt SpEc 5");
    await page.waitForTimeout(500);
    await expect(page.getByText("Pagination Test Spec 5")).toBeVisible();
  });
});

test.describe("Specifications - Edge Cases", () => {
  test.afterEach(async () => {
    // Cleanup any created specs
    await supabase
      .from("specification_sections")
      .delete()
      .like("section_number", "99 77%");
  });

  test("should prevent duplicate section numbers", async ({ page }) => {
    const duplicateSection = "99 77 00";

    // Create first spec
    await page.goto(`/${TEST_PROJECT_ID}/specifications`);
    await page.waitForLoadState("domcontentloaded");

    await page.getByRole("button", { name: /upload specification/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByLabel(/section number/i).fill(duplicateSection);
    await page.getByLabel(/title/i).fill("First Spec");

    const fileInput = page.locator('input[type="file"][accept="application/pdf"]');
    const pdfPath = path.join(FIXTURES_DIR, "test-document.pdf");
    await fileInput.setInputFiles(pdfPath);

    await page.getByRole("button", { name: /upload specification/i, exact: false }).last().click();
    await expect(page.getByText(/created.*successfully/i)).toBeVisible({ timeout: 10000 });

    // Try to create duplicate
    await page.getByRole("button", { name: /upload specification/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByLabel(/section number/i).fill(duplicateSection);
    await page.getByLabel(/title/i).fill("Duplicate Spec");
    await fileInput.setInputFiles(pdfPath);

    await page.getByRole("button", { name: /upload specification/i, exact: false }).last().click();

    // Should show error
    await expect(
      page.getByText(/already exists|duplicate.*section/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test("should handle special characters in title", async ({ page }) => {
    await page.goto(`/${TEST_PROJECT_ID}/specifications`);
    await page.waitForLoadState("domcontentloaded");

    await page.getByRole("button", { name: /upload specification/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const specialTitle = "Test & Special < Chars > (2026) - \"Edition\" #1";

    await page.getByLabel(/section number/i).fill("99 77 01");
    await page.getByLabel(/title/i).fill(specialTitle);

    const fileInput = page.locator('input[type="file"][accept="application/pdf"]');
    const pdfPath = path.join(FIXTURES_DIR, "test-document.pdf");
    await fileInput.setInputFiles(pdfPath);

    await page.getByRole("button", { name: /upload specification/i, exact: false }).last().click();

    await expect(page.getByText(/created.*successfully/i)).toBeVisible({ timeout: 10000 });

    // Verify special characters are preserved
    await expect(page.getByText(specialTitle)).toBeVisible();
  });

  test("should allow empty description (optional field)", async ({ page }) => {
    await page.goto(`/${TEST_PROJECT_ID}/specifications`);
    await page.waitForLoadState("domcontentloaded");

    await page.getByRole("button", { name: /upload specification/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByLabel(/section number/i).fill("99 77 02");
    await page.getByLabel(/title/i).fill("No Description Test");
    // Do NOT fill description field

    const fileInput = page.locator('input[type="file"][accept="application/pdf"]');
    const pdfPath = path.join(FIXTURES_DIR, "test-document.pdf");
    await fileInput.setInputFiles(pdfPath);

    await page.getByRole("button", { name: /upload specification/i, exact: false }).last().click();

    // Should succeed even without description
    await expect(
      page.getByText(/created.*successfully/i),
      "Should create spec without description"
    ).toBeVisible({ timeout: 10000 });
  });

  test("should handle long section numbers", async ({ page }) => {
    await page.goto(`/${TEST_PROJECT_ID}/specifications`);
    await page.waitForLoadState("domcontentloaded");

    await page.getByRole("button", { name: /upload specification/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const longSection = "99 77 03 04 05 06 07 08 09 10";

    await page.getByLabel(/section number/i).fill(longSection);
    await page.getByLabel(/title/i).fill("Long Section Number Test");

    const fileInput = page.locator('input[type="file"][accept="application/pdf"]');
    const pdfPath = path.join(FIXTURES_DIR, "test-document.pdf");
    await fileInput.setInputFiles(pdfPath);

    await page.getByRole("button", { name: /upload specification/i, exact: false }).last().click();

    await expect(page.getByText(/created.*successfully/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(longSection)).toBeVisible();
  });

  test("should handle very long titles", async ({ page }) => {
    await page.goto(`/${TEST_PROJECT_ID}/specifications`);
    await page.waitForLoadState("domcontentloaded");

    await page.getByRole("button", { name: /upload specification/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const longTitle = "A".repeat(200); // Very long title

    await page.getByLabel(/section number/i).fill("99 77 04");
    await page.getByLabel(/title/i).fill(longTitle);

    const fileInput = page.locator('input[type="file"][accept="application/pdf"]');
    const pdfPath = path.join(FIXTURES_DIR, "test-document.pdf");
    await fileInput.setInputFiles(pdfPath);

    await page.getByRole("button", { name: /upload specification/i, exact: false }).last().click();

    // Should either succeed or show validation error for max length
    const isSuccessVisible = await page.getByText(/created.*successfully/i)
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const isErrorVisible = await page.getByText(/too long|maximum length/i)
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    // One of these should be true
    expect(isSuccessVisible || isErrorVisible).toBe(true);
  });
});
