/** @jest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import {
  SplitPage,
  getSplitPageFrameHeightClass,
} from "@/components/ui/split-page";

function mockDesktopViewport() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

describe("getSplitPageFrameHeightClass", () => {
  it("supports a parent-fill height contract for embedded workspaces", () => {
    const className = getSplitPageFrameHeightClass("fill");
    expect(className).toContain("h-full");
    expect(className).toContain("flex-1");
    expect(className).not.toContain("100dvh");
  });
});

describe("SplitPage variants", () => {
  beforeEach(() => {
    mockDesktopViewport();
  });

  it("hides an auxiliary pane unless the three-column variant is selected", async () => {
    const { rerender } = render(
      <SplitPage variant="two-column">
        {[
          <div key="list">List</div>,
          <div key="detail">Detail</div>,
          <div key="aux">Auxiliary rail</div>,
        ]}
      </SplitPage>,
    );

    await waitFor(() => expect(screen.getByText("Detail")).toBeVisible());
    expect(screen.queryByText("Auxiliary rail")).not.toBeInTheDocument();

    rerender(
      <SplitPage variant="three-column">
        {[
          <div key="list">List</div>,
          <div key="detail">Detail</div>,
          <div key="aux">Auxiliary rail</div>,
        ]}
      </SplitPage>,
    );

    await waitFor(() =>
      expect(screen.getByText("Auxiliary rail")).toBeVisible(),
    );
  });

  it("supports a configured desktop width for the first pane", async () => {
    render(
      <SplitPage variant="two-column" firstPaneWidth="30rem">
        {[
          <div key="list">List</div>,
          <div key="detail">Detail</div>,
        ]}
      </SplitPage>,
    );

    await waitFor(() =>
      expect(screen.getByText("List").parentElement).toHaveStyle({
        width: "30rem",
      }),
    );
  });
});
