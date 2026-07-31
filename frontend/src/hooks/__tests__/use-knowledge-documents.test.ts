import { normalizeKnowledgeDocumentTags } from "../use-knowledge-documents";

describe("normalizeKnowledgeDocumentTags", () => {
  it("keeps API array tags as a cleaned array", () => {
    expect(normalizeKnowledgeDocumentTags([" Field Operations ", "safety", ""])).toEqual([
      "Field Operations",
      "safety",
    ]);
  });

  it("normalizes legacy delimiter strings before UI components render them", () => {
    expect(normalizeKnowledgeDocumentTags("Contracts, templates; closeout")).toEqual([
      "Contracts",
      "templates",
      "closeout",
    ]);
  });

  it("returns null for empty tag values", () => {
    expect(normalizeKnowledgeDocumentTags(null)).toBeNull();
    expect(normalizeKnowledgeDocumentTags(" , ; ")).toBeNull();
  });
});
