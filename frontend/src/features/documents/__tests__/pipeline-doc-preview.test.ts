import {
  pipelineDocInlineHref,
  pipelineDocPreviewKind,
  pipelineDocIsGraphSourced,
} from "@/features/documents/pipeline-doc-preview";
import type { PipelineDoc } from "@/features/documents/documents-table-config";

function doc(partial: Partial<PipelineDoc>): PipelineDoc {
  return {
    id: "abc", fireflies_id: null, title: null, status: null, type: null,
    category: null, document_type: null, source: null, source_system: null,
    source_web_url: null, date: null, created_at: null, captured_at: null,
    file_path: null, storage_bucket: null, url: null, project_id: 1,
    summary: null, overview: null, participants: null, participants_array: null,
    pipeline_stage: "embedded", attempt_count: 0, last_attempt_at: null,
    error_message: null, ...partial,
  };
}

describe("pipeline-doc-preview", () => {
  it("builds an inline href from the document id", () => {
    expect(pipelineDocInlineHref(doc({ id: "uuid-1" }))).toBe(
      "/api/files/uuid-1/download?disposition=inline",
    );
  });

  it("detects pdf by title extension", () => {
    expect(pipelineDocPreviewKind(doc({ title: "A-201.pdf" }))).toBe("pdf");
  });

  it("detects image by file_path extension", () => {
    expect(pipelineDocPreviewKind(doc({ file_path: "/x/site.PNG" }))).toBe("image");
  });

  it("detects office for docx/xlsx/pptx", () => {
    expect(pipelineDocPreviewKind(doc({ title: "rfi.docx" }))).toBe("office");
    expect(pipelineDocPreviewKind(doc({ title: "sov.xlsx" }))).toBe("office");
  });

  it("returns none for unknown/extensionless", () => {
    expect(pipelineDocPreviewKind(doc({ title: "meeting notes" }))).toBe("none");
  });

  it("flags microsoft_graph source", () => {
    expect(pipelineDocIsGraphSourced(doc({ source_system: "microsoft_graph" }))).toBe(true);
    expect(pipelineDocIsGraphSourced(doc({ source_system: "manual_upload" }))).toBe(false);
  });
});
