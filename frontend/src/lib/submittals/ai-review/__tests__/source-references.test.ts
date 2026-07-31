import {
  buildPromptSourceCatalog,
  resolvePromptSourceKeys,
} from "../source-references";

describe("source references", () => {
  it("builds prompt source keys and resolves them back to references", () => {
    const catalog = buildPromptSourceCatalog([
      {
        sourceKey: "SUB-1",
        sourceType: "submittal_document",
        sourceId: "doc-1",
        documentMetadataId: "doc-1",
        drawingId: null,
        drawingNumber: null,
        pageNumber: null,
        chunkIndex: null,
        label: "Product data",
        excerpt: "Rated for 45 minutes",
        confidence: null,
      },
    ]);

    expect(catalog[0].promptBlock).toContain("SUB-1: Product data");
    expect(resolvePromptSourceKeys(["SUB-1"], catalog)).toHaveLength(1);
  });
});
