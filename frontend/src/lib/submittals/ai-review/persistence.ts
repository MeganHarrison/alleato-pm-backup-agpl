import type { SubmittalAIReviewReadinessLayer } from "./schemas";

export type StoredReadiness = {
  state: "ready" | "partial" | "not_ready" | "failed";
  summary: string;
  layers: SubmittalAIReviewReadinessLayer[];
};

export type StoredSourceCoverage = {
  submittalDocumentCount: number;
  linkedDrawingCount: number;
  ragChunkCount: number;
  specSourceCount: number;
};

export function normalizeReviewRunTimestamp(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return null;
}

function defaultReadinessForStatus(
  status: string,
  errorMessage?: string | null,
): StoredReadiness {
  if (status === "running") {
    return {
      state: "partial",
      summary: "Review run is still assembling source context and findings.",
      layers: [],
    };
  }

  if (status === "queued") {
    return {
      state: "partial",
      summary: "Review run is queued and has not started yet.",
      layers: [],
    };
  }

  if (status === "failed") {
    return {
      state: "failed",
      summary: errorMessage?.trim() || "Review run failed before completion.",
      layers: [],
    };
  }

  return {
    state: "not_ready",
    summary: "Stored review run is missing readiness details.",
    layers: [],
  };
}

export function normalizeStoredReadiness(
  rawReadiness: unknown,
  status: string,
  errorMessage?: string | null,
): StoredReadiness {
  const candidate =
    rawReadiness && typeof rawReadiness === "object"
      ? (rawReadiness as Partial<StoredReadiness>)
      : null;

  if (
    candidate &&
    (candidate.state === "ready" ||
      candidate.state === "partial" ||
      candidate.state === "not_ready" ||
      candidate.state === "failed") &&
    typeof candidate.summary === "string" &&
    Array.isArray(candidate.layers)
  ) {
    return {
      state: candidate.state,
      summary: candidate.summary,
      layers: candidate.layers,
    };
  }

  return defaultReadinessForStatus(status, errorMessage);
}

export function normalizeStoredSourceCoverage(
  rawSourceCoverage: unknown,
): StoredSourceCoverage {
  const candidate =
    rawSourceCoverage && typeof rawSourceCoverage === "object"
      ? (rawSourceCoverage as Partial<StoredSourceCoverage>)
      : null;

  return {
    submittalDocumentCount:
      typeof candidate?.submittalDocumentCount === "number"
        ? candidate.submittalDocumentCount
        : 0,
    linkedDrawingCount:
      typeof candidate?.linkedDrawingCount === "number"
        ? candidate.linkedDrawingCount
        : 0,
    ragChunkCount:
      typeof candidate?.ragChunkCount === "number"
        ? candidate.ragChunkCount
        : 0,
    specSourceCount:
      typeof candidate?.specSourceCount === "number"
        ? candidate.specSourceCount
        : 0,
  };
}
