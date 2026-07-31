/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AppTrainingDocsPage } from "../app-training-docs-page";
import { KnowledgeBasePage } from "../knowledge-base-page";

jest.mock("@/components/layout", () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SectionRuleHeading: ({
    label,
    actions,
  }: {
    label: React.ReactNode;
    actions?: React.ReactNode;
  }) => (
    <div>
      <div role="heading" aria-level={2}>
        {label}
      </div>
      {actions}
    </div>
  ),
}));

jest.mock("@/hooks/use-knowledge-documents", () => ({
  useKnowledgeDocuments: () => ({
    isLoading: false,
    data: [
      {
        id: "doc-1",
        title: "Safety orientation",
        category: "knowledge",
        source: "knowledge_upload",
        status: "processed",
        tags: ["Field Operations", "safety"],
        date: "2026-06-20T12:00:00Z",
        file_name: "safety-orientation.pdf",
        file_path: "knowledge/doc-1/safety-orientation.pdf",
        project_id: null,
        created_at: "2026-06-20T12:00:00Z",
      },
      {
        id: "doc-2",
        title: "Subcontract template",
        category: "knowledge",
        source: "sharepoint",
        status: "processed",
        tags: ["Contracts", "templates"],
        date: "2026-06-19T12:00:00Z",
        file_name: "subcontract-template.docx",
        file_path: "knowledge/doc-2/subcontract-template.docx",
        project_id: null,
        created_at: "2026-06-19T12:00:00Z",
      },
    ],
  }),
}));

jest.mock("@/hooks/use-current-user-profile", () => ({
  useCurrentUserProfile: () => ({
    profile: { isAdmin: true },
  }),
}));

const apiFetchMock = jest.fn();

jest.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("KnowledgeBasePage", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("renders a docs-style knowledge layout with topic nav and on-page index", () => {
    render(<KnowledgeBasePage />);

    expect(
      screen.getByRole("heading", { name: "Alleato Knowledge Base" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Knowledge topics" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "On this page" }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search knowledge...")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Field Operations/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Contracts/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Add knowledge" })[0]).toHaveAttribute(
      "href",
      "/knowledge/manage",
    );
    expect(screen.queryByRole("link", { name: "Manage sources" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Browse by topic" })).not.toBeInTheDocument();
    expect(
      screen.queryByText("Topics follow the same source taxonomy used by the knowledge pipeline."),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Source documents" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Source confidence" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Safety orientation/ })).not.toBeInTheDocument();
  });

  it("shows matching source documents when a category is selected", async () => {
    const user = userEvent.setup();
    render(<KnowledgeBasePage />);

    expect(
      screen.queryByRole("heading", { name: "Field Operations sources" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /Field Operations/ })[0]);

    expect(
      screen.getByRole("heading", { name: "Field Operations sources" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Safety orientation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Safety orientation" })).toBeInTheDocument();
    expect(screen.queryByText("safety-orientation.pdf")).not.toBeInTheDocument();
    expect(screen.queryByText(/knowledge_upload/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open" })).not.toBeInTheDocument();
    expect(screen.queryByText("Subcontract template")).not.toBeInTheDocument();
  });

  it("renders app training docs with the shared knowledge layout", () => {
    render(
      <AppTrainingDocsPage
        trainingDocs={[
          {
            title: "Budget Setup",
            slug: "budget-setup",
            summary: "Create budget line items.",
            audience: "internal",
            status: "published",
            sourceRoute: "/1009/budget",
            publishedDocPath:
              "project-management-tools/training-docs/budget-setup.mdx",
            lastPublishedAt: "2026-06-30T12:00:00Z",
            appToolCategory: null,
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Training Docs" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Knowledge topics" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "On this page" }),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Search training docs..."),
    ).toBeInTheDocument();
    expect(screen.getByRole("banner")).toHaveClass("hidden", "lg:flex");
    expect(screen.getAllByRole("link", { name: /Budget/ })[0]).toHaveAttribute(
      "href",
      "/knowledge/app/budget",
    );
    expect(
      screen.getAllByRole("link", { name: /Create/ })[0],
    ).toHaveAttribute("href", "/training-docs");
    expect(
      screen.getByRole("button", { name: "Open knowledge menu" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open knowledge menu" }).parentElement
        ?.parentElement,
    ).not.toHaveClass("border-b");
    expect(screen.queryByText("App Training")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Company Knowledge" })).not.toBeInTheDocument();
  });

  it("opens the mobile training docs menu", async () => {
    const user = userEvent.setup();
    render(<AppTrainingDocsPage trainingDocs={[]} />);

    await user.click(
      screen.getByRole("button", { name: "Open knowledge menu" }),
    );

    expect(
      screen.getByRole("navigation", { name: "Mobile knowledge topics" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Close knowledge menu" }),
    ).toBeInTheDocument();
  });

  it("lists published training docs on the selected docs-style tool page", () => {
    render(
      <AppTrainingDocsPage
        activeCategorySlug="budget"
        trainingDocs={[
          {
            title: "Budget Setup",
            slug: "budget-setup",
            summary: "Create budget line items.",
            audience: "internal",
            status: "published",
            sourceRoute: "/1009/budget",
            publishedDocPath:
              "project-management-tools/training-docs/budget-setup.mdx",
            lastPublishedAt: "2026-06-30T12:00:00Z",
            appToolCategory: null,
          },
          {
            title: "Meeting Prep",
            slug: "meeting-prep",
            summary: "Prepare for a meeting.",
            audience: "internal",
            status: "published",
            sourceRoute: "/1009/meetings",
            publishedDocPath:
              "project-management-tools/training-docs/meeting-prep.mdx",
            lastPublishedAt: "2026-06-30T12:00:00Z",
            appToolCategory: null,
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Budget Training Docs" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Budget training docs" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Budget Setup")).toBeInTheDocument();
    expect(screen.queryByText("Meeting Prep")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Budget Setup/ }),
    ).toHaveAttribute(
      "href",
      "https://alleato-os-docs.vercel.app/project-management-tools/training-docs/budget-setup",
    );
  });
});
