import { tool } from "ai";
import { z } from "zod";
import { type ToolTracePayload, withTrace as _withTrace } from "./tool-utils";
import {
  listArtifacts,
  getArtifact,
  searchArtifacts,
  createArtifact,
  updateArtifact,
  archiveArtifact,
  promoteArtifact,
  type ArtifactType,
  type ArtifactStatus,
  type PromoteTarget,
} from "@/lib/ai/services/workspace-artifact-service";

// ---------------------------------------------------------------------------
// Local withTrace wrapper with workspace-specific fallback guidance
// ---------------------------------------------------------------------------

const WORKSPACE_ERROR_GUIDANCE =
  "The workspace tool failed. You can continue without draft context.";

function withTrace<TInput extends Record<string, unknown>, TResult>(
  name: string,
  options: { onTrace?: (trace: ToolTracePayload) => void },
  execute: (input: TInput) => Promise<TResult>,
) {
  return _withTrace(name, options, execute, WORKSPACE_ERROR_GUIDANCE);
}

// ---------------------------------------------------------------------------
// Shared Zod enums
// ---------------------------------------------------------------------------

const artifactTypeEnum = z.enum([
  "owner_update",
  "risk_report",
  "meeting_prep",
  "analysis",
  "briefing",
  "note",
  "change_event_draft",
]);

