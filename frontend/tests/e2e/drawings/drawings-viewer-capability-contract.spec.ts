import { expect, test, type Page, type Response } from "@playwright/test";

const projectId = process.env.E2E_DRAWINGS_PROJECT_ID ?? "67";
const drawingId = process.env.E2E_DRAWING_ID ?? "0e486628-f210-4be4-bc1b-3eec20f0b44d";
const viewerPath = `/${projectId}/drawings/viewer/${drawingId}`;
const annotationPath = `/api/projects/${projectId}/drawings/${drawingId}/annotations`;
const pinPath = `/api/projects/${projectId}/drawings/${drawingId}/pins`;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001";
const PDF_RENDER_TIMEOUT_MS = 60_000;

const colorableTools = ["Pen", "Highlight", "Rectangle", "Cloud", "Arrow", "Text"];
const nonColorableTools = ["Select", "Link", "Eraser"];
const panels = [
  ["Links", "Links"],
  ["Filter annotations", "Filter"],
  ["Drawing info", "Info"],
  ["Search drawings", "Search"],
  ["Comments", "Comments"],
  ["History", "History"],
] as const;

type RuntimeFailures = {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  failedResponses: string[];
};

function monitorRuntime(page: Page): RuntimeFailures {
  const failures: RuntimeFailures = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    failedResponses: [],
  };

  page.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location();
      failures.consoleErrors.push(
        `${message.text()}${location.url ? ` (${location.url}:${location.lineNumber})` : ""}`,
      );
    }
  });
  page.on("pageerror", (error) => failures.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const url = request.url();
    const errorText = request.failure()?.errorText ?? "failed";
    // Next.js cancels superseded RSC prefetches, and React Query cancels stale
    // viewer requests during intentional state changes. Those surface as
    // ERR_ABORTED even when the replacement request succeeds.
    if (
      errorText !== "net::ERR_ABORTED" &&
      url.startsWith(page.url().split(viewerPath)[0] || "http://localhost")
    ) {
      failures.failedRequests.push(`${request.method()} ${url}: ${errorText}`);
    }
  });
  page.on("response", (response) => {
    if (isFirstPartyFailure(page, response)) {
      failures.failedResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });

  return failures;
}

function isFirstPartyFailure(page: Page, response: Response) {
  try {
    return new URL(response.url()).origin === new URL(page.url()).origin && response.status() >= 400;
  } catch {
    return false;
  }
}

function expectNoRuntimeFailures(failures: RuntimeFailures) {
  expect(failures, `Viewer runtime failures:\n${JSON.stringify(failures, null, 2)}`).toEqual({
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    failedResponses: [],
  });
}

