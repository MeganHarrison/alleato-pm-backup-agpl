import {
  fmdsFiguresConfig,
  fmdsFiguresDescription,
  selectFmdsFigureReviewCorpus,
} from "../fmds-figures";
import type { FmdsCorpusRevision } from "../fmds-tables";

const revision: FmdsCorpusRevision = { id: "revision-2026-04", document_code: "FMDS0834", revision_label: "2026-04", publication_date: "2026-04-01", status: "staging", source_file_name: "FMDS0834 - 2026.pdf", source_page_count: 122 };
describe("fmdsFiguresConfig", () => {
  it("uses revision-scoped FMDS fields rather than PM APP figure fields", () => {
    expect(fmdsFiguresConfig.searchFields).toEqual(expect.arrayContaining(["figure_identifier", "review_reason"]));
    expect(fmdsFiguresConfig.searchFields).not.toContain("asrs_type");
    expect(fmdsFiguresConfig.defaultSortColumn).toBe("page_number");
  });
  it("makes staging review status visible", () => expect(fmdsFiguresDescription(revision)).toBe("FMDS0834 · 2026-04 · staging review figure corpus"));

  it("prioritizes a staged corpus that contains figures needing review", () => {
    const selected = selectFmdsFigureReviewCorpus([
      { revision, figures: [] },
      {
        revision: { ...revision, id: "revision-0809", document_code: "FMDS0809" },
        figures: [
          {
            id: "figure-3",
            revision_id: "revision-0809",
            figure_identifier: "Figure 3",
            title: null,
            page_number: 42,
            caption_text: null,
            bounding_box: null,
            extracted_description: {},
            extraction_method: "rendered-page",
            extraction_confidence: 0.4,
            review_status: "needs_review",
            review_priority: 1,
            review_reason: "Visual validation required",
            evidence_image_path: "evidence.png",
            created_at: "2026-07-20T00:00:00Z",
            updated_at: "2026-07-20T00:00:00Z",
          },
        ],
      },
    ]);

    expect(selected?.revision.document_code).toBe("FMDS0809");
  });
});
