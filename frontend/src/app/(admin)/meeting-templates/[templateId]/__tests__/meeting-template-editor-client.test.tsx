/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useRouter, usePathname } from "next/navigation";

import { MeetingTemplateEditorClient } from "../meeting-template-editor-client";
import type { AdminMeetingTemplateDetail } from "@/hooks/use-meeting-templates";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

const mutateAsyncMock = jest.fn();

jest.mock("@/hooks/use-meeting-templates", () => ({
  useAdminMeetingTemplateDetail: jest.fn(),
  useUpdateMeetingTemplate: jest.fn(),
}));

import {
  useAdminMeetingTemplateDetail,
  useUpdateMeetingTemplate,
} from "@/hooks/use-meeting-templates";

const mockUseAdminMeetingTemplateDetail = useAdminMeetingTemplateDetail as jest.Mock;
const mockUseUpdateMeetingTemplate = useUpdateMeetingTemplate as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;
const mockUsePathname = usePathname as jest.Mock;

const TEMPLATE_ID = "template-1";

function baseDetail(): AdminMeetingTemplateDetail {
  return {
    id: TEMPLATE_ID,
    name: "Weekly OAC Meeting",
    overview: "Standard weekly owner-architect-contractor sync.",
    is_private: false,
    categories: [
      {
        id: "cat-1",
        name: "Safety",
        position: 0,
        items: [
          {
            id: "item-1",
            position: 0,
            title: "Review incident log",
            description: null,
            priority: "high",
          },
        ],
      },
    ],
  };
}

describe("MeetingTemplateEditorClient", () => {
  beforeEach(() => {
    mockUseRouter.mockReturnValue({ push: jest.fn() });
    mockUsePathname.mockReturnValue("/meeting-templates/template-1");
    mockUseAdminMeetingTemplateDetail.mockReturnValue({
      data: baseDetail(),
      isLoading: false,
      error: null,
    });
    mockUseUpdateMeetingTemplate.mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("sends a full-replace nested payload matching createTemplateSchema on save", async () => {
    mutateAsyncMock.mockResolvedValue(baseDetail());

    render(<MeetingTemplateEditorClient templateId={TEMPLATE_ID} />);

    // Enter edit mode
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    // Edit the template name
    const nameInput = screen.getByLabelText("Name");
    fireEvent.change(nameInput, { target: { value: "Weekly OAC Meeting (Updated)" } });

    // Add a new category
    fireEvent.click(screen.getByRole("button", { name: /add category/i }));

    // Add an item to the newly created category (second "Add item" button)
    const addItemButtons = screen.getAllByRole("button", { name: /add item/i });
    fireEvent.click(addItemButtons[addItemButtons.length - 1]);

    // Fill in the new item's title (last title-like input added)
    const titleInputs = screen.getAllByPlaceholderText("Item title");
    fireEvent.change(titleInputs[titleInputs.length - 1], {
      target: { value: "Confirm site access" },
    });

    // Save
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalledTimes(1));

    const [callArgs] = mutateAsyncMock.mock.calls[0];
    expect(callArgs.templateId).toBe(TEMPLATE_ID);
    expect(callArgs.data).toEqual({
      name: "Weekly OAC Meeting (Updated)",
      overview: "Standard weekly owner-architect-contractor sync.",
      is_private: false,
      categories: [
        {
          name: "Safety",
          items: [
            {
              title: "Review incident log",
              description: undefined,
              priority: "high",
            },
          ],
        },
        {
          name: "New category",
          items: [
            {
              title: "Confirm site access",
              description: undefined,
              priority: undefined,
            },
          ],
        },
      ],
    });

    // The payload shape is a strict subset of createTemplateSchema's fields —
    // no stray client-only keys (id, position, key) leak into the request.
    for (const category of callArgs.data.categories) {
      expect(Object.keys(category).sort()).toEqual(["items", "name"]);
      for (const item of category.items) {
        expect(Object.keys(item).sort()).toEqual(["description", "priority", "title"]);
      }
    }
  });
});
