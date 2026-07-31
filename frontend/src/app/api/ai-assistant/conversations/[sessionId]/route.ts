import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";
import { apiErrorResponse } from "@/lib/api-error";
import { conversationBelongsToSurface } from "@/lib/ai/chat-surface.server";
import { parseAssistantSurface } from "@/lib/ai/chat-surface";

type RouteParams = { params: Promise<{ sessionId: string }> };

/**
 * PATCH /api/ai-assistant/conversations/[sessionId]
 * Rename and/or pin a conversation.
 * Body: { title?: string, is_pinned?: boolean } — at least one field required.
 */
export const PATCH = withApiGuardrails(
  "ai-assistant/conversations/[sessionId]#PATCH",
  async ({ request, params }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "ai-assistant/conversations/[sessionId]#PATCH",
        message: "Authentication required.",
      });
    }

    const { sessionId } = await params;
    const surface = parseAssistantSurface(
      new URL(request.url).searchParams.get("surface"),
    );
    if (
      !(await conversationBelongsToSurface({
        sessionId,
        userId: user.id,
        surface,
      }))
    ) {
      return NextResponse.json(
        { error: "Conversation not found on this assistant surface." },
        { status: 404 },
      );
    }
    const body = await request.json();

    const update: { title?: string; is_pinned?: boolean } = {};

    if (body.title !== undefined) {
      if (!body.title?.trim()) {
        return NextResponse.json(
          { error: "Title cannot be empty" },
          { status: 400 },
        );
      }
      update.title = body.title.trim();
    }

    if (body.is_pinned !== undefined) {
      if (typeof body.is_pinned !== "boolean") {
        return NextResponse.json(
          { error: "is_pinned must be a boolean" },
          { status: 400 },
        );
      }
      update.is_pinned = body.is_pinned;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: "Provide a title or is_pinned to update" },
        { status: 400 },
      );
    }

    const { error } = await serviceDb
      .from("conversations")
      .update(update)
      .eq("session_id", sessionId)
      .eq("user_id", user.id);

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({ success: true });
  },
);

/**
 * DELETE /api/ai-assistant/conversations/[sessionId]
 * Archive a conversation (soft delete).
 */
export const DELETE = withApiGuardrails(
  "ai-assistant/conversations/[sessionId]#DELETE",
  async ({ request, params }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "ai-assistant/conversations/[sessionId]#DELETE",
        message: "Authentication required.",
      });
    }

    const { sessionId } = await params;
    const surface = parseAssistantSurface(
      new URL(request.url).searchParams.get("surface"),
    );
    if (
      !(await conversationBelongsToSurface({
        sessionId,
        userId: user.id,
        surface,
      }))
    ) {
      return NextResponse.json(
        { error: "Conversation not found on this assistant surface." },
        { status: 404 },
      );
    }

    const { error } = await serviceDb
      .from("conversations")
      .update({ is_archived: true })
      .eq("session_id", sessionId)
      .eq("user_id", user.id);

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({ success: true });
  },
);
