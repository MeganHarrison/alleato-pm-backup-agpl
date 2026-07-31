/**
 * Unified RAG document retrieval layer.
 *
 * This module owns the entire "embed query → call search_document_chunks → normalize rows"
 * flow. All RAG retrieval goes through here so:
 * - Embedding encoding is decided in ONE place (JSON string, never raw array)
 * - RPC args (thresholds, counts, filters) are consolidated
 * - Error handling is loud (no silent fallbacks)
 * - Row normalization is consistent
 *
 * This design prevents encoding mismatches and makes retrieval contract violations
 * observable at compile time (one interface, all callers).
 *
 * GUARDRAIL: The `ValidatedEmbedding` branded type ensures only generateEmbedding-produced
 * JSON strings can be passed to the RPC. Raw arrays are type errors at compile time.
 * This prevents the 2026-05-13 incident where searchDocumentChunksByCategory passed
 * a raw number[] array, causing silent RPC failures.
 */

import * as Sentry from "@sentry/nextjs";
import { OpenAI } from "@ai-sdk/openai";
import { generateEmbedding, EMBEDDING } from "@/lib/ai/tools/tool-utils";
import {
  createRagServiceClient,
  type ServiceClientReturnType,
} from "@/lib/supabase/service";
import { filterLeadershipRestrictedChunks } from "@/lib/ai/leadership-restriction";

/**
 * Branded type for validated embedding strings.
 * Only generateEmbedding-produced JSON strings can be cast to this type.
 * Prevents raw array encoding bugs at compile time.
 *
 * @example
 * // ✅ Correct: generateEmbedding returns ValidatedEmbedding
 * const embedding = await generateEmbedding(openai, query, EMBEDDING.LARGE);
 * await retrieveChunks({ query, openai, queryEmbedding: embedding });
 *
 * // ❌ Type error: raw arrays cannot be cast to ValidatedEmbedding
 * const rawArray = await openai.embeddings.create({ ... });
 * await retrieveChunks({ queryEmbedding: rawArray.data[0].embedding }); // TS2345
 */
export type ValidatedEmbedding = string & { readonly __validated: true };

export type RagRow = {
  id?: string;
  chunk_text?: string;
  doc_title?: string;
  doc_metadata?: Record<string, unknown>;
  similarity?: number;
  document_id?: string;
};

export interface RetrieveChunksOptions {
  /** Query text to embed and search for */
  query: string;

  /** OpenAI client (required for embedding generation) */
  openai: OpenAI;

  /** Optional: Supabase RAG client. If not provided, creates one. */
  ragClient?: ServiceClientReturnType;

  /** Optional: Project ID to scope search to this project */
  projectId?: number | null;

  /** Optional: Filter to specific source types (e.g., ["email", "teams_dm"]) */
  sourceTypes?: string[] | null;

  /** Optional: Max number of chunks to return (default: 10) */
  matchCount?: number;

  /** Optional: Similarity threshold, 0–1 (default: 0.45) */
  matchThreshold?: number;

  /** Optional: Enable hybrid ranking (vector + BM25) */
  hybridRankingEnabled?: boolean;

  /** Optional: Enable retrieval telemetry */
  telemetryEnabled?: boolean;

  /** Optional: Label for error messages */
  errorLabel?: string;

  /**
   * Include leadership-restricted chunks (Annual Review meetings).
   * DEFAULT FALSE — the RAG DB is reached via service role, so this filter is
   * the only access control on chunks. Pass ToolScope.isLeadership here; never
   * hardcode true.
   */
  includeLeadershipRestricted?: boolean;
}

/**
 * Retrieve RAG document chunks for a query.
 *
 * Handles all retrieval details: embedding generation (stringified JSON),
 * RPC args normalization, error handling, row return.
 *
 * @param opts Retrieval options
 * @returns Array of matching chunks
 * @throws Error if retrieval fails (never silent)
 */
export async function retrieveChunks(opts: RetrieveChunksOptions): Promise<RagRow[]> {
  const {
    query,
    openai,
    ragClient: providedRagClient,
    projectId,
    sourceTypes,
    matchCount = 10,
    matchThreshold = 0.45,
    hybridRankingEnabled = false,
    telemetryEnabled = false,
    errorLabel = "Document retrieval",
    includeLeadershipRestricted = false,
  } = opts;

  try {
    // Generate embedding via the canonical helper (returns JSON-stringified vector)
    let queryEmbedding: string;
    try {
      queryEmbedding = await generateEmbedding(openai, query, EMBEDDING.LARGE);
    } catch (embeddingErr) {
      const embeddingError = embeddingErr instanceof Error ? embeddingErr : new Error(String(embeddingErr));
      Sentry.captureException(embeddingError, {
        level: "error",
        tags: {
          component: "retrieve-chunks",
          stage: "embedding-generation",
        },
        contexts: {
          retrieval: {
            query_length: query.length,
            source_types: sourceTypes?.join(","),
            project_id: projectId,
            error_label: errorLabel,
          },
        },
      });
      throw embeddingError;
    }

    // Use provided client or create one
    const ragClient = providedRagClient ?? createRagServiceClient();

    // Call the RPC with all standardized args
    const { data, error } = await ragClient.rpc("search_document_chunks", {
      query_embedding: queryEmbedding, // Always a JSON string from generateEmbedding
      filter_source_types: sourceTypes ?? undefined,
      filter_project_id: typeof projectId === "number" ? projectId : undefined,
      match_count: matchCount,
      match_threshold: matchThreshold,
      ...(hybridRankingEnabled && {
        ranking_mode: "hybrid",
        query_text: query,
      }),
      ...(telemetryEnabled && {
        telemetry_enabled: true,
      }),
    });

    // Error handling: always loud, never silent
    if (error) {
      const message = (error as { message?: string }).message || String(error);
      const rpcError = new Error(`${errorLabel}: ${message}`);
      Sentry.captureException(rpcError, {
        level: "error",
        tags: {
          component: "retrieve-chunks",
          stage: "rpc-search",
          source_types: sourceTypes?.join(",") || "unfiltered",
        },
        contexts: {
          retrieval: {
            query_length: query.length,
            source_types: sourceTypes?.join(","),
            project_id: projectId,
            match_count: matchCount,
            match_threshold: matchThreshold,
            hybrid_ranking: hybridRankingEnabled,
            error_label: errorLabel,
            rpc_error_message: message,
          },
        },
      });
      throw rpcError;
    }

    // Leadership-restricted chunks (Annual Review meetings) are dropped by
    // default — the service-role RAG client bypasses RLS, so this post-filter
    // is the access control for chunks.
    return filterLeadershipRestrictedChunks(
      (data ?? []) as RagRow[],
      includeLeadershipRestricted,
    );
  } catch (err) {
    // Re-throw to maintain loud error behavior
    throw err;
  }
}

/**
 * Specialized retrieval for category-scoped searches (e.g., emails, Teams, meetings).
 *
 * Used by the assistant's category document search tool to retrieve chunks
 * for a specific content type with consistent defaults.
 */
export async function retrieveChunksByCategory(opts: {
  query: string;
  openai: OpenAI;
  ragClient?: ServiceClientReturnType;
  projectId?: number | null;
  sourceTypes?: string[] | null;
  matchCount?: number;
  errorLabel?: string;
}): Promise<RagRow[]> {
  return retrieveChunks({
    ...opts,
    matchThreshold: 0.45, // Category search threshold
    matchCount: opts.matchCount ?? 10,
  });
}
