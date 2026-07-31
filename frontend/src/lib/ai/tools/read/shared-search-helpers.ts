/**
 * Shared helpers for category-based document chunk search.
 *
 * Used by email-search-tools, communication-search-tools, and
 * project-data-tools (findProject). Extracted here to avoid duplication
 * across domain modules.
 */

import { createRagServiceClient, createServiceClient } from "@/lib/supabase/service";
import {
  isCommunicationSourceAllowed,
  isDocumentScopeAllowed,
  readDocumentBusinessAreaScope,
  resolveCommunicationSourceType,
  type ToolGuardrails,
} from "../guardrails";
import { retrieveChunks } from "@/lib/ai/retrieval/retrieve-chunks";
import { withoutLeadershipRestricted } from "@/lib/ai/leadership-restriction";
import { getOpenAI } from "../tool-utils";
import { type AnyRow } from "../types";

function sourceTypesForCategory(category: string) {
  switch (category) {
    case "email":
      return ["email"];
    case "teams_message":
      return ["teams_channel", "teams_dm"];
    case "document":
      return ["document", "onedrive_document"];
    default:
      return null;
  }
}

type ChunkResultRow = {
  doc_title: string | null;
  doc_date: string | null;
  doc_created_at: string | null;
  doc_participants?: string | null;
  doc_source: string | null;
};

function formatCitation(sourceLabel: string, r: ChunkResultRow): string {
  const date = r.doc_date ?? r.doc_created_at;
  const dateStr = date
    ? new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  if (sourceLabel === "email") {
    const parts = [
      r.doc_participants ? `from ${r.doc_participants}` : null,
      dateStr,
    ].filter(Boolean);
    return `Email${parts.length ? " " + parts.join(", ") : ""}: "${r.doc_title ?? "untitled"}"`;
  }

  if (sourceLabel === "Teams message") {
    const parts = [r.doc_source ? `in ${r.doc_source}` : null, dateStr].filter(
      Boolean,
    );
    return `Teams message${parts.length ? " " + parts.join(", ") : ""}: "${r.doc_title ?? "untitled"}"`;
  }

  // document
  return `Document: "${r.doc_title ?? "untitled"}"${dateStr ? ` (${dateStr})` : ""}`;
}

