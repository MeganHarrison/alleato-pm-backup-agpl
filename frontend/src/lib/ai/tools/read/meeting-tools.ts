import { tool } from "ai";
import {
  resolveProject,
  withTrace as _withTrace,
  generateEmbedding,
  EMBEDDING,
} from "../tool-utils";
import {
  getMeetingDetailsDescription,
  getMeetingDetailsInputSchema,
  searchMeetingsByTopicDescription,
  searchMeetingsByTopicInputSchema,
} from "@/lib/ai/tool-descriptors";
import {
  RISK_CARD_TYPES,
  DECISION_CARD_TYPES,
  ACTION_CARD_TYPES,
  findInsightCardIdsBySourceDocuments,
  insightCardBaseQuery,
  type InsightCardWithTarget,
} from "@/lib/ai/insight-cards";
import type { OperationalToolInternals, CreateOperationalToolsOptions } from "./operational-internals";
import { type AnyRow } from "../types";
import {
  buildOptionalMeetingTranscriptDetails,
  loadMeetingTranscriptContent,
} from "@/lib/meetings/transcript-content";
import { withoutLeadershipRestricted } from "@/lib/ai/leadership-restriction";

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

export function createMeetingReadTools(internals: OperationalToolInternals) {
  const { options, ctx, supabase, guardrails } = internals;

  return {
    // -----------------------------------------------------------------
    // 12. Search Meetings By Topic (cross-project, enriched results)
    // -----------------------------------------------------------------

    searchMeetingsByTopic: tool({
      description: searchMeetingsByTopicDescription,
      inputSchema: searchMeetingsByTopicInputSchema,
      execute: withTrace(
        "searchMeetingsByTopic",
        options,
        async ({ topic, projectId, projectName, maxResults }) => {
          const scope = await guardrails.getScope();

          // Resolve project name
          let resolvedProjectId = projectId;
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
          }

          if (!scope.isAdmin) {
            if (scope.allowedProjectIds.length === 0) {
              return {
                results: [],
                message:
                  "You are not assigned to any projects in the current database scope, so I cannot search meetings safely.",
              };
            }
            if (
              typeof resolvedProjectId === "number" &&
              !scope.allowedProjectIds.includes(resolvedProjectId)
            ) {
              return {
                results: [],
                message:
                  "You do not have access to that project. Pick a project you are assigned to or change the project context.",
              };
            }
          }

          const targetCount = maxResults ?? 10;

          // Strategy: run keyword search + semantic search in parallel.
          // Semantic search targets document_metadata.summary_embedding (real Fireflies summaries,
          // halfvec(3072)). The old match_meeting_segments RPC was removed when meeting_segments
          // lost its summary_embedding column in migration 20260320100000 (summaries were fake).
          const [keywordRes, semanticRes] = await Promise.all([
            // 1. Full-text keyword search on document_metadata summary/title
            supabase.rpc("full_text_search_meetings", {
              search_query: topic,
              match_count: targetCount,
            }),
            // 2. Semantic search on real meeting summaries via document_metadata.summary_embedding
            (async () => {
              try {
                const openai = ctx.openai;
                const emb = await generateEmbedding(
                  openai,
                  topic,
                  EMBEDDING.LARGE,
                );
                return supabase.rpc("match_document_metadata_by_summary", {
                  query_embedding: emb,
                  match_count: targetCount * 2,
                  match_threshold: 0.3,
                  ...(resolvedProjectId
                    ? { p_project_id: resolvedProjectId }
                    : {}),
                });
              } catch (err) {
                // Do NOT swallow into a clean empty result — a failed query
                // embedding or RPC (e.g. the recurring provider auth/credit
                // wall) would otherwise look identical to "no semantic
                // matches", silently degrading to keyword-only with no trace.
                console.error(
                  "[searchMeetingsByTopic] semantic search failed:",
                  err,
                );
                return { data: [], error: err as Error };
              }
            })(),
          ]);

          // Both halves run best-effort; if the semantic half errored we still
          // return keyword results but flag the degradation so the model (and
          // logs) know coverage was reduced rather than empty.
          const semanticSearchDegraded = Boolean(semanticRes.error);
          if (semanticSearchDegraded) {
            console.error(
              "[searchMeetingsByTopic] returning keyword-only results; semantic branch degraded:",
              semanticRes.error,
            );
          }

          // Collect unique meeting IDs from both searches
          const meetingIds = new Set<string>();
          const keywordMeetings = (keywordRes.data ?? []) as AnyRow[];
          for (const m of keywordMeetings) {
            if (m.id) meetingIds.add(String(m.id));
          }
          // match_document_metadata_by_summary returns id directly
          const semanticMeetings = (semanticRes.data ?? []) as AnyRow[];
          for (const m of semanticMeetings) {
            if (m.id) meetingIds.add(String(m.id));
          }

          if (meetingIds.size === 0) {
            return {
              results: [],
              ...(semanticSearchDegraded ? { semanticSearchDegraded } : {}),
              message: semanticSearchDegraded
                ? `No meetings matched "${topic}" by keyword, and semantic search was unavailable (degraded), so coverage may be incomplete. Try broader terms or retry.`
                : `No meetings found discussing "${topic}". Try broader terms.`,
            };
          }

          // Fetch meeting metadata for matched IDs
          const ids = Array.from(meetingIds).slice(0, targetCount);
          let meetingQuery = supabase
            .from("document_metadata")
            .select(
              "id, title, date, project, project_id, summary, overview, participants, action_items",
            )
            .in("id", ids)
            .order("date", { ascending: false });
          if (resolvedProjectId) {
            meetingQuery = meetingQuery.eq("project_id", resolvedProjectId);
          }
          if (!scope.isAdmin) {
            meetingQuery = meetingQuery.in(
              "project_id",
              scope.allowedProjectIds,
            );
          }
          // Service-role client bypasses RLS: enforce the leadership
          // restriction (Annual Review meetings) at the tool layer.
          meetingQuery = withoutLeadershipRestricted(
            meetingQuery,
            scope.isLeadership,
          );

          const meetingsRes = await meetingQuery;
          const meetings = (meetingsRes.data ?? []) as AnyRow[];

          return {
            searchScope: resolvedProjectId
              ? `Filtered to project ${resolvedProjectId}`
              : "All projects",
            topic,
            ...(semanticSearchDegraded ? { semanticSearchDegraded } : {}),
            totalResults: meetings.length,
            results: meetings.map((m) => ({
              sourceRef: `[Source: Meeting - "${m.title}" - ${m.date}]`,
              id: m.id,
              title: m.title,
              date: m.date,
              project: m.project,
              projectId: m.project_id,
              participants: m.participants,
              summary: String(m.summary || m.overview || "").substring(0, 800),
              actionItems: m.action_items,
            })),
          };
        },
      ),
    }),

    // -----------------------------------------------------------------
    // 13. Get Meeting Details (full meeting with digest + segments + quotes)
    // -----------------------------------------------------------------

    getMeetingDetails: tool({
      description: getMeetingDetailsDescription,
      inputSchema: getMeetingDetailsInputSchema,
      execute: withTrace(
        "getMeetingDetails",
        options,
        async ({ meetingId, meetingTitle, includeTranscript }) => {
          const scope = await guardrails.getScope();

          if (!scope.isAdmin && scope.allowedProjectIds.length === 0) {
            return {
              error:
                "You are not assigned to any projects in the current database scope, so I cannot retrieve meeting details safely.",
            };
          }

          // Resolve ID from title if no meetingId provided (or if meetingId lookup fails)
          let resolvedId = meetingId;

          if (!resolvedId && meetingTitle) {
            // Search by title — ilike for case-insensitive partial match
            let searchQuery = supabase
              .from("document_metadata")
              .select("id, title")
              .or(
                "type.eq.meeting,category.eq.meeting,type.eq.meeting_transcript",
              )
              .ilike("title", `%${meetingTitle}%`)
              .order("date", { ascending: false })
              .limit(1);
            if (!scope.isAdmin) {
              searchQuery = searchQuery.in(
                "project_id",
                scope.allowedProjectIds,
              );
            }
            searchQuery = withoutLeadershipRestricted(
              searchQuery,
              scope.isLeadership,
            );
            const { data: found } = await searchQuery.maybeSingle();

            if (!found) {
              return {
                error: `No meeting found with title matching "${meetingTitle}". Try searchMeetingsByTopic with keywords from the title.`,
              };
            }
            resolvedId = found.id as string;
          }

          if (!resolvedId) {
            return { error: "Provide either meetingId or meetingTitle" };
          }

          const meetingLookup = withoutLeadershipRestricted(
            supabase
              .from("document_metadata")
              .select("id,title,date,project,project_id,participants,participants_array,duration_minutes,summary,overview,action_items,bullet_points,url,source,source_web_url,content")
              .eq("id", resolvedId),
            scope.isLeadership,
          );
          const scopedMeetingLookup = scope.isAdmin
            ? meetingLookup
            : meetingLookup.in("project_id", scope.allowedProjectIds);

          // Pipeline B: find insight_cards whose evidence points at this
          // meeting document, then fetch them with the shared base query.
          const evidence = await findInsightCardIdsBySourceDocuments(supabase, [
            resolvedId,
          ]);
          const cardFetch = evidence.allCardIds.length
            ? insightCardBaseQuery(supabase, { includeAnyStatus: true }).in(
                "id",
                evidence.allCardIds,
              )
            : Promise.resolve({ data: [] as InsightCardWithTarget[], error: null });

          const [meetingRes, insightsRes] = await Promise.all([
            scopedMeetingLookup.single(),
            cardFetch,
          ]);

          // If direct ID lookup failed and we have a title, the ID may have been guessed
          if (meetingRes.error || !meetingRes.data) {
            if (meetingTitle) {
              return {
                error: `Meeting with title "${meetingTitle}" could not be retrieved. Try searchMeetingsByTopic first.`,
              };
            }
            return {
              error: `Meeting ID "${resolvedId}" not found. IMPORTANT: Do not guess meeting IDs — use searchMeetingsByTopic or getMeetingsByDate to get the real ID first, then call getMeetingDetails with that exact ID.`,
            };
          }

          const m = meetingRes.data as AnyRow;
          const allCards = ((insightsRes as { data: unknown }).data ??
            []) as unknown as InsightCardWithTarget[];

          // Pipeline B grouping: bucket by card_type instead of legacy `type`.
          const decisions = allCards.filter((c) =>
            DECISION_CARD_TYPES.includes(c.card_type as never),
          );
          const risks = allCards.filter((c) =>
            RISK_CARD_TYPES.includes(c.card_type as never),
          );
          const actionItems = allCards.filter(
            (c) =>
              ACTION_CARD_TYPES.includes(c.card_type as never) &&
              typeof c.next_action === "string" &&
              c.next_action.trim().length > 0,
          );

          const transcript = includeTranscript
            ? await loadMeetingTranscriptContent({
                id: String(m.id),
                url: typeof m.url === "string" ? m.url : null,
                source: typeof m.source === "string" ? m.source : null,
                sourceWebUrl:
                  typeof m.source_web_url === "string" ? m.source_web_url : null,
                content: typeof m.content === "string" ? m.content : null,
              })
            : null;
          const transcriptDetails = buildOptionalMeetingTranscriptDetails(
            includeTranscript,
            transcript,
          );

          return {
            sourceRef: `[Source: Meeting - "${m.title}" - ${m.date}]`,
            ...(transcriptDetails.warning
              ? { warning: transcriptDetails.warning }
              : {}),
            meeting: {
              id: m.id,
              title: m.title,
              date: m.date,
              project: m.project,
              projectId: m.project_id,
              participants: m.participants,
              participantsArray: m.participants_array,
              duration: m.duration_minutes,
              summary: m.summary,
              overview: m.overview,
              actionItems: m.action_items,
              bulletPoints: m.bullet_points,
              ...transcriptDetails.meetingFields,
            },
            decisions: decisions.map((c) => {
              const meta = (c.metadata ?? {}) as AnyRow;
              return {
                description: c.summary,
                owner: c.suggested_owner_label,
                rationale: meta.rationale ?? c.why_it_matters,
              };
            }),
            risks: risks.map((c) => {
              const meta = (c.metadata ?? {}) as AnyRow;
              return {
                description: c.summary,
                owner: c.suggested_owner_label,
                category: meta.category,
                likelihood: meta.likelihood,
                impact: meta.impact,
                mitigationPlan: meta.mitigation_plan ?? c.next_action,
              };
            }),
            // Pipeline B does not model `opportunity` as a card_type. Surface
            // an explicit flag so the caller (and the model) does not invent
            // opportunities. We can extend the classifier later to add an
            // opportunity card_type if needed.
            opportunities: [] as Array<{
              description: unknown;
              owner: unknown;
              type: unknown;
              nextStep: unknown;
            }>,
            opportunitiesUnavailable: true,
            // NEW: Pipeline B captures action items as task / open_question /
            // requirement cards with `next_action` filled in. Surface them
            // here since they're highly useful in a meeting view.
            actionItems: actionItems.map((c) => ({
              description: c.title,
              owner: c.suggested_owner_label,
              nextAction: c.next_action,
            })),
          };
        },
      ),
    }),
  };
}
