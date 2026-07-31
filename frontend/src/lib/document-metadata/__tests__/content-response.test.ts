import {
  buildDocumentContentResponse,
  joinChunkText,
  normalizeDocumentText,
} from "../content-response";

describe("document metadata content response helpers", () => {
  it("normalizes blank content to null", () => {
    expect(normalizeDocumentText("  \n\t ")).toBeNull();
    expect(normalizeDocumentText(" Teams update ")).toBe("Teams update");
  });

  it("joins chunk text in chunk index order", () => {
    expect(
      joinChunkText([
        { chunk_index: 2, text: "Second" },
        { chunk_index: 1, text: "First" },
        { chunk_index: 3, text: " " },
      ]),
    ).toBe("First\n\nSecond");
  });

  it("returns an explicit unavailable reason when all checked sources are empty", () => {
    const response = buildDocumentContentResponse({
      id: "teamsdm_example_2026-06-22",
      content: null,
      contentSource: null,
      checkedSources: [
        "document_metadata.content",
        "rag_document_metadata.content",
        "document_chunks.text",
      ],
    });

    expect(response.content).toBeNull();
    expect(response.contentSource).toBeNull();
    expect(response.unavailableReason).toContain("document_metadata.content");
    expect(response.unavailableReason).toContain("document_chunks.text");
  });
});
