import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { GuardrailError } from "@/lib/guardrails/errors";

type Params = { itemId: string };

export const GET = withApiGuardrails<Params>(
  "admin/feedback/board/[itemId]/comments#GET",
  async ({ params }) => {
    const supabase = createServiceClient();

    const { data, error } = await serviceDb.from("admin_feedback_comments")
      .select(`
        id,
        body,
        created_at,
        author_id,
        screenshot_url,
        user_profiles!author_id (full_name, email)
      `)
      .eq("feedback_item_id", params.itemId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ comments: data ?? [] });
  }
);

const postSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  screenshot_url: z.string().url().nullable().optional(),
});

export const POST = withApiGuardrails<Params>(
  "admin/feedback/board/[itemId]/comments#POST",
  async ({ request, params }) => {
    const user = await getApiRouteUser();
    if (!user) throw new GuardrailError({ code: "FORBIDDEN", where: "board/comments#POST", message: "Sign in required.", status: 401 });

    const body = await request.json();
    const parsed = postSchema.parse(body);

    const supabase = createServiceClient();
    const { data, error } = await serviceDb.from("admin_feedback_comments")
      .insert({
        feedback_item_id: params.itemId,
        author_id: user.id,
        body: parsed.body,
        screenshot_url: parsed.screenshot_url ?? null,
      })
      .select(`id, body, created_at, author_id, screenshot_url, user_profiles!author_id (full_name, email)`)
      .single();

    if (error) throw error;

    return NextResponse.json({ comment: data }, { status: 201 });
  }
);