async function openRenderedViewer(page: Page) {
  await page.goto(viewerPath, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(new RegExp(`${viewerPath.replaceAll("/", "\\/")}$`));
  await expect(page).not.toHaveURL(/\/auth\/login/);
  await expect(page.getByText("A050 - Architectural Site Plan", { exact: true })).toBeVisible({
    timeout: PDF_RENDER_TIMEOUT_MS,
  });
  await expect(page.getByText(/Revision JP8572.*Page 1 of 1/)).toBeVisible({
    timeout: PDF_RENDER_TIMEOUT_MS,
  });
  await expect(page.getByText("Loading drawing...", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Failed to load drawing viewer", { exact: true })).toHaveCount(0);

  const overlay = page.getByLabel("Drawing markup overlay", { exact: true });
  await expect(overlay).toBeVisible({ timeout: PDF_RENDER_TIMEOUT_MS });
  await expect
    .poll(async () => {
      const bounds = await overlay.boundingBox();
      return Boolean(bounds && bounds.width > 100 && bounds.height > 100);
    }, { timeout: PDF_RENDER_TIMEOUT_MS, message: "drawing overlay never reached usable geometry" })
    .toBe(true);
  await expect(page.locator("iframe").first()).toBeVisible();
  return overlay;
}

async function openViewerHeader(page: Page) {
  await page.goto(viewerPath, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(new RegExp(`${viewerPath.replaceAll("/", "\\/")}$`));
  await expect(page).not.toHaveURL(/\/auth\/login/);
  await expect(page.getByText("A050 - Architectural Site Plan", { exact: true })).toBeVisible({
    timeout: PDF_RENDER_TIMEOUT_MS,
  });
}

test.describe("drawings viewer capability contract", () => {
  test("header navigation reaches adjacent drawings and the drawings register", async ({ browser }) => {
    const verifyNavigation = async (buttonName: string, destination: RegExp) => {
      const navigationContext = await browser.newContext({
        baseURL,
        storageState: "./tests/.auth/user.json",
      });
      const navigationPage = await navigationContext.newPage();
      const failures = monitorRuntime(navigationPage);
      try {
        await openViewerHeader(navigationPage);
        await navigationPage.getByRole("button", { name: buttonName, exact: true }).click();
        await expect(navigationPage).toHaveURL(destination, { timeout: PDF_RENDER_TIMEOUT_MS });
        expectNoRuntimeFailures(failures);
      } finally {
        await navigationContext.close();
      }
    };

    const adjacentDrawing = new RegExp(
      `/${projectId}/drawings/viewer/(?!${drawingId})[^/?]+$`,
    );
    const drawingsRegister = new RegExp(`/${projectId}/drawings$`);

    await verifyNavigation("Previous drawing", adjacentDrawing);
    await verifyNavigation("Next drawing", adjacentDrawing);
    await verifyNavigation("Drawings", drawingsRegister);
    await verifyNavigation("Close viewer", drawingsRegister);
  });

  const verifyRetainedControls = async ({ page }: { page: Page }) => {
    const failures = monitorRuntime(page);
    const annotationPosts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().includes(annotationPath)) {
        annotationPosts.push(request.url());
      }
    });

    const overlay = await openRenderedViewer(page);
    await expect(page.getByLabel("Drawing annotation tools", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Previous drawing", exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Next drawing", exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Download drawing", exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Close viewer", exact: true })).toBeEnabled();

    for (const tool of colorableTools) {
      const button = page.getByRole("button", { name: `${tool} markup tool`, exact: true });
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect(overlay).toHaveAttribute("data-markup-tool", tool === "Highlight" ? "highlighter" : tool.toLowerCase());
      await expect(page.getByLabel("Markup color", { exact: true }).getByRole("button")).toHaveCount(7);
    }

    for (const tool of nonColorableTools) {
      const button = page.getByRole("button", { name: `${tool} markup tool`, exact: true });
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect(overlay).toHaveAttribute("data-markup-tool", tool.toLowerCase());
      await expect(page.getByLabel("Markup color", { exact: true })).toHaveCount(0);
    }

    await page.getByRole("button", { name: "Select markup tool", exact: true }).click();
    const bounds = await overlay.boundingBox();
    if (!bounds) throw new Error("Rendered drawing overlay lost its geometry in Select mode.");
    await page.mouse.click(bounds.x + bounds.width * 0.7, bounds.y + bounds.height * 0.7);
    await page.waitForTimeout(500);
    expect(annotationPosts, "Select mode must never create drawing annotations.").toEqual([]);

    for (const [buttonName, panelTitle] of panels) {
      await page.getByRole("button", { name: buttonName, exact: true }).click();
      await expect(page.getByText(panelTitle, { exact: true }).last()).toBeVisible();
      await page.getByRole("button", { name: "Close side panel", exact: true }).click();
      await expect(page.getByRole("button", { name: "Close side panel", exact: true })).toHaveCount(0);
    }

    await page.getByRole("button", { name: "Link markup tool", exact: true }).click();
    await page.mouse.click(bounds.x + bounds.width * 0.6, bounds.y + bounds.height * 0.6);
    const linkModal = page.getByTestId("drawing-link-modal");
    await expect(linkModal).toBeVisible();
    for (const type of ["rfi", "document", "photo", "submittal", "punch_item", "drawing", "coordination_issue", "task"]) {
      await expect(linkModal.getByTestId(`drawing-link-type-${type}`)).toBeVisible();
    }
    await linkModal.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(linkModal).toHaveCount(0);

    expect(annotationPosts, "The read-only capability contract must leave no annotation rows.").toEqual([]);

    const downloadResponse = page.waitForResponse(
      (response) => response.url().includes(`/api/projects/${projectId}/drawings/${drawingId}/download`) && response.ok(),
    );
    await page.getByRole("button", { name: "Download drawing", exact: true }).click();
    const response = await downloadResponse;
    const download = (await response.json()) as { downloadUrl?: string; fileName?: string };
    expect(download.downloadUrl).toMatch(/^https?:\/\//);
    expect(download.fileName).toBe("A050 - Architectural Site Plan.pdf");

    expectNoRuntimeFailures(failures);
  };

  test("zoom, rotation, and responsive actions preserve a usable drawing", async ({ page }) => {
    const failures = monitorRuntime(page);
    const overlay = await openRenderedViewer(page);
    const surface = page.locator('[data-drawing-markup-surface="true"]');

    const initial = await surface.screenshot();
    const surfaceBounds = await surface.boundingBox();
    expect(surfaceBounds, "Drawing surface must have geometry before wheel zoom.").not.toBeNull();
    await page.mouse.move(
      (surfaceBounds?.x ?? 0) + (surfaceBounds?.width ?? 0) / 2,
      (surfaceBounds?.y ?? 0) + (surfaceBounds?.height ?? 0) / 2,
    );
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(750);
    const wheelZoomed = await surface.screenshot();
    expect(wheelZoomed.equals(initial), "Wheel input must visibly zoom the rendered drawing.").toBe(false);

    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await page.waitForTimeout(750);
    const zoomed = await surface.screenshot();
    expect(zoomed.equals(initial), "Zoom in must visibly change the rendered drawing.").toBe(false);

    await page.getByRole("button", { name: "Zoom out", exact: true }).click();
    await page.waitForTimeout(750);
    await expect(overlay).toBeVisible();

    const beforeRotation = await surface.screenshot();
    await page.getByRole("button", { name: "Rotate right", exact: true }).click();
    await page.waitForTimeout(750);
    const rotated = await surface.screenshot();
    expect(rotated.equals(beforeRotation), "Rotate right must visibly change the rendered drawing.").toBe(false);

    await page.getByRole("button", { name: "Rotate left", exact: true }).click();
    await page.waitForTimeout(750);
    await expect
      .poll(async () => {
        const current = await overlay.boundingBox();
        return Boolean(current && current.width > 100 && current.height > 100);
      }, { message: "overlay became unusable after zoom/rotate" })
      .toBe(true);
    await verifyResponsiveActions(page);
    expectNoRuntimeFailures(failures);
  });

  test("drawing comment mode mounts the scoped sidebar and composer", async ({ page }) => {
    const failures = monitorRuntime(page);
    await openRenderedViewer(page);

    await page.getByRole("button", { name: "Comment on drawing", exact: true }).click();

    const sidebar = page.locator('velt-comments-sidebar');
    await expect(sidebar).toBeVisible();
    await expect(page.locator('[data-comment-document-id]')).toHaveAttribute(
      'data-comment-document-id',
      `/67/drawings/viewer/${drawingId}`,
    );
    await expect(page.locator('velt-comments-sidebar textarea')).toBeVisible();
    expectNoRuntimeFailures(failures);
  });

  test("a rendered pin opens its linked-record preview", async ({ page }) => {
    const failures = monitorRuntime(page);
    await page.route(`**${pinPath}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          pins: [
            {
              id: "e2e-preview-pin",
              drawing_id: drawingId,
              project_id: Number(projectId),
              x_pct: 15,
              y_pct: 20,
              page: 1,
              pin_type: "document",
              entity_id: null,
              entity_label: "E2E preview pin",
              entity_description: "Deterministic linked-record preview evidence.",
              entity_number: "E2E-1",
              entity_status: "open",
              color: "#2563eb",
              created_by: null,
              created_at: "2026-07-16T00:00:00.000Z",
            },
          ],
        }),
      });
    });

    try {
      await openRenderedViewer(page);
      await page.getByRole("button", { name: "Open linked E2E-1", exact: true }).click();
      const preview = page.getByTestId("drawing-linked-record-preview-dialog");
      await expect(preview).toBeVisible();
      await expect(preview.getByText("E2E preview pin", { exact: true })).toBeVisible();
      await expect(preview.getByText("Deterministic linked-record preview evidence.", { exact: true })).toBeVisible();
      await preview.locator('[data-slot="dialog-footer"]').getByRole("button", { name: "Close", exact: true }).click();
      await expect(preview).toHaveCount(0);
      expectNoRuntimeFailures(failures);
    } finally {
      await page.unroute(`**${pinPath}`);
    }
  });

  async function verifyResponsiveActions(page: Page) {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 768, height: 1024 },
    ]) {
      await page.setViewportSize(viewport);
      for (const name of ["Previous drawing", "Next drawing", "Download drawing", "Close viewer"]) {
        const button = page.getByRole("button", { name, exact: true });
        await expect(button).toBeVisible();
        const bounds = await button.boundingBox();
        expect(bounds, `${name} must have viewport geometry at ${viewport.width}px`).not.toBeNull();
        expect((bounds?.x ?? viewport.width) + (bounds?.width ?? 0)).toBeLessThanOrEqual(viewport.width);
      }
    }

    await page.setViewportSize({ width: 375, height: 812 });
    for (const name of ["Drawings", "Previous drawing", "Next drawing", "More drawing actions"]) {
      const button = page.getByRole("button", { name, exact: true });
      await expect(button).toBeVisible();
      const bounds = await button.boundingBox();
      expect(bounds, `${name} must have mobile viewport geometry`).not.toBeNull();
      expect((bounds?.x ?? 375) + (bounds?.width ?? 0)).toBeLessThanOrEqual(375);
      expect(bounds?.width ?? 0, `${name} must be touch friendly`).toBeGreaterThanOrEqual(44);
      expect(bounds?.height ?? 0, `${name} must be touch friendly`).toBeGreaterThanOrEqual(44);
    }
    await expect(page.getByRole("button", { name: "Download drawing", exact: true })).toBeHidden();
    await expect(page.getByRole("button", { name: "Close viewer", exact: true })).toBeHidden();

    await page.getByRole("button", { name: "More drawing actions", exact: true }).click();
    for (const name of [
      "Links",
      "Filter annotations",
      "Drawing info",
      "Search drawings",
      "Comments",
      "History",
      "Download drawing",
      "Close viewer",
    ]) {
      await expect(page.getByRole("menuitem", { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) })).toBeVisible();
    }
  }

  test(
    "retained controls produce observable state and navigation without test junk",
    verifyRetainedControls,
  );

});
