/** @jest-environment jsdom */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import { FeedbackResourcesSection } from "../feedback-resources-section";
import type { FeedbackItem } from "../../types";

jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        uploadToSignedUrl: jest.fn(),
      }),
    },
  }),
}));

function buildFeedbackItem(
  metadata: Record<string, unknown> = {},
): FeedbackItem {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    created_at: "2026-07-02T12:00:00Z",
    updated_at: "2026-07-02T12:00:00Z",
    created_by: "22222222-2222-4222-8222-222222222222",
    project_id: null,
    page_url: "https://projects.alleatogroup.com/feedback-inbox",
    page_path: "/feedback-inbox",
    page_title: "Feedback Inbox",
    target_id: null,
    target_selector: "body",
    target_text: null,
    target_tag: null,
    dom_path: null,
    target_rect: null,
    title: "Resource test",
    comment: "Attach screenshots and templates.",
    request_type: "change_request",
    severity: "medium",
    status: "open",
    screenshot_url: null,
    screenshot_path: null,
    github_issue_number: null,
    github_issue_url: null,
    github_issue_state: null,
    metadata,
    submitter: {
      id: "22222222-2222-4222-8222-222222222222",
      email: "admin@example.com",
      full_name: "Admin User",
    },
  };
}

describe("FeedbackResourcesSection", () => {
  it("renders saved link and file resources from feedback metadata", () => {
    render(
      <FeedbackResourcesSection
        item={buildFeedbackItem({
          resources: [
            {
              id: "33333333-3333-4333-8333-333333333333",
              kind: "link",
              label: "Procore screenshot",
              url: "https://procore.example.com/screenshot",
              path: null,
              fileName: null,
              mimeType: null,
              sizeBytes: null,
              createdAt: "2026-07-02T12:01:00Z",
              createdBy: "22222222-2222-4222-8222-222222222222",
            },
            {
              id: "44444444-4444-4444-8444-444444444444",
              kind: "file",
              label: "Contract template.docx",
              url: "https://storage.example.com/template.docx",
              path: "resources/11111111-1111-4111-8111-111111111111/2026-07-02/file.docx",
              fileName: "Contract template.docx",
              mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              sizeBytes: 2048,
              createdAt: "2026-07-02T12:02:00Z",
              createdBy: "22222222-2222-4222-8222-222222222222",
            },
          ],
        })}
        onResourcesChanged={() => {}}
      />,
    );

    expect(screen.getByText("Resources")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Procore screenshot" })).toHaveAttribute(
      "href",
      "https://procore.example.com/screenshot",
    );
    expect(screen.getByRole("link", { name: "Contract template.docx" })).toHaveAttribute(
      "href",
      "https://storage.example.com/template.docx",
    );
    expect(screen.getByText("2 KB")).toBeInTheDocument();
  });

  it("keeps file and link add controls visible", () => {
    render(
      <FeedbackResourcesSection
        item={buildFeedbackItem()}
        onResourcesChanged={() => {}}
      />,
    );

    expect(screen.getByPlaceholderText("Paste URL")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Label")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add link" })).toBeDisabled();
    expect(screen.getByText("Drop files here or choose files")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose files" })).toBeInTheDocument();
  });
});
