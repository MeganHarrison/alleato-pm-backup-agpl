import { createHash, randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  assertApprovedUatResumeFixture,
  deriveUatBatchFileIdempotencyKey,
  hashRecruitingContact,
  UAT_CONSENT_VERSION,
  validateUatResume,
} from "@/lib/recruiting/intake-uat";
import { deleteRecruitingUatSubmission } from "@/lib/recruiting/intake-uat-service";
import { ensureUatResumeObject } from "@/lib/recruiting/intake-uat-storage";
import { requireRecruitingAccess } from "@/lib/recruiting/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const MAX_FILES = 10;
const MAX_MULTIPART_REQUEST_BYTES = 4_400_000;
const createResultSchema = z.object({
  candidateId: z.string().uuid(),
  applicationId: z.string().uuid().nullable(),
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
    where: "recruiting/intake-batch-uat",
    message,
    status: 400,
  });
}

function safeUploadFailureMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "The file could not be uploaded.";
  }

  const approvedMessages = [
    "The resume must be",
    "The file does not contain",
    "Only the provided",
    "The hourly synthetic",
    "The file could not be placed",
    "Upload and cleanup both failed",
  ];
  if (approvedMessages.some((prefix) => error.message.startsWith(prefix))) {
    return error.message;
  }

  return "The file could not be added. Retry it or contact an administrator.";
}

export const POST = withApiGuardrails(
  "recruiting/intake-batch-uat#POST",
  async ({ request }) => {
    const { db, viewer } = await requireRecruitingAccess("write");
    const setting = await db
      .from("recruiting_settings")
      .select("value")
      .eq("key", "public_intake_uat_enabled")
      .maybeSingle();
    if (setting.error || setting.data?.value !== true) {
      throw new GuardrailError({
        code: "FORBIDDEN",
        where: "recruiting/intake-batch-uat",
        message: "Recruiter resume intake testing is not enabled.",
        status: 403,
      });
    }

    const contentLength = Number(request.headers.get("content-length"));
    if (
      !Number.isFinite(contentLength) ||
      contentLength < 1 ||
      contentLength > MAX_MULTIPART_REQUEST_BYTES
    ) {
      validationError("The complete batch must be 4.4 MB or smaller.");
    }
    const formData = await request.formData().catch(() => null);
    if (!formData) validationError("The resume batch is invalid.");
    const files = formData
      .getAll("resumes")
      .filter(
        (value): value is File =>
          typeof value !== "string" &&
          typeof value.arrayBuffer === "function",
      );
    if (files.length < 1 || files.length > MAX_FILES) {
      validationError("Select between 1 and 10 synthetic PDF resumes.");
    }
    const batchIdResult = z
      .string()
      .uuid()
      .safeParse(request.headers.get("x-recruiting-batch-idempotency-key"));
    if (!batchIdResult.success) {
      validationError("A valid batch retry key is required.");
    }

    const service = createServiceClient();
    const batchId = batchIdResult.data;
    const results: Array<{
      fileName: string;
      candidateId?: string;
      status: "uploaded" | "failed";
      message: string;
    }> = [];
    for (const [index, file] of files.entries()) {
      const sequence = index + 1;
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const resume = await validateUatResume({
          name: file.name,
          type: file.type,
          size: file.size,
          bytes,
        });
        const sha256 = assertApprovedUatResumeFixture(bytes);
        const idempotencyKey = deriveUatBatchFileIdempotencyKey({
          batchId,
          sequence,
          sha256,
        });
        const existing = await service
          .from("recruiting_uat_submissions")
          .select("id")
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();
        if (existing.error) {
          throw new Error("The batch retry state could not be verified.");
        }
        if (!existing.data) {
          const rateLimit = await service.rpc(
            "recruiting_consume_uat_rate_limit",
            { p_actor_person_id: viewer.personId },
          );
          if (rateLimit.error || rateLimit.data !== true) {
            throw new Error(
              "The hourly synthetic intake limit has been reached.",
            );
          }
        }
        const storagePath = `uat/${idempotencyKey}/${randomUUID()}.${resume.extension}`;
        const email = `recruiting+uat-${batchId.slice(0, 8)}-${sequence}@alleatogroup.com`;
        const consentedAt = new Date().toISOString();
        const requestHash = createHash("sha256")
          .update(
            JSON.stringify({
              actorPersonId: viewer.personId,
              batchId,
              sequence,
              email,
              originalFileName: file.name,
              contentType: resume.contentType,
              byteSize: bytes.byteLength,
              sha256,
            }),
          )
          .digest("hex");
        const createResult = await service.rpc(
          "recruiting_create_unassigned_uat_submission",
          {
            p_idempotency_key: idempotencyKey,
            p_request_hash: requestHash,
            p_actor_person_id: viewer.personId,
            p_batch_id: batchId,
            p_batch_sequence: sequence,
            p_email: email,
            p_email_hash: hashRecruitingContact(email),
            p_storage_path: storagePath,
            p_original_file_name: file.name,
            p_content_type: resume.contentType,
            p_byte_size: bytes.byteLength,
            p_sha256: sha256,
            p_consent_version: UAT_CONSENT_VERSION,
            p_consented_at: consentedAt,
          },
        );
        if (createResult.error) throw new Error(createResult.error.message);
        const created = createResultSchema.parse(createResult.data);

        try {
          await ensureUatResumeObject({
            bucket: service.storage.from("recruiting-uat-quarantine"),
            storagePath: created.storagePath,
            bytes,
            contentType: resume.contentType,
          });
        } catch {
          const cleanup = await deleteRecruitingUatSubmission({
            service,
            actorPersonId: viewer.personId,
            candidateId: created.candidateId,
            storagePath: created.storagePath,
            reason: "failed_upload",
          });
          if (!cleanup.deleted) {
            throw new Error(
              "Upload and cleanup both failed. Contact an administrator.",
            );
          }
          throw new Error("The file could not be placed in quarantine.");
        }
        results.push({
          fileName: file.name,
          candidateId: created.candidateId,
          status: "uploaded",
          message: "Added to the unassigned resume inbox.",
        });
      } catch (error) {
        results.push({
          fileName: file.name,
          status: "failed",
          message: safeUploadFailureMessage(error),
        });
      }
    }

    return NextResponse.json(
      {
        batchId,
        uploaded: results.filter((item) => item.status === "uploaded").length,
        failed: results.filter((item) => item.status === "failed").length,
        results,
      },
      { status: results.some((item) => item.status === "uploaded") ? 201 : 200 },
    );
  },
);
