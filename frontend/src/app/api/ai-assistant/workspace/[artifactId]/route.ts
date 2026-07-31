export const dynamic = "force-dynamic";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import {
  getArtifact,
  updateArtifact,
  archiveArtifact,
  promoteArtifact,
  type ArtifactStatus,
  type PromoteTarget,
} from "@/lib/ai/services/workspace-artifact-service";

/** GET /api/ai-assistant/workspace/[artifactId] — get a single artifact */
export const GET = withApiGuardrails(
  "ai-assistant/workspace/[artifactId]#GET",
  async ({ params }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "ai-assistant/workspace/[artifactId]#GET",
        message: "Authentication required.",
      });
    }

    const { artifactId } = params as { artifactId: string };

    const artifact = await getArtifact(artifactId, user.id);
    if (!artifact) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "ai-assistant/workspace/[artifactId]#GET",
        message: `Artifact ${artifactId} not found.`,
      });
    }

    return Response.json({ artifact });
  },
);

/** PATCH /api/ai-assistant/workspace/[artifactId] — update, archive, or promote */
export const PATCH = withApiGuardrails(
  "ai-assistant/workspace/[artifactId]#PATCH",
  async ({ request, params }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "ai-assistant/workspace/[artifactId]#PATCH",
        message: "Authentication required.",
      });
    }

    const { artifactId } = params as { artifactId: string };
    const body = await request.json();
    const {
      content,
      title,
      status,
      contextSnapshot,
      tags,
      sessionId,
      action,
      promoteTo,
    } = body as {
      content?: Record<string, unknown>;
      title?: string;
      status?: ArtifactStatus;
      contextSnapshot?: Record<string, unknown>;
      tags?: string[];
      sessionId?: string | null;
      action?: string;
      promoteTo?: PromoteTarget;
    };

    if (action === "archive") {
      const result = await archiveArtifact(artifactId, user.id);
      if ("error" in result) {
        throw new GuardrailError({
          code: "DB_ERROR",
          where: "ai-assistant/workspace/[artifactId]#PATCH",
          message: result.error,
        });
      }
      return Response.json({ ok: true, action: "archived" });
    }

    if (action === "promote") {
      if (!promoteTo) {
        throw new GuardrailError({
          code: "VALIDATION_ERROR",
          where: "ai-assistant/workspace/[artifactId]#PATCH",
          message: "promoteTo is required when action is 'promote'.",
        });
      }
      const result = await promoteArtifact(artifactId, user.id, promoteTo);
      if ("error" in result) {
        throw new GuardrailError({
          code: "DB_ERROR",
          where: "ai-assistant/workspace/[artifactId]#PATCH",
          message: result.error,
        });
      }
      return Response.json({ ok: true, action: "promoted", promotedTo: promoteTo });
    }

    // Default: update
    const result = await updateArtifact(artifactId, user.id, {
      content,
      title,
      status,
      contextSnapshot,
      tags,
      sessionId,
    });

    if ("error" in result) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: "ai-assistant/workspace/[artifactId]#PATCH",
        message: result.error,
      });
    }

    return Response.json({ ok: true, id: result.id, version: result.version });
  },
);

/** DELETE /api/ai-assistant/workspace/[artifactId] — hard delete */
export const DELETE = withApiGuardrails(
  "ai-assistant/workspace/[artifactId]#DELETE",
  async ({ params }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "ai-assistant/workspace/[artifactId]#DELETE",
        message: "Authentication required.",
      });
    }

    const { artifactId } = params as { artifactId: string };

    // Lazy import to comply with Build Crash Prevention Gate (Rule 17)
    const { createServiceClient } = await import("@/lib/supabase/service");
    const supabase = createServiceClient();

    const { error } = await supabase
      .from("workspace_artifacts")
      .delete()
      .eq("id", artifactId)
      .eq("user_id", user.id);

    if (error) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: "ai-assistant/workspace/[artifactId]#DELETE",
        message: error.message,
      });
    }

    return Response.json({ ok: true });
  },
);
