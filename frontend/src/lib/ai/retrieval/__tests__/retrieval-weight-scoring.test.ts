import {
  computeHybridRetrievalScore,
  normalizeRetrievalWeightQuerySignature,
  retrievalRecallScore,
  retrievalRecencyScore,
  retrievalWeightMultiplierForItem,
  type RetrievalWeightScoringRow,
} from "../retrieval-weight-scoring";

function weight(
  overrides: Partial<RetrievalWeightScoringRow>,
): RetrievalWeightScoringRow {
  return {
    id: "weight-1",
    project_id: 983,
    tool_name: "semanticSearch",
    source_document_id: "doc-1",
    source_chunk_id: null,
    query_signature: "sprinkler delay risk",
    action: "boost",
    weight_multiplier: 1.25,
    confidence: 0.8,
    ...overrides,
  };
}

describe("retrieval weight scoring", () => {
  it("normalizes noisy retrieval queries into stable signatures", () => {
    expect(
      normalizeRetrievalWeightQuerySignature(
        "What is the latest SPRINKLER-delay risk for Project A?",
      ),
    ).toBe("what the latest sprinkler delay risk for project");
  });

  it("matches chunk weights before document weights", () => {
    const result = retrievalWeightMultiplierForItem(
      {
        sourceDocumentId: "doc-1",
        sourceChunkId: "chunk-7",
      },
      [
        weight({ id: "document-weight", weight_multiplier: 1.1 }),
        weight({
          id: "chunk-weight",
          source_chunk_id: "chunk-7",
          weight_multiplier: 1.2,
        }),
      ],
    );

    expect(result).toEqual({
      multiplier: 1.32,
      weightIds: ["document-weight", "chunk-weight"],
    });
  });

  it("bounds combined multipliers so learning cannot dominate retrieval", () => {
    const boosted = retrievalWeightMultiplierForItem(
      {
        sourceDocumentId: "doc-1",
        sourceChunkId: null,
      },
      [
        weight({ id: "boost-1", weight_multiplier: 2 }),
        weight({ id: "boost-2", weight_multiplier: 2 }),
      ],
    );

    const downranked = retrievalWeightMultiplierForItem(
      {
        sourceDocumentId: "doc-1",
        sourceChunkId: null,
      },
      [
        weight({ id: "downrank-1", weight_multiplier: 0.1 }),
        weight({ id: "downrank-2", weight_multiplier: 0.1 }),
      ],
    );

    expect(boosted.multiplier).toBe(1.5);
    expect(downranked.multiplier).toBe(0.65);
  });

  it("scores recency with a bounded exponential decay", () => {
    const nowMs = Date.UTC(2026, 5, 19);

    expect(retrievalRecencyScore("2026-06-19T00:00:00.000Z", nowMs)).toBeCloseTo(1);
    expect(retrievalRecencyScore("2025-12-21T00:00:00.000Z", nowMs)).toBeCloseTo(
      Math.exp(-180 / 180),
    );
    expect(retrievalRecencyScore("2020-01-01T00:00:00.000Z", nowMs)).toBe(0.1);
    expect(retrievalRecencyScore(null, nowMs)).toBe(0.5);
  });

  it("normalizes recall frequency without letting popularity dominate", () => {
    expect(retrievalRecallScore(0)).toBe(0);
    expect(retrievalRecallScore(1)).toBeGreaterThan(0);
    expect(retrievalRecallScore(10)).toBe(1);
    expect(retrievalRecallScore(100)).toBe(1);
  });

  it("blends vector, text, recall, and recency components for hybrid ranking", () => {
    const result = computeHybridRetrievalScore({
      vectorScore: 0.8,
      textScore: 0.5,
      recallCount: 2,
      lastRecalledAt: "2026-06-18T00:00:00.000Z",
      sourceTimestamp: "2026-06-19T00:00:00.000Z",
      nowMs: Date.UTC(2026, 5, 19),
    });

    expect(result.rankingMode).toBe("hybrid");
    expect(result.missingComponents).toEqual([]);
    expect(result.components.vectorScore).toBe(0.8);
    expect(result.components.textScore).toBe(0.5);
    expect(result.components.recallCount).toBe(2);
    expect(result.hybridScore).toBeCloseTo(
      0.8 * 0.65 + 0.5 * 0.2 + retrievalRecallScore(2) * 0.1 + 1 * 0.05,
    );
  });

  it("reports degraded hybrid mode when a required component is missing", () => {
    const result = computeHybridRetrievalScore({
      vectorScore: 0.8,
      textScore: null,
      recallCount: 0,
      sourceTimestamp: "2026-06-19T00:00:00.000Z",
      nowMs: Date.UTC(2026, 5, 19),
    });

    expect(result.rankingMode).toBe("degraded_hybrid");
    expect(result.missingComponents).toEqual(["textScore"]);
    expect(result.components.textScore).toBeNull();
    expect(result.hybridScore).toBeCloseTo(0.8 * 0.65 + 1 * 0.05);
  });
});
