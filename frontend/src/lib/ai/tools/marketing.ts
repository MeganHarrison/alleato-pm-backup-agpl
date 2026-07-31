import { tool } from "ai";
import { z } from "zod";
import type { ToolTracePayload } from "./tool-utils";
import {
  candidateToIntelligenceInsert,
  createContentCalendarDraft,
  createMarketingContentAsset,
  createMarketingIntelligenceItem,
  findMarketingSourceCandidates,
  getMarketingCalendar,
} from "@/lib/ai/services/marketing-service";

export type MarketingToolsOptions = {
  onTrace?: (trace: ToolTracePayload) => void;
  pinnedProjectId?: number;
};

function trace(
  options: MarketingToolsOptions,
  toolName: string,
  input: Record<string, unknown>,
  output: unknown,
) {
  options.onTrace?.({
    tool: toolName,
    input,
    output,
    timestamp: new Date().toISOString(),
  });
}

const dateRangeSchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
}).optional();

const calendarStatusSchema = z.enum([
  "draft",
  "needs_review",
  "approved",
  "scheduled",
  "published",
  "archived",
]);

const getMarketingCalendarInputSchema = z.object({
  dateRange: z
    .object({
      start: z.string().nullable().default(null),
      end: z.string().nullable().default(null),
    })
    .nullable()
    .default(null),
  status: calendarStatusSchema.nullable().default(null),
  projectId: z.number().nullable().default(null),
});

const assetStatusSchema = z.enum([
  "draft",
  "needs_review",
  "approved",
  "revision_requested",
  "published",
  "archived",
]);

const channelSchema = z.enum([
  "linkedin",
  "blog",
  "email",
  "website",
  "case_study",
  "video",
  "presentation",
  "internal",
]);

const funnelStageSchema = z.enum([
  "awareness",
  "consideration",
  "conversion",
  "retention",
  "reputation",
]);