function normalizeSearchTerms(query: string): string[] {
  const ignored = new Set([
    "about",
    "action",
    "actions",
    "and",
    "current",
    "facts",
    "for",
    "give",
    "hard",
    "including",
    "latest",
    "next",
    "open",
    "project",
    "recommended",
    "risks",
    "the",
    "update",
  ]);

  return (query.match(/\b[A-Za-z][A-Za-z0-9'-]{2,}\b/g) ?? [])
    .map((term) => term.toLowerCase())
    .filter((term) => !ignored.has(term))
    .slice(0, 12);
}

export async function searchDocumentChunksByCategory({
  supabase,
  metadataSupabase,
  query,
  category,
  matchCount,
  sourceLabel,
  scope,
  filterProjectId,
}: {
  supabase: ReturnType<typeof createRagServiceClient>;
  metadataSupabase: ReturnType<typeof createServiceClient>;
  query: string;
  category: string;
  matchCount: number;
  sourceLabel: string;
  scope: Awaited<ReturnType<ToolGuardrails["getScope"]>>;
  filterProjectId?: number | null;
}) {
  try {
    const data = await retrieveChunks({
      query,
      openai: getOpenAI(),
      ragClient: supabase,
      projectId:
        typeof filterProjectId === "number"
          ? filterProjectId
          : (scope.pinnedProjectId ?? undefined),
      sourceTypes: sourceTypesForCategory(category) ?? undefined,
      matchCount,
      matchThreshold: 0.45,
      errorLabel: `Category search (${sourceLabel})`,
      includeLeadershipRestricted: scope.isLeadership,
    });

    const isEmptyResult = !data || data.length === 0;
    if (isEmptyResult) {
      // Log the empty retrieval so degradation is visible
      console.warn(
        `[searchDocumentChunksByCategory] zero results for category '${category}' after successful RPC`,
        { query, matchCount },
      );
    }

    type ChunkRow = {
      chunk_id: string;
      document_id: string;
      chunk_index: number;
      chunk_text: string;
      source_type: string | null;
      similarity: number;
      doc_title: string | null;
      doc_category: string | null;
      doc_source: string | null;
      doc_date: string | null;
      doc_participants?: string | null;
      doc_project_id: number | null;
      doc_metadata: Record<string, unknown> | null;
      doc_created_at: string | null;
    };

    let rows = (data ?? []) as ChunkRow[];
    const requestedProjectId =
      typeof filterProjectId === "number"
        ? filterProjectId
        : scope.pinnedProjectId;

    if (!scope.isAdmin) {
      if (
        scope.allowedProjectIds.length === 0 &&
        scope.allowedBusinessAreaIds.length === 0
      ) {
        return {
          results: [],
          error:
            "You do not have access to any projects or Alleato Brain branches in the current database scope, so I cannot search documents safely.",
        };
      }
    }

    rows = rows.filter((row) => {
      const businessAreaScope = readDocumentBusinessAreaScope(
        row.doc_metadata,
      );
      if (businessAreaScope.kind === "invalid") {
        console.error(
          "[searchDocumentChunksByCategory] rejected malformed Business Area scope",
          {
            chunkId: row.chunk_id,
            documentId: row.document_id,
            rawBusinessAreaId: businessAreaScope.rawValue,
          },
        );
      }
      return (
        isDocumentScopeAllowed({
          scope,
          projectId: row.doc_project_id,
          metadata: row.doc_metadata,
          requestedProjectId,
        }) &&
        isCommunicationSourceAllowed({
          scope,
          sourceType: resolveCommunicationSourceType({
            category: row.doc_category ?? category,
            sourceType: row.source_type,
          }),
          metadata: row.doc_metadata,
        })
      );
    });

    if (rows.length === 0) {
      return {
        results: [],
        message: `No ${sourceLabel}s found for "${query}". The sync may not have run yet, or no matching content exists.`,
      };
    }

    // Deduplicate by document_id — take best-scoring chunk per document
    const bestByDoc = new Map<string, ChunkRow>();
    for (const row of rows) {
      const existing = bestByDoc.get(row.document_id);
      if (!existing || row.similarity > existing.similarity) {
        bestByDoc.set(row.document_id, row);
      }
    }

    const results = Array.from(bestByDoc.values())
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, matchCount);

    return {
      query,
      sourceType: sourceLabel,
      resultCount: results.length,
      results: results.map((r) => {
        const businessAreaScope = readDocumentBusinessAreaScope(
          r.doc_metadata,
        );
        return {
          title: r.doc_title ?? "(untitled)",
          content: r.chunk_text.substring(0, 2000),
          similarity: Math.round(r.similarity * 1000) / 1000,
          date: r.doc_date ?? r.doc_created_at,
          participants:
            typeof r.doc_metadata?.participants === "string"
              ? r.doc_metadata.participants
              : null,
          source: r.doc_source,
          type: r.doc_category ?? r.source_type,
          projectId: r.doc_project_id,
          businessAreaId:
            businessAreaScope.kind === "valid"
              ? businessAreaScope.businessAreaId
              : null,
          documentId: r.document_id,
          sourceDocumentId: r.document_id,
          sourceChunkId: r.chunk_id,
          chunkIndex: r.chunk_index,
          // Pre-formatted citation for the model to use directly
          citation: formatCitation(sourceLabel, r),
        };
      }),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return {
      error: `${sourceLabel} search failed: ${msg}`,
    };
  }
}

export async function searchDocumentChunksByCategoryFallback({
  supabase,
  metadataSupabase,
  query,
  category,
  matchCount,
  sourceLabel,
  scope,
  filterProjectId,
  rpcError,
}: {
  supabase: ReturnType<typeof createRagServiceClient>;
  metadataSupabase: ReturnType<typeof createServiceClient>;
  query: string;
  category: string;
  matchCount: number;
  sourceLabel: string;
  scope: Awaited<ReturnType<ToolGuardrails["getScope"]>>;
  filterProjectId?: number | null;
  rpcError: string;
}) {
  const effectiveProjectId =
    typeof filterProjectId === "number"
      ? filterProjectId
      : (scope.pinnedProjectId ?? null);

  if (
    !scope.isAdmin &&
    scope.allowedProjectIds.length === 0 &&
    scope.allowedBusinessAreaIds.length === 0
  ) {
    return {
      results: [],
      error:
        "You do not have access to any projects or Alleato Brain branches in the current database scope, so I cannot search documents safely.",
    };
  }

  let docsQuery = withoutLeadershipRestricted(
    metadataSupabase
    .from("document_metadata")
    .select(
      "id, title, category, source, type, date, participants, tags, project_id, business_area_id, created_at",
      )
      .eq("category", category),
    scope.isLeadership,
  ).limit(200);

  if (typeof effectiveProjectId === "number") {
    docsQuery = docsQuery.eq("project_id", effectiveProjectId);
  }

  const { data: docRows, error: docsError } = await docsQuery;
  if (docsError) {
    return {
      error: `${sourceLabel} fallback search failed after RPC mismatch (${rpcError}): ${docsError.message}`,
    };
  }

  const docs = ((docRows ?? []) as AnyRow[]).filter((doc) => {
    const metadata = { business_area_id: doc.business_area_id };
    const businessAreaScope = readDocumentBusinessAreaScope(metadata);
    if (businessAreaScope.kind === "invalid") {
      console.error(
        "[searchDocumentChunksByCategoryFallback] rejected malformed Business Area scope",
        {
          documentId: doc.id,
          rawBusinessAreaId: businessAreaScope.rawValue,
        },
      );
    }
    return (
      isDocumentScopeAllowed({
        scope,
        projectId: doc.project_id,
        metadata,
        requestedProjectId: effectiveProjectId,
      }) &&
      isCommunicationSourceAllowed({
        scope,
        sourceType: resolveCommunicationSourceType({
          category: doc.category ?? category,
          sourceType: doc.type,
        }),
        metadata,
      })
    );
  });

  if (docs.length === 0) {
    return {
      query,
      sourceType: sourceLabel,
      resultCount: 0,
      fallback: true,
      rpcError,
      results: [],
      message: `No ${sourceLabel}s found for "${query}" in the fallback document search.`,
    };
  }

  const documentIds = docs
    .map((doc) => doc.id)
    .filter((id): id is string => typeof id === "string")
    .slice(0, 40);
  const docsById = new Map(
    documentIds.map((id) => [id, docs.find((doc) => doc.id === id)]),
  );

  const { data: chunkRows, error: chunksError } = await supabase
    .from("document_chunks")
    .select("chunk_id, document_id, chunk_index, text, metadata")
    .in("document_id", documentIds)
    .limit(500);

  if (chunksError) {
    return {
      error: `${sourceLabel} fallback search failed after RPC mismatch (${rpcError}): ${chunksError.message}`,
    };
  }

  const queryTerms = normalizeSearchTerms(query);
  const ranked = ((chunkRows ?? []) as AnyRow[])
    .map((chunk) => {
      const doc = docsById.get(String(chunk.document_id));
      const haystack = [doc?.title, doc?.source, chunk.text]
        .join(" ")
        .toLowerCase();
      const score = queryTerms.reduce(
        (total, term) => total + (haystack.includes(term) ? 1 : 0),
        0,
      );

      return { chunk, doc, score };
    })
    .filter((row) => row.doc && row.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aDate =
        typeof a.doc?.date === "string" ? Date.parse(a.doc.date) : 0;
      const bDate =
        typeof b.doc?.date === "string" ? Date.parse(b.doc.date) : 0;
      return bDate - aDate;
    })
    .slice(0, matchCount);

  return {
    query,
    sourceType: sourceLabel,
    resultCount: ranked.length,
    fallback: true,
    rpcError,
    results: ranked.map(({ chunk, doc }) => ({
      title: String(doc?.title ?? "(untitled)"),
      content: String(chunk.text ?? "").substring(0, 2000),
      similarity: null,
      date: doc?.date ?? doc?.created_at ?? null,
      participants: doc?.participants ?? null,
      source: doc?.source ?? null,
      type: doc?.type ?? null,
      projectId: doc?.project_id ?? null,
      businessAreaId: doc?.business_area_id ?? null,
      documentId: String(chunk.document_id ?? ""),
      sourceDocumentId: String(chunk.document_id ?? ""),
      sourceChunkId: String(chunk.chunk_id ?? ""),
      chunkIndex:
        typeof chunk.chunk_index === "number" ? chunk.chunk_index : null,
      citation: formatCitation(sourceLabel, {
        doc_title: typeof doc?.title === "string" ? doc.title : null,
        doc_date: typeof doc?.date === "string" ? doc.date : null,
        doc_created_at:
          typeof doc?.created_at === "string" ? doc.created_at : null,
        doc_participants:
          typeof doc?.participants === "string" ? doc.participants : null,
        doc_source: typeof doc?.source === "string" ? doc.source : null,
      }),
    })),
  };
}
