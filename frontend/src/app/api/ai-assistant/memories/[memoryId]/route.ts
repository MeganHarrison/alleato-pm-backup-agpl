import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import {
  deleteMemory,
  updateMemoryContent,
} from "@/lib/ai/services/ai-memory-service";

/** PATCH /api/ai-assistant/memories/[memoryId] - edit content or importance */
export const PATCH = withApiGuardrails(
  "ai-assistant/memories/[memoryId]#PATCH",
  async ({ request, params }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "ai-assistant/memories/[memoryId]#PATCH",
        message: "Authentication required.",
      });
    }

    const { memoryId } = params as { memoryId: string };
    const body = await request.json();
    const { content, importance } = body as {
      content?: string;
      importance?: number;
    };

    if (!content?.trim() && importance === undefined) {
      return new Response("content or importance is required", { status: 400 });
    }

    const result = await updateMemoryContent(
      user.id,
      memoryId,
      content?.trim(),
      importance,
    );

    if (!result.success) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "ai-assistant/memories/[memoryId]#PATCH",
        message: result.error ?? "Update failed",
      });
    }

    return Response.json({ success: true });
  },
);

/** DELETE /api/ai-assistant/memories/[memoryId] - soft-delete (is_active = false) */
export const DELETE = withApiGuardrails(
  "ai-assistant/memories/[memoryId]#DELETE",
  async ({ params }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "ai-assistant/memories/[memoryId]#DELETE",
        message: "Authentication required.",
      });
    }

    const { memoryId } = params as { memoryId: string };
    const result = await deleteMemory(user.id, memoryId);

    if (!result.success) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "ai-assistant/memories/[memoryId]#DELETE",
        message: result.error ?? "Delete failed",
      });
    }

    return Response.json({ success: true });
  },
);
