import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import {
  getUserMemories,
  writeMemory,
  type MemoryType,
  type MemoryVisibility,
} from "@/lib/ai/services/ai-memory-service";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";

/** GET /api/ai-assistant/memories — list the current user's memories */
export const GET = withApiGuardrails(
  "ai-assistant/memories#GET",
  async ({ request }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "ai-assistant/memories#GET",
        message: "Authentication required.",
      });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as MemoryType | null;
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    const result = await getUserMemories(user.id, {
      type: type ?? undefined,
      limit,
      offset,
    });

    return Response.json(result);
  },
);

/** POST /api/ai-assistant/memories — manually create a memory */
export const POST = withApiGuardrails(
  "ai-assistant/memories#POST",
  async ({ request }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "ai-assistant/memories#POST",
        message: "Authentication required.",
      });
    }

    const body = await request.json();
    const { type, content, projectId, importance, confidence, visibility } = body as {
      type: MemoryType;
      content: string;
      projectId?: number;
      importance?: number;
      confidence?: number;
      visibility?: MemoryVisibility;
    };

    if (!type || !content?.trim()) {
      return new Response("type and content are required", { status: 400 });
    }

    const result = await writeMemory({
      userId: user.id,
      type,
      content: content.trim(),
      projectId,
      importance,
      confidence,
      visibility,
      source: "manual",
    });

    if ("error" in result) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "ai-assistant/memories#POST",
        message: result.error,
      });
    }

    return Response.json(result);
  },
);

/** DELETE /api/ai-assistant/memories — clear the current user's active memories */
export const DELETE = withApiGuardrails(
  "ai-assistant/memories#DELETE",
  async () => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "ai-assistant/memories#DELETE",
        message: "Authentication required.",
      });
    }

    const supabase = createServiceClient();
    const { error } = await serviceDb.from("ai_memories")
      .update({ is_active: false })
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "ai-assistant/memories#DELETE",
        message: error.message,
      });
    }

    return Response.json({ success: true });
  },
);
