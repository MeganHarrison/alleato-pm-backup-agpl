/** @jest-environment jsdom */
import React, { createRef } from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react";

import {
  PdfjsExpressMarkupOverlay,
  type PdfjsExpressMarkupOverlayHandle,
} from "../PdfjsExpressMarkupOverlay";

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

describe("PdfjsExpressMarkupOverlay undo", () => {
  beforeEach(() => {
    Object.defineProperty(window, "PointerEvent", {
      configurable: true,
      writable: true,
      value: MouseEvent,
    });
    apiFetchMock.mockReset();
    apiFetchMock
      .mockResolvedValueOnce({ annotations: [] })
      .mockResolvedValueOnce({
        annotation: {
          id: "saved-annotation",
          annotation_type: "rectangle",
          page: 1,
          data: {
            start: { x: 10, y: 10 },
            end: { x: 30, y: 30 },
            color: "#ef4444",
            strokeWidth: 2,
            page_percent: true,
          },
        },
      })
      .mockResolvedValueOnce({ success: true });
  });

  it("enables undo after save and removes the persisted annotation", async () => {
    const ref = createRef<PdfjsExpressMarkupOverlayHandle>();
    const onUndoAvailabilityChange = jest.fn();
    const { getByLabelText } = render(
      <PdfjsExpressMarkupOverlay
        ref={ref}
        projectId="67"
        drawingId="drawing-123"
        page={1}
        tool="rectangle"
        color="#ef4444"
        pageViewport={{ left: 0, top: 0, width: 100, height: 100 }}
        onUndoAvailabilityChange={onUndoAvailabilityChange}
      />,
    );

    const overlay = getByLabelText("Drawing markup overlay") as SVGSVGElement;
    overlay.getBoundingClientRect = () =>
      ({
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

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));

    fireEvent.pointerDown(overlay, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(overlay, { clientX: 30, clientY: 30, pointerId: 1 });
    fireEvent.pointerUp(overlay, { clientX: 30, clientY: 30, pointerId: 1 });

    await waitFor(() => {
      expect(onUndoAvailabilityChange).toHaveBeenLastCalledWith(true);
    });

    act(() => ref.current?.undo());

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/projects/67/drawings/drawing-123/annotations/saved-annotation",
        { method: "DELETE" },
      );
      expect(onUndoAvailabilityChange).toHaveBeenLastCalledWith(false);
    });
  });
});
