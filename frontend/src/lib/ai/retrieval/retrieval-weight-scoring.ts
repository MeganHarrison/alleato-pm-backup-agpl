export type RetrievalWeightScoringRow = {
  id: string;
  project_id: number | null;
  tool_name: string;
  source_document_id: string | null;
  source_chunk_id: string | null;
  query_signature: string;
  action: "boost" | "downrank_review";
  weight_multiplier: number;
  confidence: number;
};

export type HybridRetrievalScoreInput = {
  vectorScore: number | null | undefined;
  textScore?: number | null;
  recallCount?: number | null;
  lastRecalledAt?: string | null;
  sourceTimestamp?: string | null;
  nowMs?: number;
};

export type HybridRetrievalScoreResult = {
  rankingMode: "hybrid" | "degraded_hybrid";
  hybridScore: number;
  components: {
    vectorScore: number;
    textScore: number | null;
    recallScore: number;
    recencyScore: number;
    recallCount: number;
    lastRecalledAt: string | null;
  };
  missingComponents: string[];
};

export const HYBRID_RETRIEVAL_WEIGHTS = {
  vector: 0.65,
  text: 0.2,
  recall: 0.1,
  recency: 0.05,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENCY_HALF_LIFE_DAYS = 180;

export function normalizeRetrievalWeightQuerySignature(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((word) => word.length > 2)
    .slice(0, 10)
    .join(" ");
}

export function retrievalRecencyScore(
  sourceTimestamp: string | null | undefined,
  nowMs = Date.now(),
): number {
  if (!sourceTimestamp) return 0.5;
  const sourceMs = new Date(sourceTimestamp).getTime();
  if (!Number.isFinite(sourceMs)) return 0.5;

  const ageDays = Math.max(0, (nowMs - sourceMs) / DAY_MS);
  return Math.max(0.1, Math.exp(-ageDays / RECENCY_HALF_LIFE_DAYS));
}

export function retrievalRecallScore(recallCount: number | null | undefined): number {
  const boundedCount = Math.max(0, Number(recallCount) || 0);
  return Math.min(1, Math.log1p(boundedCount) / Math.log(11));
}

export function computeHybridRetrievalScore(
  input: HybridRetrievalScoreInput,
): HybridRetrievalScoreResult {
  const vectorScore = Number(input.vectorScore);
  const textScore =
    input.textScore === null || input.textScore === undefined
      ? null
      : Number(input.textScore);
  const recallCount = Math.max(0, Number(input.recallCount) || 0);
  const missingComponents: string[] = [];

  if (!Number.isFinite(vectorScore)) missingComponents.push("vectorScore");
  if (textScore === null || !Number.isFinite(textScore)) {
    missingComponents.push("textScore");
  }

  const safeVectorScore = Number.isFinite(vectorScore) ? vectorScore : 0;
  const safeTextScore = textScore !== null && Number.isFinite(textScore) ? textScore : 0;
  const recallScore = retrievalRecallScore(recallCount);
  const recencyScore = retrievalRecencyScore(input.sourceTimestamp, input.nowMs);
  const rankingMode = missingComponents.length === 0 ? "hybrid" : "degraded_hybrid";

  return {
    rankingMode,
    hybridScore:
      safeVectorScore * HYBRID_RETRIEVAL_WEIGHTS.vector +
      safeTextScore * HYBRID_RETRIEVAL_WEIGHTS.text +
      recallScore * HYBRID_RETRIEVAL_WEIGHTS.recall +
      recencyScore * HYBRID_RETRIEVAL_WEIGHTS.recency,
    components: {
      vectorScore: safeVectorScore,
      textScore: textScore !== null && Number.isFinite(textScore) ? textScore : null,
      recallScore,
      recencyScore,
      recallCount,
      lastRecalledAt: input.lastRecalledAt ?? null,
    },
    missingComponents,
  };
}

export function retrievalWeightMultiplierForItem(
  item: {
    sourceDocumentId: string | null;
    sourceChunkId: string | null;
  },
  weights: RetrievalWeightScoringRow[],
): { multiplier: number; weightIds: string[] } {
  const matching = weights.filter((weight) => {
    if (weight.source_chunk_id && item.sourceChunkId) {
      return weight.source_chunk_id === item.sourceChunkId;
    }
    if (weight.source_document_id && item.sourceDocumentId) {
      return weight.source_document_id === item.sourceDocumentId;
    }
    return false;
  });

  if (matching.length === 0) {
    return { multiplier: 1, weightIds: [] };
  }

  const multiplier = matching.reduce((current, weight) => {
    const bounded = Math.min(1.5, Math.max(0.65, Number(weight.weight_multiplier) || 1));
    return current * bounded;
  }, 1);

  return {
    multiplier: Math.min(1.5, Math.max(0.65, multiplier)),
    weightIds: matching.map((weight) => weight.id),
  };
}
