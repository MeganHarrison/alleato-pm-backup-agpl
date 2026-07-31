/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
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

const existingTextAnnotation = {
  id: "text-annotation-1",
  annotation_type: "text",
  page: 1,
  data: {
    position: { x: 25, y: 30 },
    text: "Existing text",
    color: "#ef4444",
    strokeWidth: 2,
    page_percent: true,
  },
};

function renderOverlay() {
  return render(
    <PdfjsExpressMarkupOverlay
      projectId="67"
      drawingId="drawing-123"
      page={1}
      tool="select"
      color="#ef4444"
      pageViewport={{ left: 0, top: 0, width: 100, height: 100 }}
    />,
  );
}

describe("PdfjsExpressMarkupOverlay text editing", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    toastErrorMock.mockReset();
  });

  it("opens a light inline editor and persists changes to the existing annotation", async () => {
    apiFetchMock
      .mockResolvedValueOnce({ annotations: [existingTextAnnotation] })
      .mockResolvedValueOnce({
        annotation: {
          ...existingTextAnnotation,
          data: { ...existingTextAnnotation.data, text: "Updated text" },
        },
      });

    const { getByLabelText, getByText } = renderOverlay();
    await waitFor(() => expect(getByText("Existing text")).toBeInTheDocument());

    fireEvent.click(getByText("Existing text"));
    const input = getByLabelText("Markup text");
    expect(input).toHaveValue("Existing text");
    expect(input).toHaveClass("bg-primary-foreground", "text-foreground", "dark:text-background");

    fireEvent.change(input, { target: { value: "Updated text" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/projects/67/drawings/drawing-123/annotations/text-annotation-1",
        {
          method: "PATCH",
          body: JSON.stringify({
            data: {
              position: { x: 25, y: 30 },
              text: "Updated text",
              page_percent: true,
              color: "#ef4444",
              strokeWidth: 2,
            },
          }),
        },
      );
      expect(getByText("Updated text")).toBeInTheDocument();
    });
  });

  it("restores the editor with the user's text when saving fails", async () => {
    apiFetchMock
      .mockResolvedValueOnce({ annotations: [existingTextAnnotation] })
      .mockRejectedValueOnce(new Error("Network unavailable"));

    const { getByLabelText, getByText } = renderOverlay();
    await waitFor(() => expect(getByText("Existing text")).toBeInTheDocument());

    fireEvent.click(getByText("Existing text"));
    fireEvent.change(getByLabelText("Markup text"), { target: { value: "Do not lose this" } });
    fireEvent.submit(getByLabelText("Markup text").closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(getByLabelText("Markup text")).toHaveValue("Do not lose this");
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Text could not be updated",
        expect.objectContaining({ description: expect.stringContaining("still in the editor") }),
      );
    });
  });
});
