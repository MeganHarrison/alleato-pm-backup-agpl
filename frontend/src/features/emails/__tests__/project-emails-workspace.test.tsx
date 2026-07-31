import {
  buildContextItems,
  PROJECT_EMAILS_WORKSPACE_CLASSNAME,
} from "@/features/emails/project-emails-workspace";
import type { ProjectEmail } from "@/hooks/use-emails";

function buildEmail(overrides: Partial<ProjectEmail> = {}): ProjectEmail {
  return {
    id: 42,
    project_id: 876,
    project: {
      id: 876,
      name: "Superior Beverae Exotec",
      project_number: "26-117",
    },
    subject: "Proposal",
    body: null,
    body_html: null,
    from_name: "Brandon Clymer",
    from_email: "bclymer@alleatogroup.com",
    to_list: ["awehner@alleatogroup.com"],
    cc_list: null,
    bcc_list: null,
    status: "Received",
    sent_at: "2026-06-09T19:28:00.000Z",
    received_at: "2026-06-09T19:28:00.000Z",
    is_private: false,
    is_starred: false,
    has_attachments: false,
    related_tool: null,
    related_id: null,
    distribution_group: null,
    thread_id: null,
    created_by: null,
    created_at: "2026-06-09T19:30:00.000Z",
    updated_at: "2026-06-09T19:30:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

describe("buildContextItems", () => {
  it("shows recipient and assigned project without created time", () => {
    const items = buildContextItems(buildEmail());
    const labels = items.map((item) => item.label);

    expect(labels).toEqual(["From", "To", "Project", "Received"]);
    expect(labels).not.toContain("Created");
    expect(items.find((item) => item.label === "To")?.value).toBe(
      "awehner@alleatogroup.com",
    );
    expect(items.find((item) => item.label === "Project")?.value).toBe(
      "26-117 - Superior Beverae Exotec",
    );
  });

  it("uses explicit fallback text for missing recipients or project", () => {
    const items = buildContextItems(
      buildEmail({
        project: null,
        to_list: [],
      }),
    );

    expect(items.find((item) => item.label === "To")?.value).toBe(
      "No recipients",
    );
    expect(items.find((item) => item.label === "Project")?.value).toBe(
      "No project assigned",
    );
  });
});

describe("ProjectEmailsWorkspace layout", () => {
  it("uses a parent-fill split-page contract instead of viewport subtraction", () => {
    expect(PROJECT_EMAILS_WORKSPACE_CLASSNAME).toContain("h-full");
    expect(PROJECT_EMAILS_WORKSPACE_CLASSNAME).toContain("min-h-0");
    expect(PROJECT_EMAILS_WORKSPACE_CLASSNAME).toContain("flex-1");
    expect(PROJECT_EMAILS_WORKSPACE_CLASSNAME).toContain("overflow-hidden");
    expect(PROJECT_EMAILS_WORKSPACE_CLASSNAME).toContain("w-full");
    expect(PROJECT_EMAILS_WORKSPACE_CLASSNAME).not.toContain("100dvh");
  });
});
