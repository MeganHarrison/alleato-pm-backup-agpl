/** @jest-environment jsdom */
import React from "react";
import { render, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const webViewerMock = jest.fn((_: unknown, viewerElement: HTMLElement) => {
  const host = viewerElement.parentElement;
  if (host) {
    const vendorWrapper = document.createElement("div");
    host.appendChild(vendorWrapper);
    vendorWrapper.appendChild(viewerElement);
  }
  return new Promise(() => undefined);
});

jest.mock("@pdftron/pdfjs-express-viewer", () => ({
  __esModule: true,
  default: (...args: unknown[]) => webViewerMock(...(args as [unknown, HTMLElement])),
}));

jest.mock("../PdfjsExpressMarkupOverlay", () => ({
  PdfjsExpressMarkupOverlay: React.forwardRef(function MockMarkupOverlay(
    props: { pageViewport?: unknown },
    _ref: React.ForwardedRef<unknown>,
  ) {
    return props.pageViewport ? <div aria-label="Drawing markup overlay" /> : null;
  }),
}));

import { PdfjsExpressDrawingViewer } from "../PdfjsExpressDrawingViewer";

const baseProps = {
  licenseKey: "test-license",
  projectId: "67",
  drawingId: "drawing-123",
  page: 1,
  markupTool: "select" as const,
  markupColor: "#ef4444",
};

describe("PdfjsExpressDrawingViewer vendor mount cleanup", () => {
  beforeEach(() => {
    webViewerMock.mockClear();
  });

  it("removes a PDF.js mount node from its actual parent after the vendor reparents it", async () => {
    const { rerender } = render(
      <PdfjsExpressDrawingViewer {...baseProps} fileUrl="https://example.com/first.pdf" />,
    );

    await waitFor(() => expect(webViewerMock).toHaveBeenCalledTimes(1));

    expect(() => rerender(
      <PdfjsExpressDrawingViewer {...baseProps} fileUrl="https://example.com/second.pdf" />,
    )).not.toThrow();

    await waitFor(() => expect(webViewerMock).toHaveBeenCalledTimes(2));
  });

  it("starts only the committed PDF.js instance during a Strict Mode mount", async () => {
    render(
      <React.StrictMode>
        <PdfjsExpressDrawingViewer {...baseProps} fileUrl="https://example.com/strict.pdf" />
      </React.StrictMode>,
    );

    await waitFor(() => expect(webViewerMock).toHaveBeenCalledTimes(1));
  });

  it("surfaces structured vendor initialization failures instead of hiding them", async () => {
    webViewerMock.mockRejectedValueOnce({
      code: "VIEWER_BOOT_FAILED",
      detail: "The document runtime could not start.",
    });

    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const { findByText } = render(
      <PdfjsExpressDrawingViewer {...baseProps} fileUrl="https://example.com/failure.pdf" />,
    );

    expect(await findByText(/VIEWER_BOOT_FAILED/)).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(
      "PDF.js Express initialization failed.",
      expect.objectContaining({ code: "VIEWER_BOOT_FAILED" }),
    );
    consoleError.mockRestore();
  });
});