const artifactStatusEnum = z.enum(["draft", "final", "archived", "promoted"]);

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createWorkspaceTools(
  userId: string,
  options: { onTrace?: (trace: ToolTracePayload) => void } = {},
) {
  // -------------------------------------------------------------------------
  // Tool 1: listWorkspaceArtifacts
  // -------------------------------------------------------------------------

  const listWorkspaceArtifacts = tool({
    description:
      "List the user's work-in-progress drafts and saved artifacts. Use at the start of a work session to see what has already been drafted. Filter by project or artifact type to narrow the results.",
    inputSchema: z.object({
      projectId: z.number().optional().describe("Filter by project ID"),
      artifactType: artifactTypeEnum
        .optional()
        .describe(
          "Filter by artifact type: owner_update, risk_report, meeting_prep, analysis, briefing, note, or change_event_draft",
        ),
      status: artifactStatusEnum
        .optional()
        .describe("Filter by status: draft, final, archived, or promoted"),
      limit: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .default(10)
        .describe("Maximum number of artifacts to return (1–50, default 10)"),
    }),
    execute: withTrace(
      "listWorkspaceArtifacts",
      options,
      async ({
        projectId,
        artifactType,
        status,
        limit,
      }: {
        projectId?: number;
        artifactType?: ArtifactType;
        status?: ArtifactStatus;
        limit?: number;
      }) => {
        const artifacts = await listArtifacts({
          userId,
          projectId: projectId ?? undefined,
          artifactType,
          status,
          limit: limit ?? 10,
        });

        const mapped = artifacts.map((a) => ({
          id: a.id,
          type: a.artifact_type,
          title: a.title,
          status: a.status,
          version: a.version,
          projectId: a.project_id,
          tags: a.tags,
          lastEdited: a.updated_at,
        }));

        return {
          artifacts: mapped,
          count: mapped.length,
          ...(mapped.length === 0 && { message: "No workspace artifacts found for the given filters." }),
        };
      },
    ),
  });

  // -------------------------------------------------------------------------
  // Tool 2: getDraftArtifact
  // -------------------------------------------------------------------------

  const getDraftArtifact = tool({
    description:
      "Retrieve the full content of a workspace draft by ID or by natural language search query. Always call this before editing an existing draft so you have the current content.",
    inputSchema: z.object({
      artifactId: z
        .string()
        .uuid()
        .optional()
        .describe("The UUID of the artifact to retrieve directly"),
      searchQuery: z
        .string()
        .optional()
        .describe(
          "Natural language query to find the most relevant artifact by semantic search",
        ),
      projectId: z
        .number()
        .optional()
        .describe("Optional project scope for the search query"),
    }),
    execute: withTrace(
      "getDraftArtifact",
      options,
      async ({
        artifactId,
        searchQuery,
        projectId,
      }: {
        artifactId?: string;
        searchQuery?: string;
        projectId?: number;
      }) => {
        if (artifactId) {
          const artifact = await getArtifact(artifactId, userId);
          if (!artifact) {
            return { error: `Artifact ${artifactId} not found.` };
          }
          return { artifact };
        }

        if (searchQuery) {
          const results = await searchArtifacts({
            userId,
            query: searchQuery,
            projectId: projectId ?? undefined,
            matchCount: 3,
          });

          if (results.length === 0) {
            return {
              error: `No artifact found matching: "${searchQuery}"`,
            };
          }

          return {
            artifact: results[0],
            alternatives: results.slice(1).map((a) => ({
              id: a.id,
              title: a.title,
              type: a.artifact_type,
            })),
          };
        }

        return { error: "Provide either artifactId or searchQuery." };
      },
    ),
  });

  // -------------------------------------------------------------------------
  // Tool 3: saveWorkspaceArtifact
  // -------------------------------------------------------------------------

  const saveWorkspaceArtifact = tool({
    description:
      "Save a work-in-progress draft. If artifactId is provided, updates the existing artifact and increments its version. Otherwise creates a new artifact. Always save drafts before ending a multi-part work session.",
    inputSchema: z.object({
      artifactId: z
        .string()
        .uuid()
        .optional()
        .describe("Omit to create a new artifact; provide to update an existing one"),
      artifactType: artifactTypeEnum.describe(
        "Type of artifact: owner_update, risk_report, meeting_prep, analysis, briefing, note, or change_event_draft",
      ),
      title: z.string().describe("Short descriptive title for the artifact"),
      content: z
        .record(z.string(), z.unknown())
        .describe(
          "JSON object with type-specific structure. For owner_update: { summary, highlights, risks, next_steps }. For risk_report: { risks: [{title, severity, mitigation}] }. For meeting_prep: { agenda, talking_points, questions }. For analysis: { findings, recommendations }. For briefing: { body }. For note: { text }. For change_event_draft: { workflow, draft, readiness }.",
        ),
      projectId: z.number().optional().describe("Associated project ID"),
      status: z
        .enum(["draft", "final"])
        .optional()
        .default("draft")
        .describe("draft (default) or final"),
      contextSnapshot: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("Optional snapshot of conversation context at save time"),
      tags: z.array(z.string()).optional().describe("Optional tags for categorization"),
      sessionId: z.string().optional().describe("Optional conversation session ID"),
    }),
    execute: withTrace(
      "saveWorkspaceArtifact",
      options,
      async ({
        artifactId,
        artifactType,
        title,
        content,
        projectId,
        status,
        contextSnapshot,
        tags,
        sessionId,
      }: {
        artifactId?: string;
        artifactType: ArtifactType;
        title: string;
        content: Record<string, unknown>;
        projectId?: number;
        status?: "draft" | "final";
        contextSnapshot?: Record<string, unknown>;
        tags?: string[];
        sessionId?: string;
      }) => {
        if (artifactId) {
          const result = await updateArtifact(artifactId, userId, {
            title,
            content,
            status,
            contextSnapshot,
            tags,
            sessionId,
          });

          if ("error" in result || !result.id) {
            return { error: "error" in result ? result.error : "Unknown update error" };
          }

          return {
            saved: true,
            artifactId: result.id,
            version: result.version,
            action: "updated" as const,
          };
        }

        const result = await createArtifact({
          userId,
          artifactType,
          title,
          content,
          projectId: projectId ?? undefined,
          status,
          contextSnapshot,
          tags,
          sessionId,
        });

        if ("error" in result) {
          return { error: result.error };
        }

        return {
          saved: true,
          artifactId: result.id,
          version: 1,
          action: "created" as const,
        };
      },
    ),
  });

  // -------------------------------------------------------------------------
  // Tool 4: promoteWorkspaceArtifact
  // -------------------------------------------------------------------------

  const promoteWorkspaceArtifact = tool({
    description:
      "Promote a finalized artifact to a permanent destination (ai_memories, progress_report, or initiative), or archive a draft that is no longer needed.",
    inputSchema: z.object({
      artifactId: z.string().uuid().describe("UUID of the artifact to act on"),
      action: z
        .enum(["promote", "archive"])
        .describe("promote moves it to a permanent destination; archive marks it inactive"),
      promoteTo: z
        .enum(["ai_memories", "progress_report", "initiative"])
        .optional()
        .describe("Required when action is 'promote': destination for the artifact"),
    }),
    execute: withTrace(
      "promoteWorkspaceArtifact",
      options,
      async ({
        artifactId,
        action,
        promoteTo,
      }: {
        artifactId: string;
        action: "promote" | "archive";
        promoteTo?: PromoteTarget;
      }) => {
        if (action === "archive") {
          const result = await archiveArtifact(artifactId, userId);
          if ("error" in result) {
            return { error: result.error };
          }
          return { ok: true, action: "archived" as const, artifactId };
        }

        // action === "promote"
        if (!promoteTo) {
          return { error: "promoteTo is required when action is 'promote'" };
        }

        const result = await promoteArtifact(artifactId, userId, promoteTo);

        if ("error" in result) {
          return { error: result.error };
        }

        return {
          ok: true,
          action: "promoted" as const,
          artifactId,
          promotedTo: promoteTo,
        };
      },
    ),
  });

  // -------------------------------------------------------------------------
  // Return tool map
  // -------------------------------------------------------------------------

  return {
    listWorkspaceArtifacts,
    getDraftArtifact,
    saveWorkspaceArtifact,
    promoteWorkspaceArtifact,
  };
}
