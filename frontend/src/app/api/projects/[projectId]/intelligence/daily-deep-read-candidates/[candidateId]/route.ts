import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { loadCurrentDailyExecutiveBriefPacket } from "@/lib/daily-briefs/canonical-packets";
import { createRagServiceClient } from "@/lib/supabase/service";
import { isAuthError, verifyProjectAccess } from "@/lib/supabase/auth-guard";

const DAILY_DEEP_READ_COMPILER_VERSION = "daily_deep_read_consumers_v1";

const reviewSchema = z.object({
  action: z.enum(["accept", "reject"]),
  reviewNotes: z.string().trim().max(2000).optional(),
});

function parseProjectId(value: string, where: string): number {
  const projectId = Number(value);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where,
      message: "Project id must be a positive integer.",
      status: 400,
      details: { projectId: value },
    });
  }
  return projectId;
}

// Returns (rather than throws) the GuardrailError so callers can write
// `throw await buildAuthGuardrailError(...)` — a real `throw` statement,
// which TS's control-flow analysis narrows correctly afterward. Awaiting a
// Promise<never>-returning function as a bare statement does not reliably
// mark the following code unreachable.
async function buildAuthGuardrailError(
  response: NextResponse,
  where: string,
): Promise<GuardrailError> {
  const payload = await response.json().catch(() => null);
  const message =
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
      ? payload.error
      : "Project access denied.";

  return new GuardrailError({
    code: response.status === 401 ? "UNAUTHORIZED" : "AUTH_FORBIDDEN",
    where,
    message,
    status: response.status,
  });
}

export const PATCH = withApiGuardrails<{
  projectId: string;
  candidateId: string;
}>(
  "projects/[projectId]/intelligence/daily-deep-read-candidates/[candidateId]#PATCH",
  async ({ request, params }) => {
    const where =
      "projects/[projectId]/intelligence/daily-deep-read-candidates/[candidateId]#PATCH";
    const { projectId, candidateId } = await params;
    const numericProjectId = parseProjectId(projectId, where);
    const auth = await verifyProjectAccess(numericProjectId);
    if (isAuthError(auth)) throw await buildAuthGuardrailError(auth, where);

    const body = await parseJsonBody(request, reviewSchema, where);
    const currentPacket = await loadCurrentDailyExecutiveBriefPacket();
    const ragSupabase = createRagServiceClient();

    const { data: candidate, error: candidateError } = await ragSupabase
      .from("source_signal_candidates")
      .select(
        "id, project_id, status, current_status, compiler_version, extraction_json",
      )
      .eq("id", candidateId)
      .eq("project_id", numericProjectId)
      .eq("compiler_version", DAILY_DEEP_READ_COMPILER_VERSION)
      .eq("status", "needs_review")
      .eq("extraction_json->>daily_packet_id", currentPacket.id)
      .maybeSingle();

    if (candidateError) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where,
        message: "Failed to load Daily Deep Read candidate for review.",
        details: candidateError.message,
      });
    }

    if (!candidate) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where,
        message:
          "Daily Deep Read candidate was not found for this project, current packet, and needs-review status.",
        status: 404,
        details: {
          candidateId,
          projectId: numericProjectId,
          packetId: currentPacket.id,
        },
      });
    }

    const now = new Date().toISOString();
    const nextStatus = body.action === "accept" ? "candidate" : "rejected";
    const nextCurrentStatus = body.action === "accept" ? "open" : "rejected";
    const extractionJson =
      candidate.extraction_json &&
      typeof candidate.extraction_json === "object" &&
      !Array.isArray(candidate.extraction_json)
        ? candidate.extraction_json
        : {};

    const { data: updated, error: updateError } = await ragSupabase
      .from("source_signal_candidates")
      .update({
        status: nextStatus,
        current_status: nextCurrentStatus,
        extraction_json: {
          ...extractionJson,
          review: {
            action: body.action,
            reviewed_at: now,
            reviewed_by: auth.membership.authUserId,
            review_notes: body.reviewNotes ?? null,
            source: "project_intelligence_daily_deep_read_review",
            daily_packet_id: currentPacket.id,
          },
        },
      })
      .eq("id", candidate.id)
      .eq("status", "needs_review")
      .select(
        "id, signal_type, title, summary, why_it_matters, status, confidence, next_action, excerpt, extraction_json, created_at",
      )
      .single();

    if (updateError || !updated) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where,
        message: `Failed to ${body.action} Daily Deep Read candidate.`,
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
