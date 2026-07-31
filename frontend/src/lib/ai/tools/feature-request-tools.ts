import { z } from "zod";
import { defineReadTool, defineWriteTool, type ToolTracePayload } from "./tool-utils";
import {
  attachLinearIssueToFeatureRequest,
  attachLinearSubIssueToFeatureRequest,
  captureFeatureRequestPacket,
  draftLinearIssueFromFeatureRequest,
  draftLinearSubIssuesFromImplementationPlan,
  findRelatedFeatureRequests,
  generateClaudeCodeHandoff,
  generateImplementationPlan,
  getFeatureRequestDetail,
  recordLinearStatusUpdateForFeatureRequest,
  updateFeatureRequestPacket,
  buildFeatureRequestPacketWidget,
} from "@/lib/feature-requests/server";
import { scoreFeatureRequestReadiness } from "@/lib/feature-requests/readiness";
import type { FeatureRequestType } from "@/lib/feature-requests/types";
import { createIdea } from "@/lib/ideas/server";
import { IDEA_PRIORITIES, IDEA_ROUTE_TYPES, IDEA_SOURCES, IDEA_STATUSES } from "@/lib/ideas/types";

export type FeatureRequestToolsOptions = {
  onTrace?: (trace: ToolTracePayload) => void;
  pinnedProjectId?: number;
};

const requestTypeSchema = z.enum([
  "new_feature",
  "workflow_improvement",
  "bug",
  "report_dashboard",
  "automation",
  "ai_assistant_capability",
  "data_cleanup",
  "integration",
  "permission_admin",
]);

const stringArraySchema = z.array(z.string()).default([]);
const optionalStringArraySchema = z.array(z.string()).optional();
const featureRequestIdSchema = z.string().uuid().describe("Feature request packet UUID");
const featureSubIssueIdSchema = z.string().uuid().describe("Feature request Linear sub-issue draft UUID");
const linearIssueIdSchema = z.string().min(1).describe("Linear issue ID, for example AAI-123");
const projectIdSchema = z.number().int().positive();

const FEATURE_REQUEST_READ_ERROR_GUIDANCE =
  "Feature request packet data could not be checked. Tell the user exactly which packet lookup failed, then continue with any other available context instead of presenting missing data as fact.";

