import { buildMeetingLineageInventory } from "../lineage";

describe("buildMeetingLineageInventory", () => {
  it("keeps the lineage table order and marks present, empty, and error states", () => {
    const inventory = buildMeetingLineageInventory({
      document_metadata: { count: 1, error: null },
      meetings: { count: 1, error: null },
      meeting_segments: { count: 0, error: null },
      insight_cards: { count: 12, error: null },
      document_chunks: { count: 0, error: "RAG unavailable" },
    });

    expect(inventory[0]).toMatchObject({
      key: "document_metadata",
      status: "present",
      count: 1,
    });
    expect(inventory.find((row) => row.key === "meeting_segments")).toMatchObject(
      {
        status: "empty",
        count: 0,
      },
    );
    expect(inventory.find((row) => row.key === "insight_cards")).toMatchObject({
      status: "present",
      count: 12,
    });
    expect(inventory.at(-1)).toMatchObject({
      key: "document_chunks",
      status: "error",
      error: "RAG unavailable",
    });
  });
});
