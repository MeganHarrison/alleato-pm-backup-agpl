import { createHash, randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  recruitingUatFeatureRequestSchema,
  recruitingUatFeatureResponseSchema,
  recruitingUatFeatureResultSchema,
} from "@/lib/recruiting/production-contracts";
import { requireRecruitingAccess } from "@/lib/recruiting/server";
import { buildRecruitingUatFeatureResult } from "@/lib/recruiting/uat-feature-tests";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

function fail(message: string, status = 500): never {
  throw new GuardrailError({
    code: status === 400 ? "VALIDATION_ERROR" : "INTERNAL_ERROR",
    where: "recruiting/uat-actions",
    message,
    status,
  });
}

export const POST = withApiGuardrails(
  "recruiting/uat-actions#POST",
  async ({ request }) => {
    const body = await request.json().catch(() => null);
    const parsed = recruitingUatFeatureRequestSchema.safeParse(body);
    if (!parsed.success) {
      fail("Choose a supported Applicant Tracker test action and try again.", 400);
    }

    const { db, viewer } = await requireRecruitingAccess("write");
    const setting = await db
      .from("recruiting_settings")
      .select("value")
      .eq("key", "public_intake_uat_enabled")
      .maybeSingle();
    if (setting.error) {
      fail("Recruiter test mode could not be verified. No test action ran.");
    }
    if (setting.data?.value !== true) {
      throw new GuardrailError({
        code: "FORBIDDEN",
        where: "recruiting/uat-actions",
        message:
          "Recruiter test mode is not enabled. Ask a recruiting administrator to enable synthetic intake UAT.",
        status: 403,
      });
    }

    const requestHash = createHash("sha256")
      .update(
        JSON.stringify({
          action: parsed.data.action,
          applicationId: parsed.data.applicationId,
        }),
      )
      .digest("hex");
    const service = createServiceClient();
    const replay = await service
      .from("recruiting_uat_feature_runs")
      .select("request_hash, result")
      .eq("initiated_by_person_id", viewer.personId)
      .eq("idempotency_key", parsed.data.idempotencyKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (replay.error) {
      fail("The UAT audit log could not be checked. No test action ran.");
    }
    if (replay.data) {
      if (replay.data.request_hash !== requestHash) {
        fail("That test request identifier is already bound to another action.", 400);
      }
      const result = recruitingUatFeatureResultSchema.safeParse(
        replay.data.result,
      );
      if (!result.success) {
        fail("The stored UAT result is invalid. Run a new test action.");
      }
      return NextResponse.json(
        recruitingUatFeatureResponseSchema.parse({
          ok: true,
          result: result.data,
          replayed: true,
        }),
      );
    }

    const submission = await service
      .from("recruiting_uat_submissions")
      .select(
        "id, candidate_id, document_id, assigned_requisition_id, expires_at",
      )
      .eq("submitted_by_person_id", viewer.personId)
      .eq("application_id", parsed.data.applicationId)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (submission.error) {
      fail("The latest synthetic application could not be loaded.");
    }
    if (!submission.data) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "recruiting/uat-actions",
        message:
          "That synthetic UAT application is no longer active. Upload and assign the approved test PDF before retrying.",
        status: 409,
        severity: "medium",
      });
    }

    const [candidate, document, requisition] = await Promise.all([
      service
        .from("recruiting_candidates")
        .select("display_name")
        .eq("id", submission.data.candidate_id)
        .maybeSingle(),
      service
        .from("recruiting_documents")
        .select("original_file_name")
        .eq("id", submission.data.document_id)
        .maybeSingle(),
      submission.data.assigned_requisition_id
        ? service
            .from("recruiting_requisitions")
            .select("title")
            .eq("id", submission.data.assigned_requisition_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (
      candidate.error ||
      document.error ||
      requisition.error ||
      !candidate.data ||
      !document.data
    ) {
      fail(
        "The synthetic resume evidence is incomplete. Upload the approved test PDF again before retrying.",
      );
    }

    const result = buildRecruitingUatFeatureResult({
      action: parsed.data.action,
      runId: randomUUID(),
      subject: {
        candidateName: candidate.data.display_name,
        resumeFileName: document.data.original_file_name,
        requisitionTitle: requisition.data?.title ?? "Unassigned test intake",
        expiresAt: submission.data.expires_at,
      },
    });
    const saved = await service.from("recruiting_uat_feature_runs").insert({
      id: result.runId,
      submission_id: submission.data.id,
      action: parsed.data.action,
      status: result.status,
      idempotency_key: parsed.data.idempotencyKey,
      request_hash: requestHash,
      result,
      initiated_by_person_id: viewer.personId,
      expires_at: submission.data.expires_at,
    });
    if (saved.error?.code === "23505") {
      const concurrentReplay = await service
        .from("recruiting_uat_feature_runs")
        .select("request_hash, result")
        .eq("initiated_by_person_id", viewer.personId)
        .eq("idempotency_key", parsed.data.idempotencyKey)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (
        !concurrentReplay.error &&
        concurrentReplay.data?.request_hash === requestHash
      ) {
        const replayedResult = recruitingUatFeatureResultSchema.safeParse(
          concurrentReplay.data.result,
        );
        if (replayedResult.success) {
          return NextResponse.json(
            recruitingUatFeatureResponseSchema.parse({
              ok: true,
              result: replayedResult.data,
              replayed: true,
            }),
          );
        }
      }
      if (
        !concurrentReplay.error &&
        concurrentReplay.data &&
        concurrentReplay.data.request_hash !== requestHash
      ) {
        fail("That test request identifier is already bound to another action.", 400);
      }
    }
    if (saved.error) {
      fail(
        "The test result could not be written to the UAT audit log. No provider action was sent.",
      );
    }

    return NextResponse.json(
      recruitingUatFeatureResponseSchema.parse({
        ok: true,
        result,
        replayed: false,
      }),
    );
  },
);