export function createMarketingTools(
  userId: string,
  options: MarketingToolsOptions = {},
) {
  return {
    findMarketingSourceCandidates: tool({
      description:
        "Find source-backed marketing inputs from documents, project summaries, AI insights, and recent operational records. Use before making claims about project wins, owner praise, leadership notes, recent events, or content opportunities.",
      inputSchema: z.object({
        dateRange: dateRangeSchema,
        projectId: z.number().optional(),
        topics: z.array(z.string()).default([]),
        sourceTypes: z.array(z.string()).default([]),
      }),
      execute: async (input) => {
        const candidates = await findMarketingSourceCandidates({
          ...input,
          projectId: input.projectId ?? options.pinnedProjectId ?? null,
        });
        const output = {
          candidates,
          warning:
            candidates.length === 0
              ? "No source-backed marketing candidates were found. Do not generate a content calendar until source material is provided or the search is broadened."
              : null,
        };
        trace(options, "findMarketingSourceCandidates", input, output);
        return output;
      },
    }),

    createMarketingIntelligenceItem: tool({
      description:
        "Persist a source-backed marketing opportunity or signal for reuse. Use this when a source candidate should become part of marketing memory.",
      inputSchema: z.object({
        sourceTable: z.string(),
        sourceId: z.string(),
        sourceTitle: z.string(),
        sourceDate: z.string().nullable().optional(),
        sourceUrl: z.string().nullable().optional(),
        projectId: z.number().nullable().optional(),
        itemType: z.enum([
          "project_win",
          "owner_update",
          "leadership_thought",
          "market_trend",
          "competitor_signal",
          "testimonial",
          "case_study_candidate",
          "event_opportunity",
          "campaign_idea",
        ]).default("campaign_idea"),
        title: z.string(),
        summary: z.string(),
        strategicRationale: z.string().optional(),
        recommendedUse: z.array(z.string()).default([]),
        confidence: z.enum(["low", "medium", "high"]).default("medium"),
      }),
      execute: async (input) => {
        const item = await createMarketingIntelligenceItem({
          source_table: input.sourceTable,
          source_id: input.sourceId,
          source_title: input.sourceTitle,
          source_date: input.sourceDate ?? null,
          source_url: input.sourceUrl ?? null,
          project_id: input.projectId ?? options.pinnedProjectId ?? null,
          item_type: input.itemType,
          title: input.title,
          summary: input.summary,
          strategic_rationale: input.strategicRationale ?? null,
          recommended_use: input.recommendedUse,
          confidence: input.confidence,
          created_by: userId,
        });
        const output = { success: true, item };
        trace(options, "createMarketingIntelligenceItem", input, output);
        return output;
      },
    }),

    createMarketingIntelligenceFromCandidate: tool({
      description:
        "Persist one of the source candidates returned by findMarketingSourceCandidates as a marketing intelligence item.",
      inputSchema: z.object({
        candidate: z.object({
          sourceTable: z.string(),
          sourceId: z.string(),
          sourceTitle: z.string(),
          sourceDate: z.string().nullable(),
          sourceUrl: z.string().nullable(),
          projectId: z.number().nullable(),
          projectName: z.string().nullable(),
          summary: z.string(),
          confidence: z.enum(["low", "medium", "high"]),
          citationText: z.string(),
        }),
        itemType: z.enum([
          "project_win",
          "owner_update",
          "leadership_thought",
          "market_trend",
          "competitor_signal",
          "testimonial",
          "case_study_candidate",
          "event_opportunity",
          "campaign_idea",
        ]).default("campaign_idea"),
      }),
      execute: async (input) => {
        const item = await createMarketingIntelligenceItem(
          candidateToIntelligenceInsert({
            candidate: input.candidate,
            itemType: input.itemType,
            createdBy: userId,
          }),
        );
        const output = { success: true, item };
        trace(options, "createMarketingIntelligenceFromCandidate", input, output);
        return output;
      },
    }),

    createContentCalendarDraft: tool({
      description:
        "Persist a reviewable weekly content calendar draft. Every item must include source item IDs and rationale. Use this after source-backed intelligence items exist.",
      inputSchema: z.object({
        weekStartDate: z.string(),
        items: z.array(z.object({
          plannedDate: z.string().optional(),
          channel: channelSchema,
          funnelStage: funnelStageSchema.default("awareness"),
          title: z.string(),
          angle: z.string(),
          targetAudience: z.string().optional(),
          projectId: z.number().nullable().optional(),
          companyId: z.string().nullable().optional(),
          sourceItemIds: z.array(z.string()).default([]),
          rationale: z.string(),
          status: calendarStatusSchema.default("needs_review"),
        })),
      }),
      execute: async (input) => {
        const rows = await createContentCalendarDraft({
          weekStartDate: input.weekStartDate,
          createdBy: userId,
          items: input.items.map((item) => ({
            plannedDate: item.plannedDate,
            channel: item.channel,
            funnel_stage: item.funnelStage,
            title: item.title,
            angle: item.angle,
            target_audience: item.targetAudience ?? null,
            project_id: item.projectId ?? options.pinnedProjectId ?? null,
            company_id: item.companyId ?? null,
            source_item_ids: item.sourceItemIds,
            rationale: item.rationale,
            status: item.status,
          })),
        });
        const output = {
          success: true,
          count: rows.length,
          items: rows,
          reviewHref: "/ai/marketing",
        };
        trace(options, "createContentCalendarDraft", input, output);
        return output;
      },
    }),

    createMarketingContentAsset: tool({
      description:
        "Persist a draft marketing asset tied to a calendar item. Drafts are not publishable until reviewed and approved.",
      inputSchema: z.object({
        calendarItemId: z.string(),
        assetType: z.enum([
          "linkedin_post",
          "blog_outline",
          "blog_draft",
          "email_draft",
          "case_study_outline",
          "video_script",
          "image_prompt",
          "sales_blurb",
        ]),
        title: z.string(),
        body: z.string(),
        sourceCitations: z.array(z.object({
          sourceTable: z.string().optional(),
          sourceId: z.string().optional(),
          title: z.string(),
          url: z.string().nullable().optional(),
        })).default([]),
        status: assetStatusSchema.default("needs_review"),
      }),
      execute: async (input) => {
        const asset = await createMarketingContentAsset({
          calendar_item_id: input.calendarItemId,
          asset_type: input.assetType,
          title: input.title,
          body: input.body,
          source_citations: input.sourceCitations,
          status: input.status,
          created_by: userId,
        });
        const output = { success: true, asset, reviewHref: "/ai/marketing" };
        trace(options, "createMarketingContentAsset", input, output);
        return output;
      },
    }),

    getMarketingCalendar: tool({
      description:
        "Retrieve persisted marketing calendar items, draft assets, source citations, and review states for the marketing review page. Set dateRange, status, and projectId to null to retrieve without those filters.",
      inputSchema: getMarketingCalendarInputSchema,
      execute: async (input) => {
        const items = await getMarketingCalendar({
          dateRange: input.dateRange
            ? {
                start: input.dateRange.start ?? undefined,
                end: input.dateRange.end ?? undefined,
              }
            : undefined,
          status: input.status ?? undefined,
          projectId: input.projectId ?? undefined,
        });
        const output = { items, reviewHref: "/ai/marketing" };
        trace(options, "getMarketingCalendar", input, output);
        return output;
      },
    }),
  };
}
