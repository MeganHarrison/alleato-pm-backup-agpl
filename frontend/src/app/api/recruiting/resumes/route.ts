import { NextResponse } from "next/server";
import { z } from "zod";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requireRecruitingAccess } from "@/lib/recruiting/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const documentSchema = z.object({
  id: z.string().uuid(),
  storage_bucket: z.string().min(1),
  storage_path: z.string().min(1),
  scan_status: z.string(),
  document_type: z.literal("resume"),
  original_file_name: z.string().min(1),
});

export const GET = withApiGuardrails(
  "recruiting/resumes#GET",
  async ({ request }) => {
    const documentId = z
      .string()
      .uuid()
      .safeParse(request.nextUrl.searchParams.get("documentId"));
    if (!documentId.success) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "recruiting/resume",
        message: "A valid resume reference is required.",
        status: 400,
      });
    }

    const { db } = await requireRecruitingAccess("read");
    const service = createServiceClient();
    const documentResult = await db
      .from("recruiting_documents")
      .select(
        "id,storage_bucket,storage_path,scan_status,document_type,original_file_name",
      )
      .eq("id", documentId.data)
      .eq("document_type", "resume")
      .maybeSingle();
    const parsedDocument = documentSchema.safeParse(documentResult.data);
    if (documentResult.error || !parsedDocument.success) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "recruiting/resume",
        message: "The resume was not found or you do not have access.",
        status: 404,
      });
    }

    const document = parsedDocument.data;
    const uatResult = await service
      .from("recruiting_uat_submissions")
      .select("document_id")
      .eq("document_id", documentId.data)
      .maybeSingle();
    if (uatResult.error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "recruiting/resume",
        message: "The resume safety status could not be verified.",
      });
    }
    if (!uatResult.data && document.scan_status !== "clean") {
      throw new GuardrailError({
        code: "FORBIDDEN",
        where: "recruiting/resume",
        message: "This resume is unavailable until malware scanning is complete.",
        status: 403,
      });
    }

    const signed = await service.storage
      .from(document.storage_bucket)
      .createSignedUrl(document.storage_path, 60);
    if (signed.error || !signed.data.signedUrl) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "recruiting/resume",
        message: "A short-lived resume link could not be created.",
      });
    }
    return NextResponse.redirect(signed.data.signedUrl, 307);
  },
);
