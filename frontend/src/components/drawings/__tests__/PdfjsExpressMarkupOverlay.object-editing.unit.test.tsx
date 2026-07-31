/** @jest-environment jsdom */
import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { PdfjsExpressMarkupOverlay } from "../PdfjsExpressMarkupOverlay";

const apiFetchMock = jest.fn();
const toastErrorMock = jest.fn();

jest.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

jest.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: jest.fn(),
  },
}));

function storedShape(type: "rectangle" | "cloud", end = { x: 30, y: 30 }) {
  return {
    id: `${type}-1`,
    annotation_type: type,
    page: 1,
    data: {
      start: { x: 10, y: 10 },
      end,
      color: "#ef4444",
      strokeWidth: 2,
      page_percent: true,
    },
  };
}

function renderOverlay(
  tool: "select" | "rectangle" = "select",
  overrides: Partial<React.ComponentProps<typeof PdfjsExpressMarkupOverlay>> = {},
) {
  const result = render(
    <PdfjsExpressMarkupOverlay
      projectId="67"
      drawingId="drawing-123"
      page={1}
      tool={tool}
      color="#ef4444"
      pageViewport={{ left: 0, top: 0, width: 100, height: 100 }}
      {...overrides}
    />,
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
  return { ...result, overlay };
}

describe("PdfjsExpressMarkupOverlay object editing", () => {
  beforeEach(() => {
    Object.defineProperty(window, "PointerEvent", {
      configurable: true,
      writable: true,
      value: MouseEvent,
    });
    apiFetchMock.mockReset();
    toastErrorMock.mockReset();
  });

  it.each(["rectangle", "cloud"] as const)(
    "selects and resizes a %s with persistent percentage geometry",
    async (type) => {
      apiFetchMock
        .mockResolvedValueOnce({ annotations: [storedShape(type)] })
        .mockResolvedValueOnce({ annotation: storedShape(type, { x: 50, y: 45 }) });

      const { getByLabelText, overlay } = renderOverlay();
      await waitFor(() => expect(getByLabelText(`${type} annotation`)).toBeInTheDocument());

      fireEvent.pointerDown(overlay, { clientX: 20, clientY: 20, pointerId: 1 });
      fireEvent.pointerUp(overlay, { clientX: 20, clientY: 20, pointerId: 1 });
      expect(getByLabelText(`Selected ${type} annotation`)).toBeInTheDocument();
      expect(getByLabelText("Delete selected annotation")).toBeInTheDocument();

      fireEvent.pointerDown(overlay, { clientX: 30, clientY: 30, pointerId: 2 });
      expect(overlay.setPointerCapture).toHaveBeenCalled();
      fireEvent.pointerMove(overlay, { clientX: 50, clientY: 45, pointerId: 2 });
      fireEvent.pointerUp(overlay, { clientX: 50, clientY: 45, pointerId: 2 });
      expect(overlay.releasePointerCapture).toHaveBeenCalled();

      await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith(
        `/api/projects/67/drawings/drawing-123/annotations/${type}-1`,
        {
          method: "PATCH",
          body: JSON.stringify({
            data: {
              start: { x: 10, y: 10 },
              end: { x: 50, y: 45 },
              page_percent: true,
              color: "#ef4444",
              strokeWidth: 2,
            },
          }),
        },
      ));
    },
  );

  it("forwards a non-photo pin click to the workspace callback", async () => {
    apiFetchMock.mockResolvedValueOnce({ annotations: [] });
    const onPinClick = jest.fn();
    const pin = {
      id: "pin-1",
      drawing_id: "drawing-123",
      project_id: 67,
      x_pct: 15,
      y_pct: 20,
      page: 1,
      pin_type: "document" as const,
      entity_id: null,
      entity_label: "Linked document",
      entity_description: "Document preview",
      entity_number: "DOC-1",
      entity_status: "open",
      color: "#2563eb",
      created_by: null,
      created_at: "2026-07-17T00:00:00.000Z",
    };

    const { getByRole } = renderOverlay("select", { pins: [pin], onPinClick });
    await waitFor(() => expect(getByRole("button", { name: "Open linked DOC-1" })).toBeInTheDocument());

    const pinButton = getByRole("button", { name: "Open linked DOC-1" });
    fireEvent.pointerDown(pinButton, { clientX: 15, clientY: 20, pointerId: 1 });
    fireEvent.click(pinButton);

    expect(onPinClick).toHaveBeenCalledWith(pin);
  });

  it("reconciles a temporary id without removing existing SVG annotations", async () => {
    apiFetchMock
      .mockResolvedValueOnce({ annotations: [storedShape("cloud")] })
      .mockResolvedValueOnce({ annotation: storedShape("rectangle") });

    const { container, overlay } = renderOverlay("rectangle");
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));

    fireEvent.pointerDown(overlay, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(overlay, { clientX: 30, clientY: 30, pointerId: 1 });
    expect(container.querySelector('[data-drawing-annotation-id^="pending-"]')).toBeInTheDocument();

    fireEvent.pointerUp(overlay, { clientX: 30, clientY: 30, pointerId: 1 });

    await waitFor(() => {
      expect(container.querySelector('[data-drawing-annotation-id^="pending-"]')).not.toBeInTheDocument();
      expect(container.querySelector('[data-drawing-annotation-id="rectangle-1"]')).toBeInTheDocument();
      expect(container.querySelector('[data-drawing-annotation-id="cloud-1"]')).toBeInTheDocument();
    });
  });

  it("offers a retry when saved markup hydration fails", async () => {
    apiFetchMock
      .mockRejectedValueOnce(new Error("Drawing annotations are unavailable"))
      .mockResolvedValueOnce({ annotations: [storedShape("rectangle")] });

    const { getByLabelText } = renderOverlay();

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Saved markup could not be loaded",
        expect.objectContaining({ action: expect.objectContaining({ label: "Retry" }) }),
      );
    });

    const options = toastErrorMock.mock.calls.at(-1)?.[1] as {
      action: { onClick: () => void };
    };
    await act(async () => {
      options.action.onClick();
    });

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(2);
      expect(getByLabelText("rectangle annotation")).toBeInTheDocument();
    });
  });

  it("offers a retry when a new annotation cannot be saved", async () => {
    apiFetchMock
      .mockResolvedValueOnce({ annotations: [] })
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce({ annotation: storedShape("rectangle") });

    const { container, overlay } = renderOverlay("rectangle");
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));

    fireEvent.pointerDown(overlay, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(overlay, { clientX: 30, clientY: 30, pointerId: 1 });
    fireEvent.pointerUp(overlay, { clientX: 30, clientY: 30, pointerId: 1 });

    await waitFor(() => {
      expect(container.querySelector('[data-drawing-annotation-id^="pending-"]')).not.toBeInTheDocument();
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Markup could not be saved",
        expect.objectContaining({ action: expect.objectContaining({ label: "Retry" }) }),
      );
    });

    const options = toastErrorMock.mock.calls.at(-1)?.[1] as {
      action: { onClick: () => void };
    };
    await act(async () => {
      options.action.onClick();
    });

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(3);
      expect(container.querySelector('[data-drawing-annotation-id="rectangle-1"]')).toBeInTheDocument();
    });
  });

  it("keeps an optimistic selection active when persistence replaces its temporary id", async () => {
    let resolveSave: ((value: { annotation: ReturnType<typeof storedShape> }) => void) | undefined;
    const save = new Promise<{ annotation: ReturnType<typeof storedShape> }>((resolve) => {
      resolveSave = resolve;
    });
    apiFetchMock
      .mockResolvedValueOnce({ annotations: [] })
      .mockReturnValueOnce(save);

    const result = renderOverlay("rectangle");
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));

    fireEvent.pointerDown(result.overlay, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(result.overlay, { clientX: 30, clientY: 30, pointerId: 1 });
    fireEvent.pointerUp(result.overlay, { clientX: 30, clientY: 30, pointerId: 1 });

    result.rerender(
      <PdfjsExpressMarkupOverlay
        projectId="67"
        drawingId="drawing-123"
        page={1}
        tool="select"
        color="#ef4444"
        pageViewport={{ left: 0, top: 0, width: 100, height: 100 }}
      />,
    );
    fireEvent.pointerDown(result.overlay, { clientX: 20, clientY: 20, pointerId: 2 });
    fireEvent.pointerUp(result.overlay, { clientX: 20, clientY: 20, pointerId: 2 });
    expect(result.getByLabelText("Selected rectangle annotation")).toBeInTheDocument();

    resolveSave?.({ annotation: storedShape("rectangle") });

    await waitFor(() => {
      expect(result.getByLabelText("Selected rectangle annotation")).toBeInTheDocument();
      expect(result.getByLabelText("rectangle annotation")).toHaveAttribute(
        "data-drawing-annotation-id",
        "rectangle-1",
      );
      expect(result.getByLabelText("Delete selected annotation")).toBeInTheDocument();
    });
  });

  it("does not let stale initial hydration remove an annotation created while loading", async () => {
    let resolveLoad: ((value: { annotations: never[] }) => void) | undefined;
    const load = new Promise<{ annotations: never[] }>((resolve) => {
      resolveLoad = resolve;
    });
    apiFetchMock
      .mockReturnValueOnce(load)
      .mockResolvedValueOnce({ annotation: storedShape("rectangle") });

    const result = renderOverlay("rectangle");
    fireEvent.pointerDown(result.overlay, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(result.overlay, { clientX: 30, clientY: 30, pointerId: 1 });
    fireEvent.pointerUp(result.overlay, { clientX: 30, clientY: 30, pointerId: 1 });

    await waitFor(() => {
      expect(result.getByLabelText("rectangle annotation")).toHaveAttribute(
        "data-drawing-annotation-id",
        "rectangle-1",
      );
    });

    resolveLoad?.({ annotations: [] });

    await waitFor(() => {
      expect(result.getByLabelText("rectangle annotation")).toHaveAttribute(
        "data-drawing-annotation-id",
        "rectangle-1",
      );
    });
  });

  it.each(["rectangle", "cloud"] as const)(
    "moves a selected %s and deletes it with the keyboard",
    async (type) => {
    apiFetchMock
      .mockResolvedValueOnce({ annotations: [storedShape(type)] })
      .mockResolvedValueOnce({
        annotation: {
          ...storedShape(type, { x: 40, y: 45 }),
          data: {
            ...storedShape(type, { x: 40, y: 45 }).data,
            start: { x: 20, y: 25 },
          },
        },
      })
      .mockResolvedValueOnce({ success: true });

    const { getByLabelText, overlay } = renderOverlay();
    await waitFor(() => expect(getByLabelText(`${type} annotation`)).toBeInTheDocument());

    fireEvent.pointerDown(overlay, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(overlay, { clientX: 30, clientY: 35, pointerId: 1 });
    fireEvent.pointerUp(overlay, { clientX: 30, clientY: 35, pointerId: 1 });

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith(
      `/api/projects/67/drawings/drawing-123/annotations/${type}-1`,
      {
        method: "PATCH",
        body: JSON.stringify({
          data: {
            start: { x: 20, y: 25 },
            end: { x: 40, y: 45 },
            page_percent: true,
            color: "#ef4444",
            strokeWidth: 2,
          },
        }),
      },
    ));

    fireEvent.keyDown(window, { key: "Delete" });
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith(
      `/api/projects/67/drawings/drawing-123/annotations/${type}-1`,
      { method: "DELETE" },
    ));
    },
  );

  it("rolls a failed move back and keeps the annotation selected", async () => {
    apiFetchMock
      .mockResolvedValueOnce({ annotations: [storedShape("rectangle")] })
      .mockRejectedValueOnce(new Error("Network unavailable"));

    const { getByLabelText, overlay } = renderOverlay();
    await waitFor(() => expect(getByLabelText("rectangle annotation")).toBeInTheDocument());

    fireEvent.pointerDown(overlay, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(overlay, { clientX: 30, clientY: 35, pointerId: 1 });
    fireEvent.pointerUp(overlay, { clientX: 30, clientY: 35, pointerId: 1 });

    await waitFor(() => {
      expect(getByLabelText("Selected rectangle annotation")).toBeInTheDocument();
      expect(getByLabelText("rectangle annotation")).toHaveAttribute("x", "10");
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Annotation could not be moved",
        expect.objectContaining({ description: expect.stringContaining("previous saved geometry was restored") }),
      );
    });
  });

  it("restores a selected annotation when deletion fails", async () => {
    apiFetchMock
      .mockResolvedValueOnce({ annotations: [storedShape("rectangle")] })
      .mockRejectedValueOnce(new Error("Permission denied"));

    const { getByLabelText, overlay } = renderOverlay();
    await waitFor(() => expect(getByLabelText("rectangle annotation")).toBeInTheDocument());
    fireEvent.pointerDown(overlay, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerUp(overlay, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.keyDown(window, { key: "Delete" });

    await waitFor(() => {
      expect(getByLabelText("Selected rectangle annotation")).toBeInTheDocument();
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Annotation could not be deleted",
        expect.objectContaining({ description: expect.stringContaining("restored and remains selected") }),
      );
    });
  });

  it.each(["Backspace", "Delete"])("does not handle %s from an editable field", async (key) => {
    apiFetchMock.mockResolvedValueOnce({ annotations: [storedShape("rectangle")] });
    const { getByLabelText, overlay } = renderOverlay();
    await waitFor(() => expect(getByLabelText("rectangle annotation")).toBeInTheDocument());
    fireEvent.pointerDown(overlay, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerUp(overlay, { clientX: 20, clientY: 20, pointerId: 1 });

    const input = document.createElement("input");
    document.body.append(input);
    fireEvent.keyDown(input, { key });

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(getByLabelText("Selected rectangle annotation")).toBeInTheDocument();
    input.remove();
  });

  it("rolls failed resize requests back and keeps the annotation selected", async () => {
    apiFetchMock
      .mockResolvedValueOnce({ annotations: [storedShape("rectangle")] })
      .mockRejectedValueOnce(new Error("Network unavailable"));

    const { getByLabelText, overlay } = renderOverlay();
    await waitFor(() => expect(getByLabelText("rectangle annotation")).toBeInTheDocument());

    fireEvent.pointerDown(overlay, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerUp(overlay, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerDown(overlay, { clientX: 30, clientY: 30, pointerId: 2 });
    fireEvent.pointerMove(overlay, { clientX: 60, clientY: 55, pointerId: 2 });
    fireEvent.pointerUp(overlay, { clientX: 60, clientY: 55, pointerId: 2 });

    await waitFor(() => {
      expect(getByLabelText("Selected rectangle annotation")).toBeInTheDocument();
      expect(getByLabelText("rectangle annotation")).toHaveAttribute("width", "20");
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Annotation could not be resized",
        expect.objectContaining({ description: expect.stringContaining("previous saved geometry was restored") }),
      );
    });
  });

  it("discards a newly drawn annotation when the pointer interaction is canceled", async () => {
    apiFetchMock.mockResolvedValueOnce({ annotations: [] });
    const { queryByLabelText, overlay } = renderOverlay("rectangle");
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));

    fireEvent.pointerDown(overlay, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(overlay, { clientX: 30, clientY: 30, pointerId: 1 });
    expect(queryByLabelText("rectangle annotation")).toBeInTheDocument();
    fireEvent.pointerCancel(overlay, { pointerId: 1 });

    expect(queryByLabelText("rectangle annotation")).not.toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(overlay.releasePointerCapture).toHaveBeenCalled();
  });
});
