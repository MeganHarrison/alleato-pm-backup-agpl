import { expect, test, type Page, type Route } from "@playwright/test";

const projectId = process.env.E2E_DRAWINGS_PROJECT_ID ?? process.env.E2E_PROJECT_ID;
const drawingId = process.env.E2E_DRAWING_ID;
const createdAnnotationIds = new Set<string>();
const PDF_RENDER_TIMEOUT_MS = 120_000;

function annotationPath() {
  if (!projectId || !drawingId) {
    throw new Error("Drawing annotation E2E requires E2E_DRAWINGS_PROJECT_ID and E2E_DRAWING_ID.");
  }

  return `/api/projects/${projectId}/drawings/${drawingId}/annotations`;
}

async function waitForRenderedOverlay(page: Page) {
  const overlay = page.getByLabel("Drawing markup overlay", { exact: true });
  await expect(overlay).toBeVisible({ timeout: PDF_RENDER_TIMEOUT_MS });

  // Next.js can finish navigation before PDF.js Express finishes painting its
  // first page. Waiting for usable geometry avoids a false empty-overlay pass.
  await expect
    .poll(async () => {
      const bounds = await overlay.boundingBox();
      return bounds && bounds.width > 100 && bounds.height > 100;
    }, { timeout: PDF_RENDER_TIMEOUT_MS })
    .toBe(true);

  return overlay;
}

async function waitForAnnotationHydration(page: Page, overlay: ReturnType<Page["getByLabel"]>, path: string) {
  const response = await page.request.get(path);
  if (!response.ok()) throw new Error(`Annotation readiness GET failed with ${response.status()}.`);
  const payload = (await response.json()) as { annotations?: Array<{ id?: string }> };
  const annotationIds = (payload.annotations ?? []).flatMap((annotation) => annotation.id ? [annotation.id] : []);
  await expect(overlay).toHaveAttribute("data-annotation-count", String(annotationIds.length));
  await expect(overlay.locator("[data-drawing-annotation-id]")).toHaveCount(annotationIds.length);
}

