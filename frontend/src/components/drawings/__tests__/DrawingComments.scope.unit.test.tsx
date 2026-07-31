/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { DrawingComments } from "../DrawingComments";

const commentsSidebarProps = jest.fn();

jest.mock("@veltdev/react", () => ({
  VeltCommentsSidebar: (props: Record<string, unknown>) => {
    commentsSidebarProps(props);
    return <div data-testid="velt-comments-sidebar" />;
  },
}));

describe("DrawingComments scope", () => {
  beforeEach(() => commentsSidebarProps.mockClear());

  it("renders the document sidebar with drawing-only channel context", () => {
    render(
      <DrawingComments
        drawingId="drawing-123"
        documentId="/67/drawings/viewer/drawing-123"
        projectId={67}
      />,
    );

    expect(screen.getByTestId("velt-comments-sidebar")).toBeInTheDocument();
    expect(
      screen.getByTestId("velt-comments-sidebar").closest("section"),
    ).toHaveAttribute(
      "data-comment-document-id",
      "/67/drawings/viewer/drawing-123",
    );
    expect(commentsSidebarProps).toHaveBeenCalledWith(
      expect.objectContaining({
        embedMode: true,
        pageMode: true,
        focusedThreadMode: true,
        context: {
          commentChannel: "drawing",
          surface: "drawing-viewer",
          drawingId: "drawing-123",
        },
      }),
    );
  });
});
