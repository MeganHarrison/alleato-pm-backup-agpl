import {
  mapDrawingLogRow,
  type DrawingLogViewRow,
} from "@/types/drawings.types";

describe("mapDrawingLogRow", () => {
  it("uses revision publication state when present", () => {
    const row: DrawingLogViewRow = {
      area_id: null,
      area_name: null,
      deleted_at: null,
      deleted_by: null,
      discipline: "Architectural",
      drawing_created_at: "2026-06-23T00:00:00.000Z",
      drawing_date: null,
      drawing_number: "A101",
      drawing_type: "Plan",
      drawing_updated_at: "2026-06-23T00:00:00.000Z",
      file_name: "A101.pdf",
      file_size: 1000,
      file_type: "application/pdf",
      file_url: "https://example.com/A101.pdf",
      id: "drawing-id",
      is_obsolete: false,
      is_published: true,
      project_id: 1009,
      published_at: null,
      published_by: null,
      received_date: null,
      review_revision_id: "review-revision-id",
      revision_created_at: null,
      revision_description: null,
      revision_id: "review-revision-id",
      revision_is_published: false,
      revision_number: "1",
      set_name: null,
      status: "under_review",
      title: "First Floor Plan",
      uploaded_by: null,
      uploaded_by_email: null,
    };

    expect(mapDrawingLogRow(row).isPublished).toBe(false);
  });
});
