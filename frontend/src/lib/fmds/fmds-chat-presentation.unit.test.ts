import type { FmdsEvidenceSearchResult } from "./fmds-chat";
import {
  buildFmdsSourceRecords,
  renderFmdsEvidencePrompt,
} from "./fmds-chat-presentation";

const evidence: FmdsEvidenceSearchResult = {
  corpus: {
    documentCode: "FMDS0834",
    revisionId: "revision-2026",
    revisionLabel: "2026-04",
    revisionStatus: "staging",
  },
  coverage: { matchedChunks: 1, structuredMatches: 1, tables: 1, figures: 1 },
  chunks: [
    {
      id: "chunk-1",
      pageNumber: 31,
      citationLabel: "FMDS 8-34 p. 31",
      sectionPath: "2.2",
      clauseReference: null,
      content: "Use the applicable reviewed table.",
      similarity: 0.9,
      sourceType: "table",
      sourceId: "table-1",
      sourceIdentifier: "Table 1",
      reviewEventId: "review-1",
      candidateId: "candidate-1",
    },
  ],
  tables: [
    {
      id: "table-1",
      identifier: "Table 1",
      title: "Protection criteria",
      pageStart: 31,
      pageEnd: 31,
      caption: "Reviewed criteria",
      reviewStatus: "reviewed",
      reviewReason: "verified",
      matchSource: "structured_reviewed",
    },
  ],
  figures: [
    {
      id: "figure-1",
      identifier: "Figure 1",
      title: "Rack arrangement",
      pageNumber: 32,
      caption: "Rack layout",
      reviewStatus: "needs_review",
      reviewReason: "pending",
      matchSource: "page_context",
    },
  ],
  answerPolicy: {
    calculationAuthority: "reviewed_evaluator_only",
    unreviewedEvidenceStatus: "pending_review",
  },
};

describe("FMDS chat presentation", () => {
  it("pins the prompt to one corpus revision and preserves review policy", () => {
    const prompt = renderFmdsEvidencePrompt(evidence);
    expect(prompt).toContain("FMDS0834, 2026-04, staging");
    expect(prompt).toContain("Never combine this revision");
    expect(prompt).toContain("needs_review evidence as Pending Review");
  });

  it("links structured sources to the dedicated ASRS workspace", () => {
    const sources = buildFmdsSourceRecords(evidence);
    expect(sources[0]?.metadata.url).toBe("/asrs/tables/table-1");
    expect(sources[1]?.metadata.url).toBe("/asrs/figures/figure-1");
    expect(sources[0]?.metadata.corpus_revision_id).toBe("revision-2026");
  });
});
