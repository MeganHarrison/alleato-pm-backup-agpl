/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import type { AssistantSuggestion } from "@/lib/ai/assistant-suggestion-resolver";
import { AssistantSuggestionList } from "../assistant-suggestion-list";

const suggestions: AssistantSuggestion[] = [
  {
    id: "openAiApprovals",
    label: "Review AI approvals",
    prompt: "Open AI approvals.",
    href: "/ai/approvals",
    status: "ready",
    statusLabel: "Ready",
    unavailableReason: null,
    requiresApproval: false,
    reason: "Widget context",
  },
  {
    id: "createChangeEvent",
    label: "Create change request",
    prompt: "Help me create a change request.",
    href: null,
    status: "preview_required",
    statusLabel: "Preview required",
    unavailableReason: null,
    requiresApproval: true,
    reason: "Widget context",
  },
];

describe("AssistantSuggestionList", () => {
  it("renders compact suggestions as simple links and buttons for the widget", () => {
    const onSelectPrompt = jest.fn();

    render(
      <AssistantSuggestionList
        suggestions={suggestions}
        variant="compact"
        onSelectPrompt={onSelectPrompt}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Review AI approvals" }),
    ).toHaveAttribute("href", "/ai/approvals");

    const promptButton = screen.getByRole("button", {
      name: "Create change request",
    });
    expect(promptButton).toHaveClass("text-primary");
    expect(promptButton).not.toHaveClass("min-h-16");

    fireEvent.click(promptButton);

    expect(onSelectPrompt).toHaveBeenCalledWith(
      "Help me create a change request.",
    );
  });
});
