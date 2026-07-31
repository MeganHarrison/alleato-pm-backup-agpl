import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { serviceDb } from "@/lib/supabase/service-db";
import type { Json } from "@/types/database.types";
import { BOARD_STATUSES } from "@/lib/admin-feedback/constants";

export const DELETE = withApiGuardrails<{ itemId: string }>(
  "admin/feedback/board/[itemId]#DELETE",
  async ({ params }) => {
        const { error } = await serviceDb.from("admin_feedback_items")
      .delete()
      .eq("id", params.itemId)
      .eq("request_type", "feature_request");
    if (error) throw error;
    return NextResponse.json({ success: true });
  }
);

const patchSchema = z.object({
  board_status: z.enum(BOARD_STATUSES).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  comment: z.string().trim().max(5000).optional(),
  severity: z.enum(["low", "medium", "high"]).optional(),
  position: z.number().optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  screenshot_url: z.string().url().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const PATCH = withApiGuardrails<{ itemId: string }>(
  "admin/feedback/board/[itemId]",
  async ({ request, params }) => {
    const body = await request.json();
    const updates = patchSchema.parse(body);

        let mergedMetadataJson: Json | undefined;

    // Merge metadata if provided — never overwrite the whole object
    if (updates.metadata) {
      const { data: existing } = await serviceDb.from("admin_feedback_items")
        .select("metadata")
        .eq("id", params.itemId)
        .single();

      mergedMetadataJson = {
        ...(existing?.metadata as Record<string, unknown> ?? {}),
        ...updates.metadata,
      } as Json;
    }

    const { error } = await serviceDb.from("admin_feedback_items")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
        ...(mergedMetadataJson === undefined ? {} : { metadata: mergedMetadataJson }),
      } as Record<string, unknown>)
      .eq("id", params.itemId)
      .eq("request_type", "feature_request");

    if (error) throw error;

    return NextResponse.json({ success: true });
  }
);
