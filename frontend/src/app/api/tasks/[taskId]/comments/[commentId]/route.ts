import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { apiErrorResponse } from "@/lib/api-error";

type Params = { taskId: string; commentId: string };

const PatchBodySchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export const PATCH = withApiGuardrails<Params>(
  "tasks/[taskId]/comments/[commentId]#PATCH",
  async ({ request, params }) => {
    const { taskId, commentId } = await params;
    if (!taskId || !commentId) {
      return NextResponse.json({ error: "Task ID and comment ID required" }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "tasks/[taskId]/comments/[commentId]#PATCH",
        message: "Authentication required.",
      });
    }

    const json = await request.json();
    const parsed = PatchBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("task_comments")
      .update({ body: parsed.data.body })
      .eq("id", commentId)
      .eq("task_id", taskId)
      .eq("author_id", user.id)
      .select("id, body, created_at, updated_at, author_id")
      .single();

    if (error) return apiErrorResponse(error);
    if (!data) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    return NextResponse.json({ comment: data });
  },
);

export const DELETE = withApiGuardrails<Params>(
  "tasks/[taskId]/comments/[commentId]#DELETE",
  async ({ params }) => {
    const { taskId, commentId } = await params;
    if (!taskId || !commentId) {
      return NextResponse.json({ error: "Task ID and comment ID required" }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "tasks/[taskId]/comments/[commentId]#DELETE",
        message: "Authentication required.",
      });
    }

    const { error } = await supabase
      .from("task_comments")
      .delete()
      .eq("id", commentId)
      .eq("task_id", taskId)
      .eq("author_id", user.id);

    if (error) return apiErrorResponse(error);

    return NextResponse.json({ success: true });
  },
);
