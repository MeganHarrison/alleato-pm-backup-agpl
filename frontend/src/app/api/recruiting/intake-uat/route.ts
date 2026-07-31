import { createHash, randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  assertApprovedUatResumeFixture,
  hashRecruitingContact,
  parseUatIntakeFields,
  UAT_CONSENT_VERSION,
  validateUatResume,
} from "@/lib/recruiting/intake-uat";
import { deleteRecruitingUatSubmission } from "@/lib/recruiting/intake-uat-service";
import { requireRecruitingAccess } from "@/lib/recruiting/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
const MAX_MULTIPART_REQUEST_BYTES = 4_400_000;

const createResultSchema = z.object({
  candidateId: z.string().uuid(),
  applicationId: z.string().uuid(),
  documentId: z.string().uuid(),
  expiresAt: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid expiry."),
  storagePath: z.string().min(1),
  replayed: z.boolean(),
});

function validationError(message: string): never {
  throw new GuardrailError({
    code: "VALIDATION_ERROR",
    where: "recruiting/intake-uat",
    message,
    status: 400,
  });
}

function databaseError(action: string, message?: string): never {
  throw new GuardrailError({
    code: "INTERNAL_ERROR",
    where: "recruiting/intake-uat",
    message:
      message ??
      `The test application could not complete while ${action}. Do not retry with real applicant information.`,
  });
}

export const POST = withApiGuardrails(
  "recruiting/intake-uat#POST",
  async ({ request }) => {
    const { db, viewer } = await requireRecruitingAccess("write");
    const settingResult = await db
      .from("recruiting_settings")
      .select("value")
      .eq("key", "public_intake_uat_enabled")
      .maybeSingle();
    if (settingResult.error) {
      databaseError(
        "checking the UAT setting",
        "Candidate intake UAT configuration could not be verified.",
      );
    }
    if (settingResult.data?.value !== true) {
      throw new GuardrailError({
        code: "FORBIDDEN",
        where: "recruiting/intake-uat",
        message: "Candidate intake UAT is not enabled.",
        status: 403,
      });
    }

    const contentLength = Number(request.headers.get("content-length"));
    if (
      !Number.isFinite(contentLength) ||
      contentLength < 1 ||
      contentLength > MAX_MULTIPART_REQUEST_BYTES
    ) {
      validationError("The complete test submission must be 4.4 MB or smaller.");
    }

    const service = createServiceClient();
    const rateLimitResult = await service.rpc(
      "recruiting_consume_uat_rate_limit",
      { p_actor_person_id: viewer.personId },
    );
    if (rateLimitResult.error) {
      databaseError("checking the UAT submission limit");
    }
    if (rateLimitResult.data !== true) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "recruiting/intake-uat",
        message:
          "Candidate intake UAT is limited to 10 attempts per recruiter per hour.",
        status: 429,
      });
    }

    const formData = await request.formData().catch(() => null);
    if (!formData) validationError("The submitted test application is invalid.");
    const resumeValue = formData.get("resume");
    if (
      !resumeValue ||
      typeof resumeValue === "string" ||
      typeof resumeValue.arrayBuffer !== "function"
    ) {
      validationError("Attach the provided synthetic PDF resume.");
    }

    let fields: ReturnType<typeof parseUatIntakeFields>;
    try {
      fields = parseUatIntakeFields({
        firstName: formData.get("firstName"),
        lastName: formData.get("lastName"),
        email: formData.get("email"),
        phone: formData.get("phone") ?? "",
        requisitionId: formData.get("requisitionId"),
        idempotencyKey: formData.get("idempotencyKey"),
        consent: formData.get("consent"),
        website: formData.get("website") ?? "",
      });
    } catch (error) {
      validationError(
        error instanceof Error
          ? error.message
          : "The test application fields are invalid.",
      );
    }

    const bytes = new Uint8Array(await resumeValue.arrayBuffer());
    let resume: Awaited<ReturnType<typeof validateUatResume>>;
    let sha256: string;
    try {
      resume = await validateUatResume({
        name: resumeValue.name,
        type: resumeValue.type,
        size: resumeValue.size,
        bytes,
      });
      sha256 = assertApprovedUatResumeFixture(bytes);
    } catch (error) {
      validationError(
        error instanceof Error ? error.message : "The resume is invalid.",
      );
    }

    const storagePath = `uat/${fields.idempotencyKey}/${randomUUID()}.${resume.extension}`;
    const consentedAt = new Date().toISOString();
    const requestHash = createHash("sha256")
      .update(
        JSON.stringify({
          actorPersonId: viewer.personId,
          requisitionId: fields.requisitionId,
          firstName: fields.firstName,
          lastName: fields.lastName,
          email: fields.email,
          phone: fields.phone,
          originalFileName: resumeValue.name,
          contentType: resume.contentType,
          byteSize: bytes.byteLength,
          sha256,
          consentVersion: UAT_CONSENT_VERSION,
        }),
      )
      .digest("hex");
    const createResult = await service.rpc("recruiting_create_uat_submission", {
      p_idempotency_key: fields.idempotencyKey,
      p_request_hash: requestHash,
      p_actor_person_id: viewer.personId,
      p_requisition_id: fields.requisitionId,
      p_first_name: fields.firstName,
      p_last_name: fields.lastName,
      p_email: fields.email,
      p_email_hash: hashRecruitingContact(fields.email),
      p_phone: fields.phone,
      p_phone_hash: fields.phone ? hashRecruitingContact(fields.phone) : "",
      p_storage_path: storagePath,
      p_original_file_name: resumeValue.name,
      p_content_type: resume.contentType,
      p_byte_size: bytes.byteLength,
      p_sha256: sha256,
      p_consent_version: UAT_CONSENT_VERSION,
      p_consented_at: consentedAt,
    });
    if (createResult.error) {
      const safeMessage = createResult.error.message.includes("limited to 10")
        ? "Candidate intake UAT is limited to 10 submissions per recruiter per hour."
        : createResult.error.message.includes("already exists")
          ? "That test email or phone already exists. Use another reserved UAT value."
          : "The transactional UAT record could not be created.";
      validationError(safeMessage);
    }

    const parsedCreateResult = createResultSchema.safeParse(createResult.data);
    if (!parsedCreateResult.success) {
      const submission = await service
        .from("recruiting_uat_submissions")
        .select("candidate_id, document_id")
        .eq("idempotency_key", fields.idempotencyKey)
        .maybeSingle();
      if (submission.error) {
        databaseError(
          "recovering an invalid transactional result",
          "The UAT transaction returned an invalid result and its cleanup state could not be verified. Candidate intake UAT has been stopped.",
        );
      }
      if (submission.data) {
        const document = await service
          .from("recruiting_documents")
          .select("storage_path")
          .eq("id", submission.data.document_id)
          .maybeSingle();
        if (document.error || !document.data) {
          databaseError(
            "recovering an invalid transactional result",
            "The UAT transaction returned an invalid result and its quarantined file could not be located for cleanup.",
          );
        }
        const cleanup = await deleteRecruitingUatSubmission({
          service,
          actorPersonId: viewer.personId,
          candidateId: submission.data.candidate_id,
          storagePath: document.data.storage_path,
          reason: "failed_verification",
        });
        if (!cleanup.deleted) {
          databaseError(
            "recovering an invalid transactional result",
            "The UAT transaction returned an invalid result and cleanup failed. Candidate intake UAT has been stopped.",
          );
        }
      }
      databaseError("verifying the transactional result");
    }
    const created = parsedCreateResult.data;

    const pathParts = created.storagePath.split("/");
    const fileName = pathParts.pop();
    const directory = pathParts.join("/");
    if (!fileName) databaseError("verifying the quarantine path");
    const listResult = await service.storage
      .from("recruiting-uat-quarantine")
      .list(directory, { limit: 10, search: fileName });
    if (listResult.error) {
      if (!created.replayed) {
        const cleanup = await deleteRecruitingUatSubmission({
          service,
          actorPersonId: viewer.personId,
          candidateId: created.candidateId,
          storagePath: created.storagePath,
          reason: "failed_verification",
          storageAlreadyAbsent: true,
        });
        if (!cleanup.deleted) {
          databaseError(
            "cleaning up after quarantine verification failed",
            "The quarantine bucket could not be verified and database cleanup also failed. Candidate intake UAT has been stopped.",
          );
        }
      }
      databaseError("verifying the quarantine bucket");
    }
    const objectExists = (listResult.data ?? []).some(
      (item) => item.name === fileName,
    );

    if (!objectExists) {
      const uploadResult = await service.storage
        .from("recruiting-uat-quarantine")
        .upload(created.storagePath, bytes, {
          contentType: resume.contentType,
          upsert: false,
        });
      if (uploadResult.error) {
        const cleanup = await deleteRecruitingUatSubmission({
          service,
          actorPersonId: viewer.personId,
          candidateId: created.candidateId,
          storagePath: created.storagePath,
          reason: "failed_upload",
        });
        if (!cleanup.deleted) {
          databaseError(
            "cleaning up a failed upload",
            "The resume upload failed and its database cleanup also failed. Candidate intake UAT has been stopped; contact an administrator with the request ID.",
          );
        }
        databaseError("placing the approved resume in quarantine");
      }
    }

    return NextResponse.json(
      {
        candidateId: created.candidateId,
        applicationId: created.applicationId,
        candidateName: `[UAT] ${fields.firstName} ${fields.lastName}`,
        expiresAt: created.expiresAt,
        resumeStatus: "quarantined" as const,
      },
      { status: created.replayed ? 200 : 201 },
    );
  },
);

