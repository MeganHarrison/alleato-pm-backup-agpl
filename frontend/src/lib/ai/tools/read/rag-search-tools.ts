import { tool } from "ai";
import { z } from "zod";
import {
  asNumber,
  resolveProject,
  withTrace as _withTrace,
  generateEmbedding,
  EMBEDDING,
  isBriefingQuery,
  rerankWithLLM,
  rankBriefingSourcePriority,
} from "../tool-utils";
import {
  semanticSearchDescription,
  semanticSearchInputSchema,
} from "@/lib/ai/tool-descriptors";
import {
  computeHybridRetrievalScore,
  normalizeRetrievalWeightQuerySignature,
  retrievalWeightMultiplierForItem,
  type RetrievalWeightScoringRow,
} from "@/lib/ai/retrieval/retrieval-weight-scoring";
import type {
  OperationalToolInternals,
  CreateOperationalToolsOptions,
} from "./operational-internals";
import { type AnyRow } from "../types";
import { createServiceClient } from "@/lib/supabase/service";
import { isLeadershipRestrictedChunkMetadata } from "@/lib/ai/leadership-restriction";
import {
  isCommunicationSourceAllowed,
  isDocumentScopeAllowed,
  readDocumentBusinessAreaScope,
  resolveCommunicationSourceType,
} from "../guardrails";

const HYBRID_RAG_RANKING_ENABLED =
  process.env.RAG_HYBRID_RANKING_ENABLED === "true";
const RAG_RETRIEVAL_TELEMETRY_ENABLED =
  process.env.RAG_RETRIEVAL_TELEMETRY_ENABLED === "true";

function withTrace<TInput extends Record<string, unknown>, TResult>(
  name: string,
  options: CreateOperationalToolsOptions,
  execute: (input: TInput) => Promise<TResult>,
) {
  return _withTrace(
    name,
    options,
    execute,
    "This operational knowledge source failed during retrieval. Explain the gap plainly and use other available sources before asking for more detail.",
  );
}

async function loadActiveRetrievalWeights({
  supabase,
  toolName,
  query,
  projectId,
}: {
  supabase: ReturnType<typeof createServiceClient>;
  toolName: string;
  query: string;
  projectId?: number;
}): Promise<RetrievalWeightScoringRow[]> {
  const querySignature = normalizeRetrievalWeightQuerySignature(query);
  if (!querySignature) return [];

  const { data, error } = await supabase
    .from("ai_retrieval_weights")
    .select(
      "id, project_id, tool_name, source_document_id, source_chunk_id, query_signature, action, weight_multiplier, confidence",
    )
    .eq("status", "active")
    .eq("tool_name", toolName)
    .eq("query_signature", querySignature)
    .limit(50);

  if (error) {
    throw new Error(
      `Failed to load retrieval weights for ${toolName}: ${error.message}`,
    );
  }

  return ((data ?? []) as RetrievalWeightScoringRow[]).filter(
    (weight) =>
      weight.project_id === null || weight.project_id === (projectId ?? null),
  );
}

