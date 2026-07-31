import { NextResponse } from "next/server";
// Dispatched by the consolidated CRM catch-all route.
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { requireCrmAccess } from "@/lib/crm/server";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";

type Params = { candidateId: string };
const BodySchema = z
  .object({
    decision: z.enum(["accept", "reject"]),
    feedback: z.string().trim().max(1000).optional(),
    activity_type: z
      .enum(["call", "email", "meeting", "note"])
      .default("email"),
  })
  .strict()
  .refine(
    (value) => value.decision !== "reject" || Boolean(value.feedback),
    "Rejection feedback is required.",
  );

export const POST = withApiGuardrails<Params>(
  "crm/activity-candidates/[candidateId]/decision#POST",
  async ({ request, params }) => {
    assertNonNilUuid(
      params.candidateId,
      "candidateId",
      "crm/candidates/decision",
    );
    const { db, personId } = await requireCrmAccess("admin");
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/activity-candidates/[candidateId]/decision#POST",
        message:
          parsed.error.issues[0]?.message ?? "Invalid candidate decision.",
        status: 400,
      });
    }
    const { data: candidate, error: candidateError } = await db
      .from("crm_activity_candidates")
      .select("*")
      .eq("id", params.candidateId)
      .eq("status", "pending")
      .maybeSingle();
    if (candidateError) return apiErrorResponse(candidateError);
    if (!candidate) {
      throw new GuardrailError({
        code: "PRECONDITION_FAILED",
        where: "crm/activity-candidates/[candidateId]/decision#POST",
        message: "This candidate is no longer pending.",
        status: 409,
      });
    }

    let acceptedActivityId: string | null = null;
    if (parsed.data.decision === "accept") {
      const { data: source } = candidate.source_document_id
        ? await db
            .from("document_metadata")
            .select("title, date")
            .eq("id", candidate.source_document_id)
            .maybeSingle()
        : { data: null };
      const { data: activity, error: activityError } = await db
        .from("crm_activities")
        .insert({
          company_id: candidate.proposed_company_id,
          activity_type: parsed.data.activity_type,
          subject: source?.title ?? `${candidate.source_system} communication`,
          occurred_at: source?.date ?? new Date().toISOString(),
          created_by_person_id: null,
          record_origin: "auto",
          source_system: candidate.source_system,
          source_external_key: candidate.source_external_key,
          content_hash: candidate.content_hash,
          match_status: "accepted",
          match_confidence: candidate.match_confidence,
          visibility_scope: candidate.visibility_scope,
          source_document_id: candidate.source_document_id,
        })
        .select("id")
        .single();
      if (activityError) return apiErrorResponse(activityError);
      acceptedActivityId = activity.id;
    }

    const { data, error } = await db
      .from("crm_activity_candidates")
      .update({
        status: parsed.data.decision === "accept" ? "accepted" : "rejected",
        accepted_activity_id: acceptedActivityId,
        decided_by_person_id: personId,
        decided_at: new Date().toISOString(),
        decision_feedback: parsed.data.feedback ?? null,
      })
      .eq("id", params.candidateId)
      .eq("status", "pending")
      .select()
      .maybeSingle();
    if (error) return apiErrorResponse(error);
    if (!data) {
      if (acceptedActivityId) {
        await db.from("crm_activities").delete().eq("id", acceptedActivityId);
      }
      throw new GuardrailError({
        code: "PRECONDITION_FAILED",
        where: "crm/activity-candidates/[candidateId]/decision#POST",
        message: "This candidate changed while the decision was being saved.",
        status: 409,
      });
    }
    return NextResponse.json({ data });
  },
);
