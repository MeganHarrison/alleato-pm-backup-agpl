import { findStoredSpecDocumentMatches } from "../document-intelligence";

describe("findStoredSpecDocumentMatches", () => {
  it("prefers spec-like project documents and returns focused excerpts", () => {
    const matches = findStoredSpecDocumentMatches(
      [
        {
          id: "spec-1",
          title: "08-1113 Hollow Metal Doors Specification",
          content:
            "Section 08-1113 requires thermally broken aluminum storefront framing and documented finish samples before fabrication.",
          raw_text: null,
          summary: null,
          overview: null,
          source: "documents",
          source_system: "manual_upload",
          document_type: "specification_pdf",
          category: "specification",
        },
        {
          id: "email-1",
          title: "Weekly job update",
          content: "Discuss storefront lead times with the team.",
          raw_text: null,
          summary: null,
          overview: null,
          source: "outlook",
          source_system: "outlook_email",
          document_type: "email",
          category: "correspondence",
        },
      ],
      "Section 08-1113 storefront requirements",
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      documentId: "spec-1",
      title: "08-1113 Hollow Metal Doors Specification",
      excerptCount: 1,
    });
    expect(matches[0]?.excerpts[0]).toContain("08-1113");
    expect(matches[0]?.excerpts[0]).toContain("storefront");
  });

  it("returns no matches when project documents do not look like specs", () => {
    const matches = findStoredSpecDocumentMatches(
      [
        {
          id: "doc-1",
          title: "Daily report",
          content: "Field crew completed punch list work.",
          raw_text: null,
          summary: null,
          overview: null,
          source: "reports",
          source_system: "manual_upload",
          document_type: "report",
          category: "daily_report",
        },
      ],
      "fire sprinkler pipe requirements",
    );

    expect(matches).toEqual([]);
  });
});
