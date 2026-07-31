import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { GuardrailError } from "@/lib/guardrails/errors";
import { BOARD_STATUSES } from "@/lib/admin-feedback/constants";
import {
  BOARD_CAPTURE_TOPIC_KEYS,
} from "@/features/product-board/topics";
import {
  buildBoardCaptureMetadata,
} from "@/features/product-board/metadata";

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).default(""),
  board_status: z.enum(BOARD_STATUSES).default("submitted"),
  severity: z.enum(["low", "medium", "high"]).default("medium"),
  assignee_id: z.string().uuid().nullable().optional(),
  topics: z.array(z.enum(BOARD_CAPTURE_TOPIC_KEYS)).default([]),
  tool: z.string().trim().max(120).default(""),
  category: z.string().trim().max(120).default(""),
  type: z.string().trim().max(120).optional().nullable(),
});

export const POST = withApiGuardrails("admin/feedback/board/create", async ({ request }) => {
  const user = await getApiRouteUser();
  if (!user) throw new GuardrailError({ code: "FORBIDDEN", where: "board/create", message: "Sign in required.", status: 401 });

  const body = await request.json();
  const { title, description, board_status, severity, assignee_id, topics, tool, category, type } = createSchema.parse(body);
  const metadata = buildBoardCaptureMetadata({ topics, tool, category, type });

  const supabase = createServiceClient();

  // Place at the bottom of the target column
  const { data: maxRow } = await serviceDb.from("admin_feedback_items")
    .select("position")
    .eq("request_type", "feature_request")
    .eq("board_status", board_status)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (maxRow?.position ?? 0) + 1000;

  const { data, error } = await serviceDb.from("admin_feedback_items")
    .insert({
      created_by: user.id,
      title,
      comment: description,
      page_url: "/product-board",
      page_path: "/product-board",
      page_title: "Roadmap",
      request_type: "feature_request",
      board_status,
      severity,
      position,
      assignee_id: assignee_id ?? null,
      status: "open",
      target_selector: "product-board",
      metadata,
    })
    .select("id")
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error("Failed to create feedback item");
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
});
