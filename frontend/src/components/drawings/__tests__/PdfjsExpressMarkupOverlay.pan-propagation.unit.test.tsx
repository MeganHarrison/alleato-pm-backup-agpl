/** @jest-environment jsdom */
// The surface-level grab-to-pan handler (drag-pan.ts) relies on a propagation
// contract with the markup overlay: pointerdowns the overlay claims (selecting,
// transforming, drawing) must NOT reach the surface, while free-space select
// clicks and non-primary buttons MUST bubble so the viewer can pan.
import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { PdfjsExpressMarkupOverlay } from "../PdfjsExpressMarkupOverlay";

const apiFetchMock = jest.fn();

jest.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

function storedRectangle() {
  return {
    id: "rectangle-1",
    annotation_type: "rectangle",
    page: 1,
    data: {
      start: { x: 10, y: 10 },
      end: { x: 30, y: 30 },
      color: "#ef4444",
      strokeWidth: 2,
      page_percent: true,
    },
  };
}

function renderOverlay(tool: "select" | "pen" | "eraser") {
  const surfacePointerDown = jest.fn();
  const result = render(
    <div onPointerDown={surfacePointerDown}>
      <PdfjsExpressMarkupOverlay
        projectId="67"
        drawingId="drawing-123"
        page={1}
        tool={tool}
        color="#ef4444"
        pageViewport={{ left: 0, top: 0, width: 100, height: 100 }}
      />
    </div>,
  );
  const overlay = result.getByLabelText("Drawing markup overlay") as SVGSVGElement;
  overlay.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 100,
    bottom: 100,
    width: 100,
    height: 100,
    toJSON: () => ({}),
  }) as DOMRect;
  overlay.setPointerCapture = jest.fn();
  overlay.hasPointerCapture = jest.fn(() => true);
  overlay.releasePointerCapture = jest.fn();
  return { ...result, overlay, surfacePointerDown };
}

describe("PdfjsExpressMarkupOverlay pan propagation contract", () => {
  beforeEach(() => {
    Object.defineProperty(window, "PointerEvent", {
      configurable: true,
      writable: true,
      value: MouseEvent,
    });
    apiFetchMock.mockReset();
  });

  it("lets free-space select pointerdowns bubble so the surface can pan", async () => {
    apiFetchMock.mockResolvedValueOnce({ annotations: [storedRectangle()] });
    const { getByLabelText, overlay, surfacePointerDown } = renderOverlay("select");
    await waitFor(() => expect(getByLabelText("rectangle annotation")).toBeInTheDocument());

    fireEvent.pointerDown(overlay, { clientX: 80, clientY: 80, pointerId: 1, button: 0 });

    expect(surfacePointerDown).toHaveBeenCalledTimes(1);
  });

  it("stops propagation when select claims an annotation", async () => {
    apiFetchMock.mockResolvedValueOnce({ annotations: [storedRectangle()] });
    const { getByLabelText, overlay, surfacePointerDown } = renderOverlay("select");
    await waitFor(() => expect(getByLabelText("rectangle annotation")).toBeInTheDocument());

    fireEvent.pointerDown(overlay, { clientX: 20, clientY: 20, pointerId: 1, button: 0 });

    expect(surfacePointerDown).not.toHaveBeenCalled();
  });

  it.each(["pen", "eraser"] as const)(
    "stops propagation while the %s tool owns the primary-button gesture",
    async (tool) => {
      apiFetchMock.mockResolvedValueOnce({ annotations: [] });
      const { overlay, surfacePointerDown } = renderOverlay(tool);
      await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());

      fireEvent.pointerDown(overlay, { clientX: 50, clientY: 50, pointerId: 1, button: 0 });

      expect(surfacePointerDown).not.toHaveBeenCalled();
    },
  );

  it("lets middle-button pointerdowns bubble with a drawing tool active", async () => {
    apiFetchMock.mockResolvedValueOnce({ annotations: [] });
    const { overlay, surfacePointerDown } = renderOverlay("pen");
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());

    fireEvent.pointerDown(overlay, { clientX: 50, clientY: 50, pointerId: 1, button: 1 });

    expect(surfacePointerDown).toHaveBeenCalledTimes(1);
    // The middle button must not have started a pen stroke.
    expect(overlay.setPointerCapture).not.toHaveBeenCalled();
  });
});
