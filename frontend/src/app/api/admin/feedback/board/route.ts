import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { serviceDb } from "@/lib/supabase/service-db";

export const dynamic = "force-dynamic";

export const GET = withApiGuardrails("admin/feedback/board", async () => {

  const { data, error } = await serviceDb.from("admin_feedback_items")
    .select(
      `id, title, comment, request_type, board_status, severity, position,
       created_at, page_title, page_path, created_by, metadata, assignee_id, screenshot_url,
       assignee:user_profiles!assignee_id (id, full_name, email),
       submitter:user_profiles!created_by (id, full_name, email),
       comment_count:admin_feedback_comments(count)`
    )
    .eq("request_type", "feature_request")
    .order("board_status")
    .order("position", { ascending: true });

  if (error) throw error;

  // Flatten comment_count from [{count: n}] → n
  const items = (data ?? []).map((item) => ({
    ...item,
    comment_count: Array.isArray(item.comment_count)
      ? (item.comment_count[0] as { count: number } | undefined)?.count ?? 0
      : 0,
  }));

  return NextResponse.json({ items });
});