export function createFeatureRequestTools(
  userId: string,
  options: FeatureRequestToolsOptions = {},
) {
  return {
    findRelatedFeatureRequests: defineReadTool("findRelatedFeatureRequests", options, {
      description:
        "Find existing AIS feature request packets before creating a duplicate. Use this before captureFeatureRequestPacket when a stakeholder asks for a feature, workflow improvement, dashboard, report, automation, AI capability, integration, data cleanup, or permission/admin change.",
      inputSchema: z.object({
        query: z.string().min(2).describe("Request title, raw wording, or keywords to match against existing packets."),
        projectId: projectIdSchema.optional().describe("Project ID when the request is project-scoped."),
      }),
      errorGuidance: FEATURE_REQUEST_READ_ERROR_GUIDANCE,
      execute: async (input) => {
        const requests = await findRelatedFeatureRequests({
          query: input.query,
          projectId: input.projectId ?? options.pinnedProjectId ?? null,
        });
        const output = {
          requests: requests.map((request) => ({
            id: request.id,
            title: request.title,
            status: request.status,
            readyForBuild: request.ready_for_build,
            updatedAt: request.updated_at,
            detailHref: `/ai/feature-requests/${request.id}`,
          })),
        };
        return output;
      },
    }),

    captureFeatureRequestPacket: defineWriteTool("captureFeatureRequestPacket", options, {
      description:
        "Create a durable AIS feature request packet from stakeholder wording. Preserve raw wording exactly, summarize separately, add implementation-critical open questions, and return a feature_request_packet widget payload. Do not use this for lightweight bug board feedback unless the user wants implementation-ready packet work.",
      inputSchema: z.object({
        title: z.string().min(2).optional(),
        requesterName: z.string().min(1).default("Brandon"),
        requestType: requestTypeSchema.default("workflow_improvement"),
        rawRequest: z.string().min(5).describe("Exact stakeholder wording. Preserve it separately from the summary."),
        assistantSummary: z.string().min(5).describe("Plain-English AIS understanding of the request."),
        stakeholderProblem: z.string().min(2).optional(),
        desiredOutcome: z.string().min(2).optional(),
        affectedUsers: stringArraySchema,
        affectedPages: stringArraySchema,
        affectedWorkflows: stringArraySchema,
        acceptanceCriteria: stringArraySchema,
        verificationSteps: stringArraySchema,
        openQuestions: stringArraySchema,
        assumptions: stringArraySchema,
        priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
        projectId: projectIdSchema.optional(),
        linearDraftBody: z.string().min(10).optional(),
      }),
      execute: async (input) => {
        const request = await captureFeatureRequestPacket({
          ...input,
          requestType: input.requestType as FeatureRequestType,
          requesterUserId: userId,
          projectId: input.projectId ?? options.pinnedProjectId ?? null,
          stakeholderProblem: input.stakeholderProblem ?? null,
          desiredOutcome: input.desiredOutcome ?? null,
          linearDraftBody: input.linearDraftBody ?? null,
          createdBy: userId,
        });
        const detail = await getFeatureRequestDetail(request.id);
        const widget = buildFeatureRequestPacketWidget({
          request,
          latestPlan: detail?.latestPlan ?? null,
        });
        const output = {
          success: true,
          requestId: request.id,
          status: request.status,
          readyForBuild: request.ready_for_build,
          readinessMissingRequirements: request.readiness_missing_requirements,
          detailHref: widget.detailHref,
          widget,
        };
        return output;
      },
    }),

    captureIdeaItem: defineWriteTool("captureIdeaItem", options, {
      description:
        "Capture a lightweight idea in the editable Ideas table. Use this when the user wants to quickly dump an idea, add something to the ideas list, remember an idea for later routing, or avoid hunting through prior conversations. Do not use this for implementation-ready feature packets unless the user asks for planning/handoff work.",
      inputSchema: z.object({
        body: z.string().min(5).describe("The idea text to preserve in the editable ideas table."),
        title: z.string().min(2).max(160).optional(),
        priority: z.enum(IDEA_PRIORITIES).default("medium"),
        status: z.enum(IDEA_STATUSES).default("captured"),
        routeType: z.enum(IDEA_ROUTE_TYPES).default("unrouted"),
        routeTarget: z.string().max(240).optional(),
        aiSummary: z.string().max(1000).optional(),
        aiNextAction: z.string().max(1000).optional(),
        source: z.enum(IDEA_SOURCES).default("ai_assistant"),
        sourceContext: z.string().max(4000).optional(),
        sourceUrl: z.string().url().optional(),
        projectId: projectIdSchema.optional(),
      }),
      execute: async (input) => {
        const idea = await createIdea(
          {
            ...input,
            projectId: input.projectId ?? options.pinnedProjectId ?? null,
            routeTarget: input.routeTarget ?? null,
            aiSummary: input.aiSummary ?? null,
            aiNextAction: input.aiNextAction ?? null,
            sourceContext: input.sourceContext ?? null,
            sourceUrl: input.sourceUrl ?? null,
            metadata: {
              capture_surface: "ai_assistant",
            },
          },
          userId,
        );

        return {
          success: true,
          ideaId: idea.id,
          title: idea.title,
          status: idea.status,
          priority: idea.priority,
          routeType: idea.route_type,
          detailHref: "/ideas",
        };
      },
    }),

    updateFeatureRequestPacket: defineWriteTool("updateFeatureRequestPacket", options, {
      description:
        "Update an existing AIS feature request packet with clarified scope, acceptance criteria, verification steps, assumptions, Linear draft data, or readiness-relevant details.",
      inputSchema: z.object({
        requestId: featureRequestIdSchema,
        title: z.string().min(2).optional(),
        assistantSummary: z.string().min(5).optional(),
        desiredOutcome: z.string().min(2).optional(),
        affectedUsers: optionalStringArraySchema,
        affectedPages: optionalStringArraySchema,
        affectedWorkflows: optionalStringArraySchema,
        acceptanceCriteria: optionalStringArraySchema,
        verificationSteps: optionalStringArraySchema,
        openQuestions: optionalStringArraySchema,
        assumptions: optionalStringArraySchema,
        priority: z.enum(["low", "medium", "high", "critical"]).optional(),
        linearIssueId: linearIssueIdSchema.optional(),
        linearIssueUrl: z.string().url().optional(),
        linearDraftBody: z.string().min(10).optional(),
      }),
      execute: async (input) => {
        const request = await updateFeatureRequestPacket(input.requestId, {
          ...input,
          updatedBy: userId,
        });
        const detail = await getFeatureRequestDetail(request.id);
        const output = {
          success: true,
          requestId: request.id,
          status: request.status,
          readyForBuild: request.ready_for_build,
          readinessMissingRequirements: request.readiness_missing_requirements,
          widget: buildFeatureRequestPacketWidget({
            request,
            latestPlan: detail?.latestPlan ?? null,
          }),
        };
        return output;
      },
    }),

    scoreFeatureRequestReadiness: defineReadTool("scoreFeatureRequestReadiness", options, {
      description:
        "Score whether a feature request packet is ready for build. Use this before marking anything ready for Claude Code/Codex implementation.",
      inputSchema: z.object({
        requestId: featureRequestIdSchema,
      }),
      errorGuidance: FEATURE_REQUEST_READ_ERROR_GUIDANCE,
      execute: async (input) => {
        const detail = await getFeatureRequestDetail(input.requestId);
        if (!detail) {
          return { success: false, error: `Feature request ${input.requestId} was not found.` };
        }
        const readiness = scoreFeatureRequestReadiness({
          request: detail.request,
          latestPlan: detail.latestPlan,
        });
        const output = {
          success: true,
          requestId: input.requestId,
          ...readiness,
        };
        return output;
      },
    }),

    generateImplementationPlan: defineWriteTool("generateImplementationPlan", options, {
      description:
        "Generate and persist an implementation plan for an AIS feature request packet. This does not make the request ready for build by itself.",
      inputSchema: z.object({
        requestId: featureRequestIdSchema,
        summary: z.string().min(5).optional(),
        affectedRoutes: optionalStringArraySchema,
        affectedComponents: optionalStringArraySchema,
        affectedTables: optionalStringArraySchema,
        dataRequirements: optionalStringArraySchema,
        implementationSteps: optionalStringArraySchema,
        acceptanceCriteria: optionalStringArraySchema,
        verificationSteps: optionalStringArraySchema,
        risks: optionalStringArraySchema,
        openQuestions: optionalStringArraySchema,
      }),
      execute: async (input) => {
        const plan = await generateImplementationPlan({
          requestId: input.requestId,
          input: {
            ...input,
            generatedBy: userId,
          },
        });
        const detail = await getFeatureRequestDetail(input.requestId);
        const output = {
          success: true,
          requestId: input.requestId,
          planId: plan.id,
          version: plan.version,
          widget: detail
            ? buildFeatureRequestPacketWidget({
                request: detail.request,
                latestPlan: plan,
              })
            : null,
        };
        return output;
      },
    }),

    generateClaudeCodeHandoff: defineWriteTool("generateClaudeCodeHandoff", options, {
      description:
        "Generate a Claude Code/Codex handoff markdown file from a feature request packet and latest implementation plan. If readiness is blocked, the handoff must include the missing requirements instead of pretending it is ready.",
      inputSchema: z.object({
        requestId: featureRequestIdSchema,
        sessionLabel: z.string().min(2).default("SAIS"),
      }),
      execute: async (input) => {
        const handoff = await generateClaudeCodeHandoff({
          requestId: input.requestId,
          generatedBy: userId,
          sessionLabel: input.sessionLabel,
        });
        const output = {
          success: true,
          requestId: input.requestId,
          handoffPath: handoff.handoffPath,
          handoffStorage: handoff.storage,
          handoffMarkdown: handoff.storage === "inline" ? handoff.markdown : null,
          readyForBuild: handoff.request.ready_for_build,
          blockedMessage: handoff.blockedMessage,
          widget: buildFeatureRequestPacketWidget({
            request: handoff.request,
            latestPlan: handoff.plan,
          }),
        };
        return output;
      },
    }),

    draftLinearIssueFromFeatureRequest: defineWriteTool("draftLinearIssueFromFeatureRequest", options, {
      description:
        "Generate and persist a Linear parent issue draft from an AIS feature request packet. This only drafts the Linear issue body in the packet; use attachLinearIssueToFeatureRequest after the Linear connector creates the real issue.",
      inputSchema: z.object({
        requestId: featureRequestIdSchema,
      }),
      execute: async (input) => {
        const result = await draftLinearIssueFromFeatureRequest({
          requestId: input.requestId,
          draftedBy: userId,
        });
        const detail = await getFeatureRequestDetail(input.requestId);
        const output = {
          success: true,
          requestId: input.requestId,
          title: result.draft.title,
          body: result.draft.body,
          linearSyncStatus: result.request.linear_sync_status,
          widget: detail
            ? buildFeatureRequestPacketWidget({
                request: detail.request,
                latestPlan: detail.latestPlan,
              })
            : null,
        };
        return output;
      },
    }),

    draftLinearSubIssuesFromImplementationPlan: defineWriteTool("draftLinearSubIssuesFromImplementationPlan", options, {
      description:
        "Generate and persist Linear sub-issue drafts from a feature request's latest implementation plan. Use this when the plan has multiple implementation steps, owners, routes, data changes, or verification slices.",
      inputSchema: z.object({
        requestId: featureRequestIdSchema,
        drafts: z.array(z.object({
          title: z.string().min(2),
          body: z.string().min(10),
          sourceStep: z.string().min(2).optional(),
          sortOrder: z.number().int().nonnegative().optional(),
        })).optional(),
      }),
      execute: async (input) => {
        const drafts = await draftLinearSubIssuesFromImplementationPlan({
          requestId: input.requestId,
          drafts: input.drafts?.map((draft) => ({
            title: draft.title,
            body: draft.body,
            sourceStep: draft.sourceStep ?? null,
            sortOrder: draft.sortOrder,
          })),
          draftedBy: userId,
        });
        const output = {
          success: true,
          requestId: input.requestId,
          subIssues: drafts.map((draft) => ({
            id: draft.id,
            title: draft.title,
            status: draft.status,
            linearIssueUrl: draft.linear_issue_url,
          })),
        };
        return output;
      },
    }),

    attachLinearIssueToFeatureRequest: defineWriteTool("attachLinearIssueToFeatureRequest", options, {
      description:
        "Attach a real Linear issue ID and URL to an AIS feature request packet after the Linear connector creates the issue. Use this to close the loop back to the packet.",
      inputSchema: z.object({
        requestId: featureRequestIdSchema,
        linearIssueId: linearIssueIdSchema,
        linearIssueUrl: z.string().url(),
      }),
      execute: async (input) => {
        const request = await attachLinearIssueToFeatureRequest({
          ...input,
          attachedBy: userId,
        });
        const detail = await getFeatureRequestDetail(input.requestId);
        const output = {
          success: true,
          requestId: input.requestId,
          linearIssueId: request.linear_issue_id,
          linearIssueUrl: request.linear_issue_url,
          linearSyncStatus: request.linear_sync_status,
          widget: detail
            ? buildFeatureRequestPacketWidget({
                request: detail.request,
                latestPlan: detail.latestPlan,
              })
            : null,
        };
        return output;
      },
    }),

    attachLinearSubIssueToFeatureRequest: defineWriteTool("attachLinearSubIssueToFeatureRequest", options, {
      description:
        "Attach a real Linear sub-issue ID and URL to a packet sub-issue draft after the Linear connector creates the Linear child issue.",
      inputSchema: z.object({
        subIssueId: featureSubIssueIdSchema,
        linearIssueId: linearIssueIdSchema,
        linearIssueUrl: z.string().url(),
        linearState: z.string().min(1).optional(),
      }),
      execute: async (input) => {
        const subIssue = await attachLinearSubIssueToFeatureRequest({
          ...input,
          linearState: input.linearState ?? null,
          attachedBy: userId,
        });
        const output = {
          success: true,
          requestId: subIssue.feature_request_id,
          subIssueId: subIssue.id,
          status: subIssue.status,
          linearIssueId: subIssue.linear_issue_id,
          linearIssueUrl: subIssue.linear_issue_url,
        };
        return output;
      },
    }),

    recordLinearStatusUpdateForFeatureRequest: defineWriteTool("recordLinearStatusUpdateForFeatureRequest", options, {
      description:
        "Record a Linear status or comment sync event back onto the AIS feature request packet. Use this after checking Linear so packet history reflects execution state without losing stakeholder context.",
      inputSchema: z.object({
        requestId: featureRequestIdSchema,
        linearIssueId: linearIssueIdSchema.optional(),
        linearState: z.string().min(1).optional(),
        commentBody: z.string().min(1).optional(),
        syncStatus: z.enum(["synced", "blocked"]).optional(),
        syncError: z.string().min(1).optional(),
      }),
      execute: async (input) => {
        const request = await recordLinearStatusUpdateForFeatureRequest({
          requestId: input.requestId,
          linearIssueId: input.linearIssueId ?? null,
          linearState: input.linearState ?? null,
          commentBody: input.commentBody ?? null,
          syncStatus: input.syncStatus,
          syncError: input.syncError ?? null,
          recordedBy: userId,
        });
        const detail = await getFeatureRequestDetail(input.requestId);
        const output = {
          success: true,
          requestId: input.requestId,
          linearSyncStatus: request.linear_sync_status,
          linearLastSyncedAt: request.linear_last_synced_at,
          widget: detail
            ? buildFeatureRequestPacketWidget({
                request: detail.request,
                latestPlan: detail.latestPlan,
              })
            : null,
        };
        return output;
      },
    }),
  };
}
