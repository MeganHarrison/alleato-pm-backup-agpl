import { NextResponse } from "next/server";
import { z } from "zod";

import { requireCurrentUserExecutiveDetail } from "@/lib/executive/executive-visibility";
import { loadCurrentDailyExecutiveBriefPacket } from "@/lib/daily-briefs/canonical-packets";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createRagServiceClient, createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";

const DAILY_DEEP_READ_COMPILER_VERSION = "daily_deep_read_consumers_v1";
const WHERE = "api/executive/daily-deep-read-candidates/[candidateId]#PATCH";

const reviewSchema = z.object({
  action: z.enum(["accept", "reject"]),
  projectId: z.number().int().positive().optional(),
  reviewNotes: z.string().trim().max(2000).optional(),
});

export const PATCH = withApiGuardrails<{ candidateId: string }>(
  WHERE,
  async ({ request, params }) => {
    const { user } = await requireCurrentUserExecutiveDetail(WHERE);
    const { candidateId } = await params;
    const body = await parseJsonBody(request, reviewSchema, WHERE);
    const currentPacket = await loadCurrentDailyExecutiveBriefPacket();
    const ragSupabase = createRagServiceClient();

    const { data: candidate, error: candidateError } = await ragSupabase
      .from("source_signal_candidates")
      .select("id, project_id, status, current_status, compiler_version, extraction_json")
      .eq("id", candidateId)
      .eq("compiler_version", DAILY_DEEP_READ_COMPILER_VERSION)
      .eq("status", "needs_review")
      .eq("extraction_json->>daily_packet_id", currentPacket.id)
      .maybeSingle();

    if (candidateError) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: WHERE,
        message: "Failed to load Daily Deep Read candidate for central review.",
        details: candidateError.message,
      });
    }
    if (!candidate) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: WHERE,
        message:
          "Daily Deep Read candidate was not found for the current packet in needs-review status.",
        status: 404,
        details: { candidateId, packetId: currentPacket.id },
      });
    }

    let assignedProjectId: number | null = null;
    if (body.action === "accept" && typeof body.projectId === "number") {
      const appSupabase = createServiceClient();
      const { data: project, error: projectError } = await serviceDb.from("projects")
        .select("id")
        .eq("id", body.projectId)
        .maybeSingle();
      if (projectError || !project) {
        throw new GuardrailError({
          code: "INVALID_PAYLOAD",
          where: WHERE,
          message: "Assigned project was not found.",
          status: 400,
          details: { projectId: body.projectId, dbError: projectError?.message },
        });
      }
      assignedProjectId = project.id;
    }

    const now = new Date().toISOString();
    const extractionJson =
      candidate.extraction_json &&
      typeof candidate.extraction_json === "object" &&
      !Array.isArray(candidate.extraction_json)
        ? candidate.extraction_json
        : {};

    const { data: updated, error: updateError } = await ragSupabase
      .from("source_signal_candidates")
      .update({
        status: body.action === "accept" ? "candidate" : "rejected",
        current_status: body.action === "accept" ? "open" : "rejected",
        ...(assignedProjectId !== null ? { project_id: assignedProjectId } : {}),
        extraction_json: {
          ...extractionJson,
          ...(assignedProjectId !== null
            ? { project_assignment_method: "central_review_manual_assignment" }
            : {}),
          review: {
            action: body.action,
            reviewed_at: now,
            reviewed_by: user.id,
            review_notes: body.reviewNotes ?? null,
            source: "central_daily_deep_read_review",
            daily_packet_id: currentPacket.id,
            assigned_project_id: assignedProjectId,
          },
        },
      })
      .eq("id", candidate.id)
      .eq("status", "needs_review")
      .select("id, signal_type, title, status, project_id")
      .single();

    if (updateError || !updated) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: WHERE,
        message: `Failed to ${body.action} Daily Deep Read candidate in central review.`,
        details: updateError?.message,
      });
    }

    return NextResponse.json({
      ok: true,
      action: body.action,
      candidate: updated,
      packetId: currentPacket.id,
    });
  },
);
