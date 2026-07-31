/**
 * Regression test for issue #572 — Documents page gave no visible answer to
 * "where are these documents coming from, who is uploading them?". The raw
 * `source` enum value (e.g. "microsoft_graph") was either hidden entirely
 * (card grid view) or shown unhumanized (table/preview pane). This test
 * pins the humanized label so the source stays legible wherever it's shown.
 */

import { documentSourceLabel } from "@/features/documents/documents-table-config";

describe("documentSourceLabel", () => {
  it("humanizes known source values", () => {
    expect(documentSourceLabel("microsoft_graph")).toBe(
      "Microsoft (OneDrive/Email)",
    );
    expect(documentSourceLabel("manual_upload")).toBe("Manual Upload");
    expect(documentSourceLabel("fireflies")).toBe("Fireflies");
    expect(documentSourceLabel("local_filesystem")).toBe("Local Filesystem");
    expect(documentSourceLabel("knowledge_upload")).toBe("Knowledge Upload");
  });

  it("is case-insensitive against the known source values", () => {
    expect(documentSourceLabel("Zapier")).toBe("Zapier");
    expect(documentSourceLabel("MICROSOFT_GRAPH")).toBe(
      "Microsoft (OneDrive/Email)",
    );
  });

  it("falls back to a de-underscored label for unknown source values", () => {
    expect(documentSourceLabel("some_new_pipeline")).toBe(
      "some new pipeline",
    );
  });

  it("returns null for empty values instead of rendering a raw enum or blank", () => {
    expect(documentSourceLabel(null)).toBeNull();
    expect(documentSourceLabel(undefined)).toBeNull();
    expect(documentSourceLabel("")).toBeNull();
  });
});