export function createRagSearchReadTools(internals: OperationalToolInternals) {
  const { options, ctx, supabase, ragSupabase, guardrails } = internals;

  return {
    // -----------------------------------------------------------------------
    // 9. Semantic Search (unified document_chunks + insights + knowledge base)
    // -----------------------------------------------------------------------
    semanticSearch: tool({
      description: semanticSearchDescription,
      inputSchema: semanticSearchInputSchema,
      execute: withTrace(
        "semanticSearch",
        options,
        async ({ query, projectId, projectName, businessAreaId, limit }) => {
          const scope = await guardrails.getScope();
          const allowedProjectIds = scope.allowedProjectIds;
          const allowedProjectIdSet = new Set<number>(allowedProjectIds);
          // Resolve project name to ID if provided
          let resolvedProjectId = projectId;
          if (
            typeof businessAreaId === "number" &&
            (typeof projectId === "number" ||
              Boolean(projectName) ||
              typeof scope.pinnedProjectId === "number")
          ) {
            return {
              error:
                "Choose either a project or an Alleato Brain branch for semantic search, not both.",
            };
          }
          if (!resolvedProjectId && projectName) {
            const resolved = await resolveProject(
              supabase,
              guardrails,
              undefined,
              projectName,
            );
            if (!("error" in resolved)) {
              resolvedProjectId = resolved.id;
            }
            // If project name doesn't resolve, still search across all projects
          }

          if (typeof businessAreaId === "number") {
            const access =
              await guardrails.enforceBusinessAreaAccess(businessAreaId);
            if (!access.ok) {
              return { error: access.error };
            }
          }

          if (!scope.isAdmin) {
            if (
              allowedProjectIds.length === 0 &&
              scope.allowedBusinessAreaIds.length === 0
            ) {
              return {
                error:
                  "You do not have access to any projects or Alleato Brain branches in the current database scope, so I cannot run semantic search safely.",
              };
            }
            if (
              typeof resolvedProjectId === "number" &&
              !allowedProjectIdSet.has(resolvedProjectId)
            ) {
              return {
                error:
                  "You do not have access to that project. Pick a project you are assigned to or change the project context.",
              };
            }
          }
          try {
            // All active RAG tables use halfvec(3072) — single embedding generation.
            const openai = ctx.openai;
            const embeddingArg3072 = await generateEmbedding(
              openai,
              query,
              EMBEDDING.LARGE,
            );
            const briefing = isBriefingQuery(query);
            // Briefing queries cast a wider net (more candidates, lower threshold) so the
            // LLM reranker has recent comms to surface. Non-briefing queries use tighter defaults.
            const targetCount = limit;
            const targetThreshold = briefing ? 0.2 : 0.3;
            // Chunks use even broader recall — reranker filters out noise
            const chunkCount = targetCount * 2;
            const chunkThreshold = Math.min(
              targetThreshold,
              briefing ? 0.15 : 0.25,
            );
            const querySignature =
              normalizeRetrievalWeightQuerySignature(query);

            // Blended retrieval — all halfvec(3072):
            // search_document_chunks   → unified: meetings, emails, Teams, OneDrive, transcripts
            // search_all_knowledge     → insights (decisions/risks/opportunities)
            const [chunksRes, knowledgeRes] = await Promise.all([
              ragSupabase.rpc("search_document_chunks", {
                query_embedding: embeddingArg3072,
                filter_source_types: undefined,
                filter_project_id: resolvedProjectId ?? undefined,
                ...(typeof businessAreaId === "number" && {
                  filter_business_area_id: businessAreaId,
                }),
                match_count: chunkCount,
                match_threshold: chunkThreshold,
                ranking_mode: HYBRID_RAG_RANKING_ENABLED ? "hybrid" : "vector",
                query_text: HYBRID_RAG_RANKING_ENABLED ? query : undefined,
                telemetry_enabled: RAG_RETRIEVAL_TELEMETRY_ENABLED,
                query_signature: querySignature || undefined,
              }),
              supabase.rpc("search_all_knowledge", {
                query_embedding: embeddingArg3072,
                match_count: targetCount,
                match_threshold: targetThreshold,
              }),
            ]);

            const knowledgeError = knowledgeRes.error;
            const chunksError = (chunksRes as { error?: { message: string } })
              .error;
            // Surface any source failures; only abort if all sources failed
            const errorParts: string[] = [];
            if (knowledgeError)
              errorParts.push(`knowledge=${knowledgeError.message}`);
            if (chunksError) errorParts.push(`chunks=${chunksError.message}`);
            if (knowledgeError && chunksError) {
              return {
                error: `Semantic search failed: ${errorParts.join("; ")}`,
              };
            }

            const rawKnowledgeRows = (knowledgeRes.data ?? []) as AnyRow[];
            const knowledgeRows = rawKnowledgeRows.filter((row) => {
              if (typeof businessAreaId === "number") {
                return false;
              }
              const projectIds = Array.isArray(row.project_ids)
                ? (row.project_ids as unknown[]).filter(
                    (v): v is number => typeof v === "number",
                  )
                : [];

              if (typeof resolvedProjectId === "number") {
                return projectIds.includes(resolvedProjectId);
              }

              if (scope.isAdmin) return true;
              return projectIds.some((id) => allowedProjectIdSet.has(id));
            });
            // Unified document_chunks: meetings, emails, Teams, OneDrive, transcripts
            const rawChunkRows = ((chunksRes as { data?: unknown[] }).data ??
              []) as AnyRow[];
            // Project filtering is done in the RPC now; still apply comms gating here
            // because this tool uses the service role client (bypasses RLS).
            const chunkRows = rawChunkRows
              .filter((row) => {
                const businessAreaScope = readDocumentBusinessAreaScope(
                  row.doc_metadata,
                );
                if (businessAreaScope.kind === "invalid") {
                  console.error(
                    "[semanticSearch] rejected malformed Business Area scope",
                    {
                      chunkId: row.chunk_id,
                      documentId: row.document_id,
                      rawBusinessAreaId: businessAreaScope.rawValue,
                    },
                  );
                }
                return isDocumentScopeAllowed({
                  scope,
                  projectId: row.doc_project_id,
                  metadata: row.doc_metadata,
                  requestedProjectId: resolvedProjectId,
                  requestedBusinessAreaId: businessAreaId,
                });
              })
              .filter((row) =>
                isCommunicationSourceAllowed({
                  scope,
                  sourceType: resolveCommunicationSourceType({
                    category: row.doc_category,
                    sourceType: row.source_type,
                  }),
                  metadata: row.doc_metadata,
                }),
              )
              // Leadership-restricted chunks (Annual Review meetings): the
              // service-role RAG client bypasses RLS, so gate here.
              .filter(
                (row) =>
                  scope.isLeadership ||
                  !isLeadershipRestrictedChunkMetadata(row.doc_metadata),
              );

            const merged: Array<{
              key: string;
              sourceTable: string;
              recordId: string;
              sourceDocumentId: string | null;
              sourceChunkId: string | null;
              content: string;
              similarity: number;
              projectIds: number[];
              businessAreaIds: number[];
              metadata: AnyRow | null;
              createdAt: string | null;
            }> = [];

            for (const row of knowledgeRows) {
              const similarity =
                Math.round(asNumber(row.similarity) * 1000) / 1000;
              const sourceTable = String(row.source_table ?? "knowledge");
              const recordId = String(row.record_id ?? "");
              merged.push({
                key: `${sourceTable}:${recordId}`,
                sourceTable,
                recordId,
                sourceDocumentId: null,
                sourceChunkId: null,
                content: String(row.content ?? row.description ?? ""),
                similarity,
                projectIds: Array.isArray(row.project_ids)
                  ? (row.project_ids as unknown[]).filter(
                      (v): v is number => typeof v === "number",
                    )
                  : [],
                businessAreaIds: [],
                metadata:
                  row.metadata && typeof row.metadata === "object"
                    ? (row.metadata as AnyRow)
                    : null,
                createdAt:
                  typeof row.created_at === "string" ? row.created_at : null,
              });
            }

            // 3) Unified document chunks (meetings, emails, Teams, OneDrive, transcripts)
            for (const row of chunkRows) {
              const businessAreaScope = readDocumentBusinessAreaScope(
                row.doc_metadata,
              );
              const similarity =
                Math.round(asNumber(row.similarity) * 1000) / 1000;
              const hybridScore = computeHybridRetrievalScore({
                vectorScore: (row.vector_score ?? row.similarity) as
                  | number
                  | null
                  | undefined,
                textScore: row.text_score as number | null | undefined,
                recallCount:
                  row.score_components &&
                  typeof row.score_components === "object" &&
                  "recallCount" in row.score_components
                    ? Number((row.score_components as AnyRow).recallCount)
                    : null,
                lastRecalledAt:
                  row.score_components &&
                  typeof row.score_components === "object" &&
                  typeof (row.score_components as AnyRow).lastRecalledAt ===
                    "string"
                    ? ((row.score_components as AnyRow)
                        .lastRecalledAt as string)
                    : null,
                sourceTimestamp:
                  typeof row.doc_date === "string"
                    ? row.doc_date
                    : typeof row.doc_created_at === "string"
                      ? row.doc_created_at
                      : null,
              });
              const srcType = String(row.source_type ?? "document");
              merged.push({
                key: `doc_chunk:${String(row.chunk_id ?? row.document_id ?? "")}`,
                sourceTable: srcType,
                recordId: String(row.document_id ?? ""),
                sourceDocumentId:
                  typeof row.document_id === "string" ? row.document_id : null,
                sourceChunkId:
                  typeof row.chunk_id === "string" ? row.chunk_id : null,
                content: String(row.chunk_text ?? ""),
                similarity,
                projectIds:
                  businessAreaScope.kind === "none" &&
                  typeof row.doc_project_id === "number"
                    ? [row.doc_project_id]
                    : [],
                businessAreaIds:
                  businessAreaScope.kind === "valid"
                    ? [businessAreaScope.businessAreaId]
                    : [],
                metadata: {
                  title: row.doc_title,
                  category: row.doc_category,
                  source: row.doc_source,
                  source_type: srcType,
                  date: row.doc_date,
                  businessAreaId:
                    businessAreaScope.kind === "valid"
                      ? businessAreaScope.businessAreaId
                      : null,
                  retrievalRanking: {
                    requestedMode: HYBRID_RAG_RANKING_ENABLED
                      ? "hybrid"
                      : "vector",
                    modeUsed:
                      typeof row.ranking_mode_used === "string"
                        ? row.ranking_mode_used
                        : hybridScore.rankingMode,
                    hybridScore:
                      typeof row.hybrid_score === "number"
                        ? row.hybrid_score
                        : hybridScore.hybridScore,
                    scoreComponents:
                      row.score_components &&
                      typeof row.score_components === "object"
                        ? row.score_components
                        : hybridScore.components,
                    missingComponents: hybridScore.missingComponents,
                  },
                  ...(row.doc_metadata && typeof row.doc_metadata === "object"
                    ? (row.doc_metadata as Record<string, unknown>)
                    : {}),
                },
                createdAt:
                  typeof row.doc_date === "string"
                    ? row.doc_date
                    : typeof row.doc_created_at === "string"
                      ? row.doc_created_at
                      : null,
              });
            }

            const dedupedMap = new Map<string, (typeof merged)[number]>();
            for (const item of merged) {
              const existing = dedupedMap.get(item.key);
              if (!existing || item.similarity > existing.similarity) {
                dedupedMap.set(item.key, item);
              }
            }

            // Stitch adjacent transcript chunks from the same meeting into single context blocks.
            // When chunk N and chunk N+1 both match, returning them separately loses the conversational
            // thread. Merge consecutive chunks (gap ≤ 1) so the LLM sees coherent dialogue.
            const stitchTranscriptChunks = (
              items: (typeof merged)[number][],
            ): (typeof merged)[number][] => {
              const transcripts: (typeof merged)[number][] = [];
              const others: (typeof merged)[number][] = [];
              for (const item of items) {
                if (item.sourceTable === "meeting_transcript") {
                  transcripts.push(item);
                } else {
                  others.push(item);
                }
              }
              if (transcripts.length === 0) return items;

              // Group by document_id, sort by chunk_index within each group
              const byDoc = new Map<string, (typeof merged)[number][]>();
              for (const t of transcripts) {
                const group = byDoc.get(t.recordId) ?? [];
                group.push(t);
                byDoc.set(t.recordId, group);
              }

              const stitched: (typeof merged)[number][] = [];
              for (const [, chunks] of byDoc) {
                chunks.sort(
                  (a, b) =>
                    ((a.metadata?.chunk_index as number) ?? 0) -
                    ((b.metadata?.chunk_index as number) ?? 0),
                );
                let group = [chunks[0]];
                for (let i = 1; i < chunks.length; i++) {
                  const prevIdx =
                    (group[group.length - 1].metadata?.chunk_index as number) ??
                    0;
                  const currIdx =
                    (chunks[i].metadata?.chunk_index as number) ?? 0;
                  if (currIdx <= prevIdx + 2) {
                    // gap ≤ 2: merge near-adjacent chunks
                    group.push(chunks[i]);
                  } else {
                    stitched.push(mergeGroup(group));
                    group = [chunks[i]];
                  }
                }
                stitched.push(mergeGroup(group));
              }
              return [...others, ...stitched];
            };

            const mergeGroup = (
              group: (typeof merged)[number][],
            ): (typeof merged)[number] => {
              if (group.length === 1) return group[0];
              return {
                ...group[0],
                key: `doc_chunk_stitched:${group[0].recordId}:${(group[0].metadata?.chunk_index as number) ?? 0}`,
                content: group.map((c) => c.content).join("\n"),
                similarity: Math.max(...group.map((c) => c.similarity)),
              };
            };

            const stitchedItems = stitchTranscriptChunks(
              Array.from(dedupedMap.values()),
            );
            // Time-decay: blend semantic similarity with recency.
            // Briefing queries weight recency higher (25%) so recent meetings/emails surface above
            // older but semantically similar documents. Non-briefing uses 10% recency.
            // Recency decays exponentially: full weight today, ~50% at 6 months, floor 0.1 at 2+ years.
            const nowMs = Date.now();
            const recencyWeight = briefing ? 0.25 : 0.1;
            const similarityWeight = 1 - recencyWeight;
            const recencyScore = (createdAt: string | null): number => {
              if (!createdAt) return 0.5;
              const ageMs = nowMs - new Date(createdAt).getTime();
              const ageDays = ageMs / (1000 * 60 * 60 * 24);
              return Math.max(0.1, Math.exp(-ageDays / 180));
            };

            // Briefing source boost: recent comms (emails, Teams, meeting chunks) score higher
            // than generic reference documents when the user is asking for a status update.
            const sourceBoost = (sourceTable: string): number => {
              if (!briefing) return 0;
              if (sourceTable === "meeting_transcript") return 0.08;
              if (sourceTable === "meeting_summary") return 0.07;
              if (sourceTable === "email") return 0.065;
              if (sourceTable === "teams_channel") return 0.06;
              if (sourceTable === "teams_message") return 0.055;
              if (sourceTable === "teams_dm") return 0.045;
              if (sourceTable === "insight") return 0.04;
              return 0;
            };

            const activeRetrievalWeights = await loadActiveRetrievalWeights({
              supabase,
              toolName: "semanticSearch",
              query,
              projectId: resolvedProjectId,
            });

            // Pre-sort by blended score, take top 20 candidates for reranking
            const candidates = (stitchedItems as (typeof merged)[number][])
              .map((item) => {
                const retrievalWeight = retrievalWeightMultiplierForItem(
                  item,
                  activeRetrievalWeights,
                );
                const baseScore =
                  item.similarity * similarityWeight +
                  recencyScore(item.createdAt) * recencyWeight +
                  sourceBoost(item.sourceTable);
                const metadata =
                  retrievalWeight.weightIds.length > 0
                    ? {
                        ...(item.metadata ?? {}),
                        retrievalWeight: {
                          multiplier: retrievalWeight.multiplier,
                          weightIds: retrievalWeight.weightIds,
                        },
                      }
                    : item.metadata;

                return {
                  ...item,
                  metadata,
                  finalScore: baseScore * retrievalWeight.multiplier,
                };
              })
              .sort((a, b) => b.finalScore - a.finalScore)
              .slice(0, 20);

            // LLM reranker: always re-score candidates by actual relevance to the query
            let results: typeof candidates;
            if (candidates.length > 0) {
              const rerankedIndices = await rerankWithLLM(
                openai,
                query,
                candidates,
                targetCount,
              );
              results = rerankedIndices
                .map((i) => candidates[i])
                .filter(Boolean);
              // Fill remaining slots if reranker returned fewer than targetCount
              if (results.length < targetCount) {
                const usedIndices = new Set(rerankedIndices);
                for (const c of candidates) {
                  if (results.length >= targetCount) break;
                  if (!usedIndices.has(candidates.indexOf(c))) results.push(c);
                }
              }
            } else {
              results = candidates.slice(0, targetCount);
            }

            if (briefing && results.length > 1) {
              const bySource = new Map<string, typeof results>();
              for (const result of results) {
                const group = bySource.get(result.sourceTable) ?? [];
                group.push(result);
                bySource.set(result.sourceTable, group);
              }

              const diversified: typeof results = [];
              const orderedSourceTypes = Array.from(bySource.keys()).sort(
                (a, b) =>
                  rankBriefingSourcePriority(a) - rankBriefingSourcePriority(b),
              );

              for (const sourceType of orderedSourceTypes) {
                const best = bySource.get(sourceType)?.[0];
                if (!best) continue;
                diversified.push(best);
                if (diversified.length >= targetCount) break;
              }

              if (diversified.length < targetCount) {
                const seenKeys = new Set(diversified.map((item) => item.key));
                for (const result of results) {
                  if (diversified.length >= targetCount) break;
                  if (seenKeys.has(result.key)) continue;
                  diversified.push(result);
                  seenKeys.add(result.key);
                }
              }

              results = diversified;
            }

            if (results.length === 0) {
              return {
                results: [],
                message: `No results found for "${query}". Try rephrasing or broadening your search.`,
              };
            }

            return {
              query,
              resultCount: results.length,
              results: results.map((r) => ({
                content: r.content.substring(
                  0,
                  r.sourceTable === "meeting_transcript" ? 5000 : 2500,
                ),
                sourceTable: r.sourceTable,
                recordId: r.recordId,
                sourceDocumentId: r.sourceDocumentId,
                sourceChunkId: r.sourceChunkId,
                similarity: r.similarity,
                finalScore: Math.round(r.finalScore * 1000) / 1000,
                projectIds: r.projectIds,
                businessAreaIds: r.businessAreaIds,
                metadata: r.metadata,
                createdAt: r.createdAt,
              })),
              retrievalBreakdown: {
                knowledgeMatches: knowledgeRows.length,
                externalChunkMatches: chunkRows.length,
                activeRetrievalWeights: activeRetrievalWeights.length,
                documentChunkRankingMode: HYBRID_RAG_RANKING_ENABLED
                  ? "hybrid"
                  : "vector",
                documentChunkTelemetryEnabled: RAG_RETRIEVAL_TELEMETRY_ENABLED,
                degradedHybridMatches: HYBRID_RAG_RANKING_ENABLED
                  ? chunkRows.filter(
                      (row) => row.ranking_mode_used === "degraded_hybrid",
                    ).length
                  : 0,
                usedProjectFilter: Boolean(resolvedProjectId),
                filteredAdminOnlySources: [],
                projectCommunicationSourcesRequireAdmin: scope.isAdmin
                  ? []
                  : ["email", "teams_message", "teams_channel", "teams_dm"],
                businessAreaCommunicationSourcesAllowed:
                  scope.allowedBusinessAreaIds.length > 0,
              },
            };
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Unknown error";
            return {
              error: `Semantic search failed: ${msg}`,
              fallback:
                "Try using searchDocuments for keyword-based search instead.",
            };
          }
        },
      ),
    }),

    // -----------------------------------------------------------------
    // Company Knowledge
    // -----------------------------------------------------------------
    getCompanyKnowledge: tool({
      description:
        "Retrieve company-level context: mission, vision, goals, strategy, " +
        "OKRs, org structure, competitive landscape, policies, key clients, " +
        "certifications, and free-form knowledge articles. " +
        "Use this when the user asks about the company itself, its strategy, " +
        "values, differentiators, history, or competitive positioning. " +
        "Also use this to retrieve policy info or best practices.",
      inputSchema: z.object({
        category: z
          .enum([
            "all",
            "profile",
            "strategy",
            "policy",
            "process",
            "market_intel",
            "lessons_learned",
            "best_practice",
            "org_update",
            "general",
          ])
          .optional()
          .default("all")
          .describe(
            "Filter knowledge articles by category. 'profile' returns " +
              "company_context data. 'all' returns profile + all articles.",
          ),
        searchQuery: z
          .string()
          .optional()
          .describe(
            "Optional text to search within knowledge article titles/content.",
          ),
      }),
      execute: withTrace(
        "getCompanyKnowledge",
        options,
        async ({ category }) => {
          try {
            // Always fetch the company_context profile row
            const { data: ctxRows } = await supabase
              .from("company_context")
              .select("*")
              .limit(1);

            const ctxRow = ctxRows?.[0] as AnyRow | undefined;

            const profile = ctxRow
              ? {
                  mission: ctxRow.mission,
                  vision: ctxRow.vision,
                  companyHistory: ctxRow.company_history,
                  coreValues: ctxRow.core_values,
                  keyDifferentiators: ctxRow.key_differentiators,
                  competitiveLandscape: ctxRow.competitive_landscape,
                  targetMarkets: ctxRow.target_markets,
                  goals: ctxRow.goals,
                  okrs: ctxRow.okrs,
                  strategicInitiatives: ctxRow.strategic_initiatives,
                  orgStructure: ctxRow.org_structure,
                  policies: ctxRow.policies,
                  resourceConstraints: ctxRow.resource_constraints,
                  annualRevenueRange: ctxRow.annual_revenue_range,
                  employeeCount: ctxRow.employee_count,
                  foundedYear: ctxRow.founded_year,
                  headquarters: ctxRow.headquarters,
                  serviceAreas: ctxRow.service_areas,
                  certifications: ctxRow.certifications,
                  keyClients: ctxRow.key_clients,
                  notes: ctxRow.notes,
                }
              : null;

            // If just profile requested
            if (category === "profile") {
              return {
                profile,
                articles: [],
                message: profile
                  ? "Company profile loaded."
                  : "No company profile found. Ask the admin to set up company context.",
              };
            }

            // company_knowledge table has been dropped
            return {
              profile,
              articles: [],
              message: profile
                ? "Company profile loaded. Knowledge base articles are not available."
                : "Company knowledge base is not available.",
            };
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Unknown error";
            return { error: `Company knowledge lookup failed: ${msg}` };
          }
        },
      ),
    }),
  };
}
