/** @jest-environment jsdom */
/* eslint-disable design-system/no-raw-button -- The ErrorState test double needs a native click target. */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { DrawingInteractionWorkspace } from "../DrawingInteractionWorkspace";

const refetchDrawing = jest.fn();
const useDrawingMock = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => "/67/drawings/viewer/drawing-123",
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@veltdev/react", () => ({ useCommentUtils: () => null }));

jest.mock("@/hooks/use-drawings", () => ({
  useDrawing: () => useDrawingMock(),
  useDrawings: () => ({ data: undefined }),
}));

jest.mock("@/hooks/use-drawing-pins", () => ({
  useDrawingPins: () => ({ data: [] }),
  useCreateDrawingPin: () => ({ mutateAsync: jest.fn() }),
}));

jest.mock("@/lib/stores/comments-visibility-store", () => ({
  useCommentsVisibilityStore: (selector: (state: { setVisible: jest.Mock }) => unknown) => selector({ setVisible: jest.fn() }),
}));

jest.mock("@/components/layout", () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

jest.mock("@/components/ds", () => ({
  DetailField: () => null,
  DetailFieldGrid: () => null,
  ErrorState: ({ title, description, onRetry }: { title: string; description: string; onRetry?: () => void }) => (
    <section>
      <h1>{title}</h1>
      <p>{description}</p>
      {onRetry && <button type="button" onClick={onRetry}>Try again</button>}
    </section>
  ),
}));

describe("DrawingInteractionWorkspace loading watchdog", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    refetchDrawing.mockReset();
    useDrawingMock.mockReturnValue({ data: undefined, isLoading: true, error: null, refetch: refetchDrawing });
  });

  afterEach(() => jest.useRealTimers());

  it("replaces an unresolved drawing loader with a specific retryable error", async () => {
    render(<DrawingInteractionWorkspace projectId="67" drawingId="drawing-123" />);

    expect(screen.getByText("Loading drawing...")).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(20_000);
    });

    expect(screen.getByRole("heading", { name: "Drawing is taking too long to load" })).toBeInTheDocument();
    expect(screen.getByText(/drawing changes have not been modified/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetchDrawing).toHaveBeenCalledTimes(1);
  });

  it("keeps an immediate drawing error recoverable", () => {
    useDrawingMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Drawing service unavailable"),
      refetch: refetchDrawing,
    });

    render(<DrawingInteractionWorkspace projectId="67" drawingId="drawing-123" />);

    expect(screen.getByRole("heading", { name: "Failed to load drawing" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetchDrawing).toHaveBeenCalledTimes(1);
  });
});
