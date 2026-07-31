/**
 * E2E smoke test: project documents browser
 *
 * Route: /<projectId>/documents (e.g. /1009/documents)
 * Layout: SmartGroupRail (left) | card/list grid (middle) | PreviewPane (right)
 *
 * Real selectors derived from source:
 * - "Smart groups" text: <p> element in SmartGroupRail (smart-group-rail.tsx line 91)
 * - "All" group button: <Button variant="ghost"> rendered by RailItem with group.label (line 73)
 * - Document cards: <Button type="button" variant="ghost"> rendered by renderDocumentCard()
 *   (documents-table-config.tsx line 486). No aria-label on the card itself — selected by
 *   locating buttons within the card grid container. NOTE: these cards have no data-testid;
 *   adding data-testid="document-card" to renderDocumentCard is a recommended future guardrail.
 * - "Toggle info" button: <Button aria-label="Toggle info"> in PreviewPane toolbar (preview-pane.tsx line 103)
 *   Only present after a doc is selected (not shown on the empty-state pane).
 * - Resize separator: role="separator" aria-label="Resize preview" (project-documents-browser.tsx line 135)
 */

import { test, expect } from "@playwright/test";

test.describe("project documents browser", () => {
  test("rail, card selection, toggle-info, and resize handle work", async ({
    page,
  }) => {
    await page.goto("/1009/documents");
    await page.waitForLoadState("domcontentloaded");

    // ── 1. Smart group rail is present ──────────────────────────────────────
    // "Smart groups" is a <p> element (not a heading) inside the rail nav.
    await expect(page.getByText("Smart groups")).toBeVisible();

    // "All" group button (RailItem renders a <Button> whose visible text is the label).
    await expect(page.getByRole("button", { name: /^All/ })).toBeVisible();

    // ── 2. At least one document card is visible ─────────────────────────────
    // Cards are <Button type="button" variant="ghost"> with a title <span> inside.
    // The card grid is inside the DocumentsTablePage component. We locate the first
    // ghost button that has a visible title span — this is the card's clickable area.
    // We wait up to 15 s because cards load from the API after mount.
    const firstCard = page.locator('[data-testid="document-card"]').first();

    await expect(firstCard).toBeVisible({ timeout: 15_000 });

    // ── 3. Clicking the card wires selection → PreviewPane toolbar appears ───
    // PreviewPane shows an empty-state (no toolbar) when doc is null.
    // After clicking a card, PreviewPane renders a toolbar containing
    // <Button aria-label="Toggle info"> (preview-pane.tsx line 103).
    // Cards are wrapped in a DnD draggable div (aria-roledescription="draggable")
    // which intercepts pointer events. Use force:true to bypass the interception
    // and still trigger the button's onClick handler.
    await firstCard.click({ force: true });

    await expect(page.getByRole("button", { name: "Toggle info" })).toBeVisible(
      { timeout: 10_000 },
    );

    // ── 4. Resize separator exists ──────────────────────────────────────────
    const handle = page.getByRole("separator", { name: "Resize preview" });
    await expect(handle).toBeVisible();

    // ── 5. Drag the handle left by ~100px; rail must still be visible ────────
    const box = await handle.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        box.x + box.width / 2 - 100,
        box.y + box.height / 2,
        { steps: 10 },
      );
      await page.mouse.up();
    }

    // Rail must still be intact after the resize drag.
    await expect(page.getByText("Smart groups")).toBeVisible();
  });

  // Regression guard: cards must NOT overlap (a min-w-0 / grid-column bug once
  // caused content-sized cards to overflow their tracks and stack on top of
  // each other), AND selecting a smart group must actually filter the grid (a
  // forcedFilters bug once made every group show the same unfiltered list).
  test("cards do not overlap and group selection filters the grid", async ({
    page,
  }) => {
    await page.goto("/1009/documents");
    await page.waitForLoadState("domcontentloaded");

    const cards = page.locator('[data-testid="document-card"]');
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });

    // ── No overlap: every pair of visible card rects must be disjoint ────────
    const boxes = await cards.evaluateAll((els) =>
      els.slice(0, 8).map((e) => {
        const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      }),
    );
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const overlapX = Math.max(
          0,
          Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x),
        );
        const overlapY = Math.max(
          0,
          Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y),
        );
        expect(overlapX * overlapY).toBeLessThanOrEqual(25);
      }
    }

    // ── Group filter: clicking Drawings shows only Drawing-category cards ────
    await page.getByRole("button", { name: /^Drawings/ }).click();
    await page.waitForTimeout(1500);
    const categories = await cards.evaluateAll((els) =>
      els
        .slice(0, 6)
        .map(
          (e) =>
            (e.textContent || "").match(
              /Drawing|Contract|Specification|Invoice|Proposal/,
            )?.[0] ?? "?",
        ),
    );
    expect(categories.length).toBeGreaterThan(0);
    for (const c of categories) {
      expect(c).toBe("Drawing");
    }
  });

  test("desktop grid view shows four files per row in the documents panel", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/876/documents");
    await page.waitForLoadState("domcontentloaded");

    const cards = page.locator('[data-testid="document-card"]');
    await expect(cards.nth(3)).toBeVisible({ timeout: 15_000 });

    const firstRowTop = await cards
      .first()
      .evaluate((element) => Math.round(element.getBoundingClientRect().top));
    const firstRowCount = await cards.evaluateAll(
      (elements, rowTop) =>
        elements
          .slice(0, 8)
          .filter(
            (element) =>
              Math.round(element.getBoundingClientRect().top) === rowTop,
          ).length,
      firstRowTop,
    );

    expect(firstRowCount).toBe(4);
  });

  test("split browser uses the full shell width and preview pane is unframed", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/876/documents");
    await page.waitForLoadState("domcontentloaded");

    const shell = page.getByTestId("documents-browser-shell");
    const previewPane = page.getByTestId("document-preview-pane");

    await expect(shell).toBeVisible({ timeout: 15_000 });
    await expect(previewPane).toBeVisible();

    const metrics = await shell.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const styles = window.getComputedStyle(element);
      return {
        width: rect.width,
        bottom: rect.bottom,
        radius: styles.borderTopLeftRadius,
        borderLeftWidth: styles.borderLeftWidth,
        borderTopWidth: styles.borderTopWidth,
      };
    });

    expect(metrics.width).toBeGreaterThanOrEqual(1450);
    expect(metrics.bottom).toBeGreaterThanOrEqual(998);
    expect(metrics.radius).toBe("0px");
    expect(metrics.borderLeftWidth).toBe("0px");
    expect(metrics.borderTopWidth).toBe("0px");

    const previewStyles = await previewPane.evaluate((element) => {
      const styles = window.getComputedStyle(element);
      return {
        radius: styles.borderTopLeftRadius,
        borderLeftWidth: styles.borderLeftWidth,
        borderTopWidth: styles.borderTopWidth,
      };
    });

    expect(previewStyles.radius).toBe("0px");
    expect(previewStyles.borderLeftWidth).toBe("0px");
    expect(previewStyles.borderTopWidth).toBe("0px");
  });

  test("uses the full-screen viewer below the desktop split breakpoint", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 900, height: 1000 });
    await page.goto("/876/documents");
    await page.waitForLoadState("domcontentloaded");

    const shell = page.getByTestId("documents-browser-shell");
    const firstCard = page.locator('[data-testid="document-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });
    await firstCard.click({ force: true });

    const previewPane = page.getByTestId("document-preview-pane");
    await expect(previewPane).toBeVisible();
    await expect(page.getByRole("button", { name: "Back to files" })).toBeVisible();
    await expect(page.getByRole("separator", { name: "Resize preview" })).toBeHidden();

    const previewStyles = await previewPane.evaluate((element) => {
      const styles = window.getComputedStyle(element);
      return {
        position: styles.position,
        width: element.getBoundingClientRect().width,
        viewportWidth: window.innerWidth,
      };
    });

    expect(previewStyles.position).toBe("fixed");
    expect(previewStyles.width).toBeGreaterThanOrEqual(previewStyles.viewportWidth - 1);
    expect(await shell.getAttribute("data-template")).toBe("document-browser-shell");
  });
});
