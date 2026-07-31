/** @jest-environment jsdom */

import {
  buildDrawingTableColumns,
  getDrawingPublishState,
  matchesDrawingPublishState,
  renderDrawingCard,
} from "@/features/drawings/drawings-table-config";
import { renderToStaticMarkup } from "react-dom/server";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DrawingLogTableRow } from "@/types/drawings.types";

describe("drawing publish state helpers", () => {
  it("derives Draft, Published, and Obsolete from revision visibility fields", () => {
    expect(
      getDrawingPublishState({ isPublished: false, isObsolete: false }),
    ).toBe("draft");
    expect(
      getDrawingPublishState({ isPublished: true, isObsolete: false }),
    ).toBe("published");
    expect(
      getDrawingPublishState({ isPublished: true, isObsolete: true }),
    ).toBe("obsolete");
  });

  it("matches the same publish state used by the Drawings toolbar filter", () => {
    const draftDrawing = { isPublished: false, isObsolete: false };

    expect(matchesDrawingPublishState(draftDrawing, undefined)).toBe(true);
    expect(matchesDrawingPublishState(draftDrawing, "draft")).toBe(true);
    expect(matchesDrawingPublishState(draftDrawing, "published")).toBe(false);
  });

  it("allows inline editing of the title column when inline handlers are provided", async () => {
    const onUpdate = jest.fn().mockResolvedValue(undefined);
    const titleColumn = buildDrawingTableColumns({
      disciplines: [],
      onUpdate,
    })[1];
    const drawing = {
      id: "drawing-1",
      title: "Floor Plan",
    } as unknown as DrawingLogTableRow;

    expect(titleColumn.editable).toBe(true);
    expect(titleColumn.editType).toBe("text");
    expect(titleColumn.editValue?.(drawing)).toBe("Floor Plan");

    await titleColumn.onEdit?.(drawing, "Updated Title");

    expect(onUpdate).toHaveBeenCalledWith("drawing-1", {
      title: "Updated Title",
    });
  });

  it("keeps drawing identity and actions visible without hover", () => {
    const drawing = {
      id: "drawing-1",
      projectId: "67",
      drawingNumber: "A201",
      title: "Exterior Elevations",
      isPublished: true,
      isObsolete: false,
    } as unknown as DrawingLogTableRow;

    const markup = renderToStaticMarkup(
      renderDrawingCard(drawing, jest.fn(), jest.fn()),
    );

    expect(markup).toContain("A201");
    expect(markup).toContain("Exterior Elevations");
    expect(markup).toContain("Open drawing actions");
    expect(markup).toContain("opacity-100");
    expect(markup).toContain("sm:opacity-0");
  });

  it("exposes publish lifecycle actions in the gallery card menu", async () => {
    const drawing = {
      id: "drawing-1",
      projectId: "67",
      drawingNumber: "A201",
      title: "Exterior Elevations",
      isPublished: false,
      isObsolete: false,
    } as unknown as DrawingLogTableRow;

    render(
      renderDrawingCard(drawing, jest.fn(), jest.fn(), undefined, undefined, undefined, {
        onPublish: jest.fn(),
        onObsolete: jest.fn(),
      }),
    );

    await userEvent.setup().click(
      screen.getByRole("button", { name: "Open drawing actions" }),
    );

    expect(screen.getByText("Publish")).toBeInTheDocument();
    expect(screen.getByText("Mark Obsolete")).toBeInTheDocument();
  });
});
