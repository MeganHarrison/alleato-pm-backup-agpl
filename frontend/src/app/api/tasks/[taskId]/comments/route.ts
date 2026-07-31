import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { apiErrorResponse } from "@/lib/api-error";

type Params = { taskId: string };

type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author_id: string;
};

type CommentWithAuthor = CommentRow & {
  author: { full_name: string | null; email: string | null } | null;
};

async function attachAuthors(
  supabase: Awaited<ReturnType<typeof createClient>>,
  comments: CommentRow[],
): Promise<CommentWithAuthor[]> {
  if (comments.length === 0) return [];
  const authorIds = Array.from(new Set(comments.map((c) => c.author_id)));
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, full_name, email")
    .in("id", authorIds);

  const profileById = new Map(
    (profiles ?? []).map((p) => [p.id, { full_name: p.full_name, email: p.email }]),
  );

  return comments.map((c) => ({
    ...c,
    author: profileById.get(c.author_id) ?? null,
  }));
}

export const GET = withApiGuardrails<Params>(
  "tasks/[taskId]/comments#GET",
  async ({ params }) => {
    const { taskId } = await params;
    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "tasks/[taskId]/comments#GET",
        message: "Authentication required.",
      });
    }

    const { data, error } = await supabase
      .from("task_comments")
      .select("id, body, created_at, updated_at, author_id")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });

    if (error) return apiErrorResponse(error);

    const comments = await attachAuthors(supabase, (data ?? []) as CommentRow[]);
    return NextResponse.json({ comments });
  },
);

const PostBodySchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty").max(5000),
});

export const POST = withApiGuardrails<Params>(
  "tasks/[taskId]/comments#POST",
  async ({ request, params }) => {
    const { taskId } = await params;
    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "tasks/[taskId]/comments#POST",
        message: "Authentication required.",
      });
    }

    const json = await request.json();
    const parsed = PostBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("task_comments")
      .insert({
        task_id: taskId,
        author_id: user.id,
        body: parsed.data.body,
      })
      .select("id, body, created_at, updated_at, author_id")
      .single();

    if (error) return apiErrorResponse(error);

    const [withAuthor] = await attachAuthors(supabase, [data as CommentRow]);
    return NextResponse.json({ comment: withAuthor }, { status: 201 });
  },
);
