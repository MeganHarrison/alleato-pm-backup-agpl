/** @jest-environment jsdom */

import { render, screen, within } from "@testing-library/react";

import { PageDiscussionSheet } from "../comments-sidebar-button";

jest.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@veltdev/react", () => ({
  useCommentModeState: () => false,
  useCommentUtils: () => null,
}));

const comment = {
  documentId: "/",
  annotationId: "annotation-1",
  annotationNumber: 1,
  authorName: "Megan Harrison",
  preview: "Please review this detail.",
  statusName: "Open",
  replyCount: 0,
  lastUpdated: Date.now(),
  messages: [
    {
      commentId: "comment-1",
      authorName: "Megan Harrison",
      text: "Please review this detail.",
      createdAt: Date.now(),
    },
  ],
};

describe("PageDiscussionSheet", () => {
  it("keeps the empty sheet quiet without count or section borders", () => {
    render(
      <PageDiscussionSheet
        open
        onOpenChange={jest.fn()}
        comments={[]}
        onAddComment={jest.fn()}
      />,
    );

    expect(screen.queryByText("0 comments")).not.toBeInTheDocument();
    expect(screen.getByText("No page discussion yet.")).toBeInTheDocument();

    const header = screen.getByText("Comments").closest("[data-slot='sheet-header']");
    const footer = screen
      .getByText("View all comments")
      .closest("[data-slot='sheet-footer']");
    expect(header).not.toHaveClass("border-b");
    expect(footer).not.toHaveClass("border-t");

    const replyButton = screen.getByRole("button", { name: /reply on page/i });
    const sendIcon = replyButton.querySelector("svg.lucide-send-horizontal");
    expect(sendIcon?.parentElement).toHaveClass("text-muted-foreground");
    expect(sendIcon?.parentElement).not.toHaveClass("bg-primary");
  });

  it("uses compact author, message, and avatar hierarchy", () => {
    render(
      <PageDiscussionSheet
        open
        onOpenChange={jest.fn()}
        comments={[comment]}
        onAddComment={jest.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByText("Megan Harrison")).toHaveLength(1);
    expect(within(dialog).getByText("Megan Harrison")).toHaveClass(
      "text-xs",
      "font-medium",
    );
    expect(within(dialog).getByText("Please review this detail.")).toHaveClass(
      "text-xs",
      "leading-5",
    );
    expect(within(dialog).getByText("MH").closest("[data-slot='avatar']")).toHaveClass(
      "h-6",
      "w-6",
    );
  });
});
