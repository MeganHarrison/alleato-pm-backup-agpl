import { tool } from "ai";
import { z } from "zod";
import {
  resolveProject,
  withTrace as _withTrace,
  generateEmbedding,
  EMBEDDING,
} from "../tool-utils";
import {
  searchMemories as searchAiMemories,
  writeMemory as writeAiMemory,
  type MemoryType,
  type MemoryVisibility,
} from "@/lib/ai/services/ai-memory-service";
import {
  resolveTargetIdsForProjects,
  mapLegacyInsightTypeToCardType,
  severityToConfidence,
} from "@/lib/ai/insight-cards";
import type { Json } from "@/types/database.types";
import type { OperationalToolInternals, CreateOperationalToolsOptions } from "./operational-internals";

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

export function createMemoryReadTools(internals: OperationalToolInternals) {
  const { userId, options, ctx, supabase, guardrails } = internals;

  return {
    // -----------------------------------------------------------------
    // 11. Conversation Memory Recall
    // -----------------------------------------------------------------

    recallPastConversations: tool({
      description:
        "Search past conversation memories to recall prior discussions " +
        "with this user. Use when the user references previous conversations " +
        '("like we talked about", "remember when", "last time"), or when ' +
        "context from prior sessions would improve the response (recurring " +
        "topics, established preferences, prior decisions).",
      inputSchema: z.object({
        query: z
          .string()
          .describe(
            "What to search for in past conversations — e.g. 'cash flow discussion' or 'Cedar Park budget concerns'",
          ),
        matchCount: z
          .number()
          .optional()
          .default(5)
          .describe("Number of past conversations to return"),
      }),
      execute: withTrace(
        "recallPastConversations",
        options,
        async ({ query, matchCount }) => {
          const openaiClient = ctx.openai;
          const queryEmbedding = await generateEmbedding(
            openaiClient,
            query,
            EMBEDDING.LARGE,
          );

          const { data, error } = await supabase.rpc(
            "search_conversation_memories",
            {
              query_embedding: queryEmbedding,
              match_count: matchCount ?? 5,
              filter_user_id: userId,
            },
          );

          if (error)
            throw new Error(
              `recallPastConversations RPC failed: ${error.message}`,
            );

          const results = (data ?? []) as Array<{
            id: number;
            content: string;
            metadata: Record<string, unknown>;
            similarity: number;
          }>;

          if (results.length === 0) {
            return {
              results: [],
              message:
                "No past conversation memories found. This may be a new user or their conversations haven't been indexed yet.",
            };
          }

          return {
            query,
            resultCount: results.length,
            results: results.map((r) => ({
              summary: r.content,
              similarity: Math.round((r.similarity as number) * 100) / 100,
              sessionId: (r.metadata as Record<string, unknown>)?.session_id,
              date:
                (r.metadata as Record<string, unknown>)?.created_at ??
                (r.metadata as Record<string, unknown>)?.updated_at,
            })),
          };
        },
      ),
    }),

    // -----------------------------------------------------------------
    // 14. Save to Knowledge Base (write tool)
    // -----------------------------------------------------------------

    saveToKnowledgeBase: tool({
      description:
        "Save knowledge, lessons learned, best practices, or institutional " +
        "memory to the company knowledge base. Use this when the user says " +
        "'save this', 'remember this', 'I want to capture this', or " +
        "'add this to the knowledge base'. Admin saves are approved and " +
        "searchable immediately; non-admin saves are captured as drafts for " +
        "admin review before they become available through the AI assistant. " +
        "Categories: lessons_learned, best_practice, process, policy, " +
        "market_intel, general, strategy, org_update.",
      inputSchema: z.object({
        title: z
          .string()
          .describe("Clear, descriptive title for the knowledge entry"),
        content: z
          .string()
          .describe(
            "The knowledge content — be thorough and include context, rationale, and specifics",
          ),
        category: z
          .enum([
            "lessons_learned",
            "best_practice",
            "process",
            "policy",
            "market_intel",
            "general",
            "strategy",
            "org_update",
          ])
          .describe("Category for the knowledge entry"),
        tags: z
          .array(z.string())
          .optional()
          .describe(
            "Tags for searchability (e.g. ['ASRS', 'fire suppression', 'pricing'])",
          ),
        source: z
          .string()
          .optional()
          .describe(
            "Source of the knowledge (e.g. 'Meeting: Sprinkler Pricing Review 2026-03-13', 'Brandon Clymer')",
          ),
      }),
      execute: withTrace(
        "saveToKnowledgeBase",
        options,
        async ({ title, category }) => {
          // company_knowledge table has been dropped
          return {
            error: `Knowledge base is not available. The "${title}" entry (${category}) could not be saved.`,
          };
        },
      ),
    }),

    // -----------------------------------------------------------------
    // 15. Save Insight from Meeting/Conversation (write tool)
    // -----------------------------------------------------------------

    saveInsight: tool({
      description:
        "Save a structured insight extracted from meetings or conversations. " +
        "Use when the user highlights something important from a meeting " +
        "or discussion that should be tracked — risks, decisions, cost " +
        "impacts, design considerations, etc. Links to the source meeting " +
        "when available.",
      inputSchema: z.object({
        title: z.string().describe("Concise insight title"),
        description: z.string().describe("Detailed description of the insight"),
        insightType: z
          .enum([
            "risk",
            "decision",
            "opportunity",
            "cost_impact",
            "design_consideration",
            "lesson_learned",
            "action_required",
          ])
          .describe("Type of insight"),
        severity: z
          .enum(["low", "medium", "high", "critical"])
          .optional()
          .default("medium")
          .describe("Severity/importance level"),
        projectId: z.number().optional().describe("Project ID if applicable"),
        projectName: z.string().optional().describe("Project name if known"),
        meetingId: z
          .string()
          .optional()
          .describe("Source meeting ID if applicable"),
        meetingName: z.string().optional().describe("Source meeting name"),
        meetingDate: z.string().optional().describe("Source meeting date"),
        quotes: z
          .string()
          .optional()
          .describe("Relevant quotes from the discussion"),
        stakeholders: z
          .array(z.string())
          .optional()
          .describe("People involved or affected"),
        financialImpact: z
          .number()
          .optional()
          .describe("Estimated financial impact in dollars"),
      }),
      execute: withTrace(
        "saveInsight",
        options,
        async ({
          title,
          description,
          insightType,
          severity,
          projectId,
          projectName,
          meetingId,
          meetingName,
          meetingDate,
          quotes,
          stakeholders,
          financialImpact,
        }) => {
          try {
            // Resolve project if name provided
            let resolvedProjectId = projectId;
            let resolvedProjectName = projectName;
            if (!resolvedProjectId && projectName) {
              const resolved = await resolveProject(
                supabase,
                guardrails,
                undefined,
                projectName,
              );
              if (!("error" in resolved)) {
                resolvedProjectId = resolved.id;
                resolvedProjectName = resolved.name;
              }
            }

            // Pipeline B requires a target. Resolve project_id → target_id;
            // if no target exists, bail with a clear instruction.
            if (!resolvedProjectId) {
              return {
                error:
                  "Pipeline B insight cards must be linked to a project target. Provide projectId or projectName.",
              };
            }
            const targetMap = await resolveTargetIdsForProjects(supabase, [resolvedProjectId]);
            const targetId = targetMap.get(resolvedProjectId);
            if (!targetId) {
              return {
                error: `No active intelligence target exists for project ${resolvedProjectName ?? resolvedProjectId}. Ask an admin to bootstrap it before saving insights.`,
              };
            }

            const cardType = mapLegacyInsightTypeToCardType(insightType);
            const confidence = severityToConfidence(severity ?? "medium");
            const nowIso = new Date().toISOString();
            const cardMetadata = {
              severity_input: severity ?? "medium",
              insight_type_input: insightType,
              meeting_id: meetingId ?? null,
              meeting_name: meetingName ?? null,
              meeting_date: meetingDate ?? null,
              exact_quotes_text: quotes ?? null,
              stakeholders_affected: stakeholders ?? [],
              financial_impact: financialImpact ?? null,
            };

            const { data, error } = await supabase
              .from("insight_cards")
              .insert({
                primary_target_id: targetId,
                card_type: cardType,
                title,
                summary: description,
                why_it_matters: null,
                current_status: "open",
                confidence,
                // Drafts start needing review since the AI assistant flagged
                // them on the user's behalf, not the deterministic compiler.
                attribution_status: "needs_review",
                next_action: null,
                suggested_owner_label: null,
                first_seen_at: nowIso,
                last_seen_at: nowIso,
                source_count: 1,
                compiler_version: "ai_assistant_save_insight_v1",
                metadata: cardMetadata as unknown as Json,
              })
              .select("id, title, card_type, confidence")
              .single();

            if (error)
              return { error: `Failed to save insight: ${error.message}` };

            return {
              success: true,
              savedInsight: {
                id: data.id,
                title: data.title,
                insight_type: data.card_type,
                severity: severity ?? "medium",
                project_name: resolvedProjectName ?? null,
              },
              message: `Insight saved as draft: "${title}" (${insightType}, ${severity ?? "medium"}). ${resolvedProjectName ? `Linked to project: ${resolvedProjectName}.` : ""} A team member must approve it before it appears in AI analysis and search results.`,
            };
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Unknown error";
            return { error: `Failed to save insight: ${msg}` };
          }
        },
      ),
    }),

    // -----------------------------------------------------------------
    // 17. Search Memories (semantic search over user's memory store)
    // -----------------------------------------------------------------

    searchMemories: tool({
      description:
        "Search your memory of this user — their preferences, facts about projects, " +
        "lessons learned, open commitments, and recent context from past sessions. " +
        "Use this when the user references something from a previous conversation, " +
        "or when you want to personalize a response based on what you know about them. " +
        "Memory types: fact (project/people facts), preference (how they like info), " +
        "lesson (patterns you've observed), commitment (tracked commitments), " +
        "context (situational context from recent sessions).",
      inputSchema: z.object({
        query: z
          .string()
          .describe("What you're looking for in memory (natural language)"),
        type: z
          .enum(["fact", "preference", "lesson", "commitment", "context"])
          .optional()
          .describe("Filter to a specific memory type"),
        projectId: z
          .number()
          .optional()
          .describe("Filter to memories linked to a specific project"),
      }),
      execute: withTrace(
        "searchMemories",
        options,
        async ({ query, type, projectId }) => {
          const results = await searchAiMemories({
            userId,
            query,
            type: type as MemoryType | undefined,
            projectId,
            matchCount: 8,
            matchThreshold: 0.4,
          });

          if (results.length === 0) {
            return { memories: [], message: "No relevant memories found." };
          }

          return {
            memories: results.map((m) => ({
              type: m.type,
              content: m.content,
              confidence: m.confidence,
              importance: m.importance,
              projectId: m.project_id,
              source: m.source,
              createdAt: m.created_at,
              similarity: m.similarity,
            })),
          };
        },
      ),
    }),

    // -----------------------------------------------------------------
    // 18. Write Memory (store something worth remembering)
    // -----------------------------------------------------------------

    writeMemory: tool({
      description:
        "Store a durable memory about this user for future sessions. " +
        "Use this when you learn something worth remembering: a preference, " +
        "a fact about their projects or team, a pattern you've noticed, " +
        "a commitment that needs tracking, or important context. " +
        "Do NOT use this for transient operational data — only things that " +
        "improve future conversations. Memory types: " +
        "fact (objective facts), preference (how they like things), " +
        "lesson (patterns/insights), commitment (tracked commitment with owner + deadline), " +
        "context (situational context, expires in 30 days).",
      inputSchema: z.object({
        type: z
          .enum(["fact", "preference", "lesson", "commitment", "context"])
          .describe("Type of memory to store"),
        content: z
          .string()
          .describe(
            "The memory content — 1-2 sentences, specific. " +
              "Include names, numbers, dates when relevant. " +
              "Example: 'User prefers bullet-point financial summaries over prose paragraphs' " +
              "or 'Brandon Clymer committed to ROM estimates for Vermillion Rise by March 15, 2026'",
          ),
        projectId: z
          .number()
          .optional()
          .describe("Project ID if this memory is project-specific"),
        importance: z
          .number()
          .min(0.1)
          .max(1.0)
          .optional()
          .describe(
            "How important is this to surface in future sessions? " +
              "0.1 = minor detail, 0.5 = useful context, 1.0 = critical to remember",
          ),
        confidence: z
          .number()
          .min(0.1)
          .max(1.0)
          .optional()
          .describe("How confident are you this is accurate? Default 0.9"),
        visibility: z
          .enum(["private", "team"])
          .optional()
          .describe(
            "Who should see this memory? " +
              "private = only this user (default for preferences/context), " +
              "team = all users (use for facts/lessons about projects that benefit everyone)",
          ),
      }),
      execute: withTrace(
        "writeMemory",
        options,
        async ({
          type,
          content,
          projectId,
          importance,
          confidence,
          visibility,
        }) => {
          const result = await writeAiMemory({
            userId,
            type: type as MemoryType,
            content,
            projectId,
            importance,
            confidence,
            visibility: visibility as MemoryVisibility | undefined,
            source: "conversation",
          });

          if ("error" in result) {
            return { success: false, error: result.error };
          }

          return {
            success: true,
            id: result.id,
            message: `Memory stored: [${type}] "${content.substring(0, 80)}${content.length > 80 ? "..." : ""}"`,
          };
        },
      ),
    }),
  };
}
