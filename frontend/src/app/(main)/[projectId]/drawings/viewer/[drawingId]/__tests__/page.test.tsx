/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";

const workspace = jest.fn(() => <div data-testid="drawing-interaction-workspace" />);

jest.mock("next/navigation", () => ({
  useParams: () => ({ projectId: "67", drawingId: "drawing-123" }),
}));

jest.mock("@/components/drawings/DrawingInteractionWorkspace", () => ({
  DrawingInteractionWorkspace: (props: unknown) => workspace(props),
}));

import DrawingViewerPage from "../page";

describe("DrawingViewerPage route adapter", () => {
  it("passes only route context to the canonical Drawing interaction workspace", () => {
    const { getByTestId } = render(<DrawingViewerPage />);

    expect(getByTestId("drawing-interaction-workspace")).toBeInTheDocument();
    expect(workspace).toHaveBeenCalledWith({ projectId: "67", drawingId: "drawing-123" });
  });
});