export const DELETE = withApiGuardrails(
  "recruiting/intake-uat#DELETE",
  async ({ request }) => {
    const { viewer } = await requireRecruitingAccess("write");
    const candidateId = new URL(request.url).searchParams.get("candidateId");
    if (!candidateId || !z.string().uuid().safeParse(candidateId).success) {
      validationError("A valid UAT candidate ID is required.");
    }

    const service = createServiceClient();
    const submissionResult = await service
      .from("recruiting_uat_submissions")
      .select("document_id, submitted_by_person_id")
      .eq("candidate_id", candidateId)
      .maybeSingle();
    if (submissionResult.error) databaseError("finding the UAT submission");
    if (!submissionResult.data) {
      return NextResponse.json({ deleted: false }, { status: 404 });
    }
    if (
      submissionResult.data.submitted_by_person_id !== viewer.personId &&
      !viewer.canAdmin
    ) {
      throw new GuardrailError({
        code: "FORBIDDEN",
        where: "recruiting/intake-uat",
        message: "Only the submitting recruiter or a recruiting administrator can delete this UAT record.",
        status: 403,
      });
    }
    const documentResult = await service
      .from("recruiting_documents")
      .select("storage_path")
      .eq("id", submissionResult.data.document_id)
      .single();
    if (documentResult.error || !documentResult.data) {
      databaseError("finding the quarantined resume");
    }

    const cleanup = await deleteRecruitingUatSubmission({
      service,
      actorPersonId: viewer.personId,
      candidateId,
      storagePath: documentResult.data.storage_path,
      reason: "manual",
    });
    if (!cleanup.deleted) {
      databaseError("deleting the UAT submission");
    }
    return NextResponse.json({ deleted: true });
  },
);
