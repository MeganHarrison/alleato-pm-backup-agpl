/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";

import { AppTrainingDocPage } from "../app-training-doc-page";

jest.mock("@/components/layout", () => ({
  SectionRuleHeading: ({ label }: { label: React.ReactNode }) => (
    <div role="heading" aria-level={2}>
      {label}
    </div>
  ),
}));

jest.mock("@/components/docs/markdown-renderer", () => ({
  MarkdownRenderer: ({ content }: { content: string }) => (
    <div>
      {content.split("\n").map((line, index) => {
        if (line.startsWith("# ")) {
          return (
            <div key={`${line}-${index}`} role="heading" aria-level={1}>
              {line.replace(/^#\s+/, "")}
            </div>
          );
        }

        if (line.startsWith("## ")) {
          return (
            <div key={`${line}-${index}`} role="heading" aria-level={2}>
              {line.replace(/^##\s+/, "")}
            </div>
          );
        }

        if (!line.trim()) {
          return null;
        }

        return <p key={`${line}-${index}`}>{line}</p>;
      })}
    </div>
  ),
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

describe("AppTrainingDocPage", () => {
  it("does not repeat generated title and summary inside a training doc body", () => {
    render(
      <AppTrainingDocPage
        activeCategorySlug="prime-contracts"
        backHref="/knowledge/app/prime-contracts"
        backLabel="Prime Contracts training docs"
        doc={{
          id: "doc-1",
          created_at: "2026-06-30T12:00:00Z",
          updated_at: "2026-06-30T12:00:00Z",
          created_by: null,
          updated_by: null,
          title: "Create a Prime Contract",
          slug: "create-a-prime-contract",
          summary:
            "Create a prime contract with contract details, dates, schedule-of-values lines, and scope notes for owner billing.",
          body_markdown:
            "# Create a Prime Contract\n\nCreate a prime contract with contract details, dates, schedule-of-values lines, and scope notes for owner billing.\n\n## Before You Start\n\n- Confirm the owner/client, contract number, and basic contract scope before you open the form.\n\n## Steps\n\n1. Open the new prime contract form.",
          audience: "internal",
          status: "published",
          source_route: "/1034/prime-contracts/new",
          review_notes: null,
          target_collection: "app",
          tool_category: null,
          tool_module: null,
          task_key: null,
          qa_status: "not_run",
          qa_last_run_at: null,
          qa_notes: null,
          published_doc_path: null,
          last_published_at: "2026-06-30T12:00:00Z",
          last_publish_error: null,
          metadata: {},
          assets: [],
          steps: [
            {
              id: "step-1",
              training_doc_id: "doc-1",
              screenshot_asset_id: null,
              created_by: null,
              step_order: 1,
              title: "Open the new prime contract form",
              instruction_markdown: "Open Prime Contracts in the project.",
              expected_result: "The Create Prime Contract page opens.",
              source_url: null,
              action_metadata: {},
              created_at: "2026-06-30T12:00:00Z",
              updated_at: "2026-06-30T12:00:00Z",
              screenshot_asset: null,
            },
          ],
        }}
      />,
    );

    expect(
      screen.getAllByRole("heading", { name: "Create a Prime Contract" }),
    ).toHaveLength(1);
    expect(
      screen.getAllByText(
        "Create a prime contract with contract details, dates, schedule-of-values lines, and scope notes for owner billing.",
      ),
    ).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Before You Start" })).toBeInTheDocument();
    expect(screen.queryByText("1. Open the new prime contract form.")).not.toBeInTheDocument();
  });
});
