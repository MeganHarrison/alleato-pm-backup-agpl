/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { AssistantActionCatalog } from "../assistant-action-catalog";

describe("AssistantActionCatalog", () => {
  it("renders route actions as links and tool actions as prompt buttons", () => {
    const onSelectPrompt = jest.fn();

    render(<AssistantActionCatalog onSelectPrompt={onSelectPrompt} />);

    expect(screen.getByRole("link", { name: /review ai approvals/i })).toHaveAttribute(
      "href",
      "/ai/approvals",
    );
    expect(screen.getByRole("link", { name: /review my ai profile/i })).toHaveAttribute(
      "href",
      "/ai/profile",
    );

    fireEvent.click(screen.getByRole("button", { name: /create change request/i }));

    expect(onSelectPrompt).toHaveBeenCalledWith(
      expect.stringContaining("Help me create a change request"),
    );
  });
});
