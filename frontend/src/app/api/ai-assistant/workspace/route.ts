export const dynamic = "force-dynamic";

import { z } from "zod";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import {
  createArtifact,
  listArtifacts,
  updateChangeEventDraftArtifactEdits,
  type ArtifactType,
  type ArtifactStatus,
} from "@/lib/ai/services/workspace-artifact-service";
import {
  CHANGE_REQUEST_SCOPE_OPTIONS,
  CHANGE_REQUEST_TYPE_OPTIONS,
} from "@/lib/ai/workflow-registry";

const changeEventDraftEditsSchema = z.object({
  projectId: z.number().int().positive().nullable().optional(),
  projectName: z.string().trim().nullable().optional(),
  title: z.string().trim().nullable().optional(),
  narrative: z.string().trim().nullable().optional(),
  cause: z.enum(CHANGE_REQUEST_TYPE_OPTIONS).nullable().optional(),
  scope: z.enum(CHANGE_REQUEST_SCOPE_OPTIONS).optional(),
  costImpact: z.string().trim().nullable().optional(),
  scheduleImpact: z.string().trim().nullable().optional(),
  ownerNotified: z.enum(["yes", "no", "unknown"]).optional(),
  supportingDocs: z.array(z.string().trim().min(1)).optional(),
  relatedRecordHints: z.array(z.string().trim().min(1)).optional(),
});

const patchSchema = z.object({
  action: z.literal("update_change_event_draft"),
  sessionId: z.string().uuid(),
  edits: changeEventDraftEditsSchema,
});

/** GET /api/ai-assistant/workspace — list current user's artifacts */
export const GET = withApiGuardrails(
  "ai-assistant/workspace#GET",
  async ({ request }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "ai-assistant/workspace#GET",
        message: "Authentication required.",
      });
    }

    const { searchParams } = new URL(request.url);
    const projectIdParam = searchParams.get("projectId");
    const projectId = projectIdParam ? parseInt(projectIdParam, 10) : undefined;
    const artifactType = searchParams.get("type") as ArtifactType | null;
    const status = searchParams.get("status") as ArtifactStatus | null;
    const sessionId = searchParams.get("sessionId");
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 20;

    const artifacts = await listArtifacts({
      userId: user.id,
      projectId: projectId ?? undefined,
      artifactType: artifactType ?? undefined,
      status: status ?? undefined,
      sessionId: sessionId ?? undefined,
      limit,
    });

    return Response.json({ artifacts });
  },
);

/** POST /api/ai-assistant/workspace — create a new artifact */
export const POST = withApiGuardrails(
  "ai-assistant/workspace#POST",
  async ({ request }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "ai-assistant/workspace#POST",
        message: "Authentication required.",
      });
    }

    const body = await request.json();
    const {
      artifactType,
      title,
      content,
      projectId,
      contextSnapshot,
      sessionId,
      tags,
    } = body as {
      artifactType: ArtifactType;
      title: string;
      content: Record<string, unknown>;
      projectId?: number;
      contextSnapshot?: Record<string, unknown>;
      sessionId?: string;
      tags?: string[];
    };

    if (!artifactType || !title || !content) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "ai-assistant/workspace#POST",
        message: "artifactType, title, and content are required.",
      });
    }

    const result = await createArtifact({
      userId: user.id,
      artifactType,
      title,
      content,
      projectId,
      contextSnapshot,
      sessionId,
      tags,
    });

    if ("error" in result) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: "ai-assistant/workspace#POST",
        message: result.error,
      });
    }

    return Response.json({ id: result.id }, { status: 201 });
  },
);

/** PATCH /api/ai-assistant/workspace — update the current session workspace draft */
export const PATCH = withApiGuardrails(
  "ai-assistant/workspace#PATCH",
  async ({ request }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "ai-assistant/workspace#PATCH",
        message: "Authentication required.",
      });
    }

    const body = await parseJsonBody(
      request,
      patchSchema,
      "ai-assistant/workspace#PATCH",
    );

    const result = await updateChangeEventDraftArtifactEdits({
      userId: user.id,
      sessionId: body.sessionId,
      edits: body.edits,
    });

    if ("error" in result) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: "ai-assistant/workspace#PATCH",
        message: result.error,
      });
    }

    return Response.json({
      ok: true,
      id: result.id,
      version: result.version,
      workflow: result.workflow,
      draft: result.workflow.draft,
    });
  },
);