test.describe("PDF.js Express drawing annotations", () => {
  test.afterEach(async ({ request }) => {
    await Promise.all(
      [...createdAnnotationIds].map(async (annotationId) => {
        await request.delete(`${annotationPath()}/${annotationId}`);
      }),
    );
    createdAnnotationIds.clear();
  });

  test("persists, restores, filters, and erases canonical PDF-page markup", async ({ page }) => {
    test.skip(
      !projectId || !drawingId,
      "Set E2E_DRAWINGS_PROJECT_ID and E2E_DRAWING_ID to run against a dedicated drawing fixture.",
    );

    const path = annotationPath();
    await page.goto(`/${projectId}/drawings/viewer/${drawingId}`, { waitUntil: "domcontentloaded" });

    const overlay = await waitForRenderedOverlay(page);
    const before = await overlay.locator("rect").count();
    const createResponse = page.waitForResponse(
      (response) => response.url().includes(path) && response.request().method() === "POST" && response.status() === 201,
    );

    await page.getByRole("button", { name: "Rectangle markup tool", exact: true }).click();
    const bounds = await overlay.boundingBox();
    if (!bounds) throw new Error("PDF markup overlay has no bounding box after the viewer rendered.");
    const initialRectangleCount = await overlay.getByLabel("rectangle annotation", { exact: true }).count();
    await page.mouse.move(bounds.x + bounds.width * 0.3, bounds.y + bounds.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * 0.4, bounds.y + bounds.height * 0.4);
    await page.mouse.up();

    const created = await createResponse;
    const payload = (await created.json()) as {
      annotation?: {
        id?: string;
        annotation_type?: string;
        page?: number;
        data?: unknown;
      };
    };
    if (!payload.annotation?.id) throw new Error("Annotation creation succeeded without a returned annotation id.");
    createdAnnotationIds.add(payload.annotation.id);
    await expect(overlay.locator("rect")).toHaveCount(before + 1);

    await page.reload({ waitUntil: "domcontentloaded" });
    const restoredOverlay = await waitForRenderedOverlay(page);
    await expect(restoredOverlay.locator("rect")).toHaveCount(before + 1);

    await page.getByRole("button", { name: "Filter annotations", exact: true }).click();
    await page.getByRole("button", { name: "Rectangles Visible", exact: true }).click();
    await expect(restoredOverlay.locator("rect")).toHaveCount(0);
    await page.getByRole("button", { name: "Show all", exact: true }).click();
    await expect(restoredOverlay.locator("rect")).toHaveCount(before + 1);

    const deleteResponse = page.waitForResponse(
      (response) => response.url().includes(`${path}/${payload.annotation?.id}`) && response.request().method() === "DELETE" && response.ok(),
    );
    await page.getByRole("button", { name: "Eraser markup tool", exact: true }).click();
    const restoredBounds = await restoredOverlay.boundingBox();
    if (!restoredBounds) throw new Error("PDF markup overlay lost its bounding box before erase.");
    await page.mouse.click(restoredBounds.x + restoredBounds.width * 0.35, restoredBounds.y + restoredBounds.height * 0.35);
    await deleteResponse;
    createdAnnotationIds.delete(payload.annotation.id);
    await expect(restoredOverlay.locator("rect")).toHaveCount(before);
  });

  test("retries a failed initial rectangle save and persists the recovered annotation", async ({ page }) => {
    test.setTimeout(240_000);
    test.skip(
      !projectId || !drawingId,
      "Set E2E_DRAWINGS_PROJECT_ID and E2E_DRAWING_ID to run against a dedicated drawing fixture.",
    );

    const path = annotationPath();
    let failedPost = false;
    const failFirstAnnotationPost = async (route: Route) => {
      if (route.request().method() === "POST" && !failedPost) {
        failedPost = true;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Annotation service temporarily unavailable" }),
        });
        return;
      }

      await route.continue();
    };

    await page.route(`**${path}`, failFirstAnnotationPost);
    await page.goto(`/${projectId}/drawings/viewer/${drawingId}`, { waitUntil: "domcontentloaded" });

    const overlay = await waitForRenderedOverlay(page);
    await waitForAnnotationHydration(page, overlay, path);
    const initialRectangleCount = await overlay.getByLabel("rectangle annotation", { exact: true }).count();
    const failedResponse = page.waitForResponse(
      (response) => response.url().includes(path) && response.request().method() === "POST" && response.status() === 503,
    );

    await page.getByRole("button", { name: "Rectangle markup tool", exact: true }).click();
    const bounds = await overlay.boundingBox();
    if (!bounds) throw new Error("PDF markup overlay has no bounding box after the viewer rendered.");
    await page.mouse.move(bounds.x + bounds.width * 0.3, bounds.y + bounds.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * 0.4, bounds.y + bounds.height * 0.4);
    await page.mouse.up();

    await failedResponse;
    const failedSaveToast = page.locator("[data-sonner-toast]").filter({ hasText: "Markup could not be saved" });
    await expect(failedSaveToast).toBeVisible();
    const retry = failedSaveToast.getByRole("button", { name: "Retry", exact: true });
    await expect(retry).toBeVisible();
    await expect(overlay.getByLabel("rectangle annotation", { exact: true })).toHaveCount(initialRectangleCount);

    await page.unroute(`**${path}`, failFirstAnnotationPost);
    const recoveredResponse = page.waitForResponse(
      (response) => response.url().includes(path) && response.request().method() === "POST" && response.status() === 201,
    );
    await retry.click();

    const recovered = await recoveredResponse;
    const payload = (await recovered.json()) as { annotation?: { id?: string } };
    const annotationId = payload.annotation?.id;
    if (!annotationId) throw new Error("Retry creation succeeded without a returned annotation id.");
    createdAnnotationIds.add(annotationId);
    await expect(overlay.locator(`[data-drawing-annotation-id="${annotationId}"]`)).toBeVisible();

    await page.reload({ waitUntil: "domcontentloaded" });
    const restoredOverlay = await waitForRenderedOverlay(page);
    const restoredAnnotation = restoredOverlay.locator(`[data-drawing-annotation-id="${annotationId}"]`);
    await expect(restoredAnnotation).toBeVisible();

    const deleteResponse = page.waitForResponse(
      (response) => response.url().includes(`${path}/${annotationId}`) && response.request().method() === "DELETE" && response.ok(),
    );
    await page.getByRole("button", { name: "Eraser markup tool", exact: true }).click();
    const annotationBounds = await restoredAnnotation.boundingBox();
    if (!annotationBounds) throw new Error("Restored annotation has no bounding box for cleanup.");
    await page.mouse.click(annotationBounds.x + annotationBounds.width / 2, annotationBounds.y + annotationBounds.height / 2);
    await deleteResponse;
    createdAnnotationIds.delete(annotationId);
  });

  test("undo removes the last persisted rectangle", async ({ page }) => {
    test.setTimeout(240_000);
    test.skip(
      !projectId || !drawingId,
      "Set E2E_DRAWINGS_PROJECT_ID and E2E_DRAWING_ID to run against a dedicated drawing fixture.",
    );

    const path = annotationPath();
    await page.goto(`/${projectId}/drawings/viewer/${drawingId}`, { waitUntil: "domcontentloaded" });
    const overlay = await waitForRenderedOverlay(page);
    await waitForAnnotationHydration(page, overlay, path);
    const bounds = await overlay.boundingBox();
    if (!bounds) throw new Error("PDF markup overlay has no bounding box after the viewer rendered.");

    const createResponse = page.waitForResponse(
      (response) => response.url().includes(path) && response.request().method() === "POST" && response.status() === 201,
    );
    await page.getByRole("button", { name: "Rectangle markup tool", exact: true }).click();
    await page.mouse.move(bounds.x + bounds.width * 0.3, bounds.y + bounds.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * 0.4, bounds.y + bounds.height * 0.4);
    await page.mouse.up();

    const created = await createResponse;
    const payload = (await created.json()) as { annotation?: { id?: string } };
    const annotationId = payload.annotation?.id;
    if (!annotationId) throw new Error("Annotation creation succeeded without a returned annotation id.");
    createdAnnotationIds.add(annotationId);
    const annotation = overlay.locator(`[data-drawing-annotation-id="${annotationId}"]`);
    await expect(annotation).toBeVisible();

    const undo = page.getByRole("button", { name: "Undo last annotation", exact: true });
    await expect(undo).toBeEnabled();
    const deleteResponse = page.waitForResponse(
      (response) => response.url().includes(`${path}/${annotationId}`) && response.request().method() === "DELETE" && response.ok(),
    );
    await undo.click();
    await deleteResponse;
    createdAnnotationIds.delete(annotationId);
    await expect(annotation).toHaveCount(0);
  });

  test("edits, restores, and deletes rectangle and cloud objects", async ({ page }) => {
    test.setTimeout(240_000);
    test.skip(
      !projectId || !drawingId,
      "Set E2E_DRAWINGS_PROJECT_ID and E2E_DRAWING_ID to run against a dedicated drawing fixture.",
    );

    const path = annotationPath();
    await page.goto(`/${projectId}/drawings/viewer/${drawingId}`, { waitUntil: "domcontentloaded" });

    const overlay = await waitForRenderedOverlay(page);
    await waitForAnnotationHydration(page, overlay, path);
    const bounds = await overlay.boundingBox();
    if (!bounds) throw new Error("PDF markup overlay has no bounding box after the viewer rendered.");
    const initialRectangleCount = await overlay.getByLabel("rectangle annotation", { exact: true }).count();

    const createResponse = page.waitForResponse(
      (response) => response.url().includes(path) && response.request().method() === "POST" && response.status() === 201,
    );
    await page.getByRole("button", { name: "Rectangle markup tool", exact: true }).click();
    await page.mouse.move(bounds.x + bounds.width * 0.3, bounds.y + bounds.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * 0.4, bounds.y + bounds.height * 0.4);
    await page.mouse.up();

    const created = await createResponse;
    const payload = (await created.json()) as { annotation?: { id?: string } };
    const annotationId = payload.annotation?.id;
    if (!annotationId) throw new Error("Annotation creation succeeded without a returned annotation id.");
    createdAnnotationIds.add(annotationId);

    const persisted = overlay.getByLabel("rectangle annotation", { exact: true }).last();
    await expect(overlay.getByLabel("rectangle annotation", { exact: true })).toHaveCount(initialRectangleCount + 1);
    await expect(persisted).toBeVisible();
    const initialWidth = Number(await persisted.getAttribute("width"));
    const initialHeight = Number(await persisted.getAttribute("height"));

    await page.getByRole("button", { name: "Select markup tool", exact: true }).click();
    await persisted.click();
    await expect(overlay.getByLabel("Selected rectangle annotation", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete selected annotation", exact: true })).toBeVisible();
    const southeastHandle = overlay.locator('[data-resize-handle="se"]');
    await expect(southeastHandle).toBeVisible();

    const resizeResponse = page.waitForResponse(
      (response) => response.url().includes(`${path}/${annotationId}`) && response.request().method() === "PATCH" && response.ok(),
    );
    const handleBounds = await southeastHandle.boundingBox();
    if (!handleBounds) throw new Error("Selected annotation resize handle has no bounding box.");
    await page.mouse.move(handleBounds.x + handleBounds.width / 2, handleBounds.y + handleBounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * 0.5, bounds.y + bounds.height * 0.45);
    await page.mouse.up();
    const resizedResponse = await resizeResponse;
    const resizedPayload = (await resizedResponse.json()) as { annotation?: { id?: string } };
    if (resizedPayload.annotation?.id !== annotationId) {
      throw new Error(
        `Resize changed annotation identity from ${annotationId} to ${resizedPayload.annotation?.id ?? "missing"}.`,
      );
    }

    const resized = overlay.locator(`[data-drawing-annotation-id="${annotationId}"]`);
    const renderedIds = await overlay.locator("[data-drawing-annotation-id]").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-drawing-annotation-id")),
    );
    if (!renderedIds.includes(annotationId)) {
      throw new Error(`Resized annotation ${annotationId} is absent from rendered ids: ${renderedIds.join(", ") || "none"}.`);
    }
    const resizedWidth = Number(await resized.getAttribute("width"));
    const resizedHeight = Number(await resized.getAttribute("height"));
    expect(resizedWidth).toBeGreaterThan(initialWidth);
    expect(resizedHeight).toBeGreaterThan(initialHeight);
    const resizedX = Number(await resized.getAttribute("x"));
    const resizedY = Number(await resized.getAttribute("y"));

    const moveResponse = page.waitForResponse(
      (response) => response.url().includes(`${path}/${annotationId}`) && response.request().method() === "PATCH" && response.ok(),
    );
    const resizedBounds = await resized.boundingBox();
    if (!resizedBounds) throw new Error("Resized annotation has no bounding box.");
    await page.mouse.move(resizedBounds.x + resizedBounds.width / 2, resizedBounds.y + resizedBounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      resizedBounds.x + resizedBounds.width / 2 + bounds.width * 0.05,
      resizedBounds.y + resizedBounds.height / 2 + bounds.height * 0.05,
    );
    await page.mouse.up();
    await moveResponse;

    const movedX = await resized.getAttribute("x");
    const movedY = await resized.getAttribute("y");
    const movedWidth = await resized.getAttribute("width");
    const movedHeight = await resized.getAttribute("height");
    expect(Number(movedX)).toBeGreaterThan(resizedX);
    expect(Number(movedY)).toBeGreaterThan(resizedY);

    await page.reload({ waitUntil: "domcontentloaded" });
    const restoredOverlay = await waitForRenderedOverlay(page);
    const restored = restoredOverlay.locator(`[data-drawing-annotation-id="${annotationId}"]`);
    await expect(restored).toHaveAttribute("width", movedWidth ?? "");
    await expect(restored).toHaveAttribute("height", movedHeight ?? "");
    await expect(restored).toHaveAttribute("x", movedX ?? "");
    await expect(restored).toHaveAttribute("y", movedY ?? "");

    const restoredBounds = await restoredOverlay.boundingBox();
    if (!restoredBounds) throw new Error("PDF markup overlay lost its bounding box after reload.");
    await page.getByRole("button", { name: "Select markup tool", exact: true }).click();
    await restored.click();
    await expect(page.getByRole("button", { name: "Delete selected annotation", exact: true })).toBeVisible();
    await page.screenshot({
      path: "../docs/ops/evidence/2026-07-13-drawing-annotation-object-editing/selected-resized-after-reload.png",
      fullPage: true,
    });

    const deleteResponse = page.waitForResponse(
      (response) => response.url().includes(`${path}/${annotationId}`) && response.request().method() === "DELETE" && response.ok(),
    );
    await page.getByRole("button", { name: "Delete selected annotation", exact: true }).click();
    await deleteResponse;
    createdAnnotationIds.delete(annotationId);
    await expect(restored).toHaveCount(0);

    await page.reload({ waitUntil: "domcontentloaded" });
    const deletedOverlay = await waitForRenderedOverlay(page);
    await expect(deletedOverlay.locator(`[data-drawing-annotation-id="${annotationId}"]`)).toHaveCount(0);
    await page.screenshot({
      path: "../docs/ops/evidence/2026-07-13-drawing-annotation-object-editing/deleted-after-reload.png",
      fullPage: true,
    });
    await waitForAnnotationHydration(page, deletedOverlay, path);
    const cloudOverlay = deletedOverlay;
    const cloudOverlayBounds = await cloudOverlay.boundingBox();
    if (!cloudOverlayBounds) throw new Error("PDF markup overlay has no bounding box before cloud editing.");

    const cloudCreateResponse = page.waitForResponse(
      (response) => response.url().includes(path) && response.request().method() === "POST" && response.status() === 201,
    );
    await page.getByRole("button", { name: "Cloud markup tool", exact: true }).click();
    await page.mouse.move(cloudOverlayBounds.x + cloudOverlayBounds.width * 0.55, cloudOverlayBounds.y + cloudOverlayBounds.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(cloudOverlayBounds.x + cloudOverlayBounds.width * 0.65, cloudOverlayBounds.y + cloudOverlayBounds.height * 0.4);
    await page.mouse.up();

    const cloudCreated = await cloudCreateResponse;
    const cloudPayload = (await cloudCreated.json()) as { annotation?: { id?: string } };
    const cloudAnnotationId = cloudPayload.annotation?.id;
    if (!cloudAnnotationId) throw new Error("Cloud creation succeeded without a returned annotation id.");
    createdAnnotationIds.add(cloudAnnotationId);
    const cloud = cloudOverlay.locator(`[data-drawing-annotation-id="${cloudAnnotationId}"]`);
    await expect(cloud).toBeVisible();
    const initialPath = await cloud.getAttribute("d");
    const cloudBounds = await cloud.boundingBox();
    if (!cloudBounds) throw new Error("Persisted cloud has no bounding box.");

    await page.getByRole("button", { name: "Select markup tool", exact: true }).click();
    // Clouds are stroke-only paths. Dispatch the semantic click to the path so
    // browser hit-testing does not choose an overlapping filled rectangle.
    await cloud.dispatchEvent("click");
    await expect(cloudOverlay.getByLabel("Selected cloud annotation", { exact: true })).toBeVisible();
    const cloudMoveResponse = page.waitForResponse(
      (response) => response.url().includes(`${path}/${cloudAnnotationId}`) && response.request().method() === "PATCH" && response.ok(),
    );
    await page.mouse.move(cloudBounds.x + cloudBounds.width / 2, cloudBounds.y + cloudBounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      cloudBounds.x + cloudBounds.width / 2 + cloudOverlayBounds.width * 0.04,
      cloudBounds.y + cloudBounds.height / 2 + cloudOverlayBounds.height * 0.04,
    );
    await page.mouse.up();
    await cloudMoveResponse;
    const movedPath = await cloud.getAttribute("d");
    expect(movedPath).not.toBe(initialPath);

    await page.reload({ waitUntil: "domcontentloaded" });
    const cloudRestoredOverlay = await waitForRenderedOverlay(page);
    const restoredCloud = cloudRestoredOverlay.locator(`[data-drawing-annotation-id="${cloudAnnotationId}"]`);
    await expect(restoredCloud).toHaveAttribute("d", movedPath ?? "");
    await page.getByRole("button", { name: "Select markup tool", exact: true }).click();
    const restoredCloudBounds = await restoredCloud.boundingBox();
    if (!restoredCloudBounds) throw new Error("Restored cloud has no bounding box.");
    await restoredCloud.dispatchEvent("click");
    const cloudDeleteResponse = page.waitForResponse(
      (response) => response.url().includes(`${path}/${cloudAnnotationId}`) && response.request().method() === "DELETE" && response.ok(),
    );
    await page.getByRole("button", { name: "Delete selected annotation", exact: true }).click();
    await cloudDeleteResponse;
    createdAnnotationIds.delete(cloudAnnotationId);

    await page.reload({ waitUntil: "domcontentloaded" });
    const cloudDeletedOverlay = await waitForRenderedOverlay(page);
    await expect(cloudDeletedOverlay.locator(`[data-drawing-annotation-id="${cloudAnnotationId}"]`)).toHaveCount(0);
  });
});
