/**
 * @jest-environment jsdom
 */

import DrawingViewerV2Redirect from "../page";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockReplace = jest.fn();

jest.mock("next/navigation", () => ({
  useParams: () => ({
    projectId: "876",
    drawingId: "drawing-123",
  }),
  usePathname: () => "/876/drawings/viewer-v2/drawing-123",
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

describe("DrawingViewerV2Redirect", () => {
  beforeEach(() => {
    mockReplace.mockReset();
  });

  it("redirects the deprecated viewer-v2 route to the canonical drawings viewer", () => {
    render(<DrawingViewerV2Redirect />);

    expect(mockReplace).toHaveBeenCalledWith("/876/drawings/viewer/drawing-123");
    expect(
      screen.getByText("Redirecting to the current drawing viewer…"),
    ).toBeInTheDocument();
  });
});
