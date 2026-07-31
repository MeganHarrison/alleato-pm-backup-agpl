/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import {
  buildDocumentTableColumns,
  type PipelineDoc,
} from "@/features/documents/documents-table-config";

function buildDocument(overrides: Partial<PipelineDoc> = {}): PipelineDoc {
  return {
    id: "doc-1",
    fireflies_id: null,
    title: "Owner contract",
    status: null,
    type: "document",
    category: "contract",
    document_type: "contract",
    source: "manual_upload",
    source_system: "manual_upload",
    source_web_url: null,
    date: "2026-07-02T12:00:00.000Z",
    created_at: "2026-07-02T12:00:00.000Z",
    captured_at: null,
    file_path: null,
    storage_bucket: null,
    url: null,
    project_id: 876,
    project_name: "Project 876",
    summary: null,
    overview: null,
    participants: null,
    participants_array: null,
    pipeline_stage: "done",
    attempt_count: 1,
    last_attempt_at: null,
    error_message: null,
    ...overrides,
  };
}

describe("documents table config", () => {
  it("links the title directly to the actual document", () => {
    const titleColumn = buildDocumentTableColumns({
    }).find((column) => column.id === "title");

    if (!titleColumn) {
      throw new Error("Title column missing");
    }

    render(<>{titleColumn.render(buildDocument({ url: "https://files.example.com/doc-1.pdf" }))}</>);

    expect(screen.getByRole("link", { name: "Owner contract" })).toHaveAttribute(
      "href",
      "https://files.example.com/doc-1.pdf",
    );
  });
});
