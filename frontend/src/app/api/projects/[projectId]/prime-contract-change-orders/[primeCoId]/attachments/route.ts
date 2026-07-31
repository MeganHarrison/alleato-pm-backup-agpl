import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import {
  listLinkedPatternCDocuments,
  uploadAndLinkPatternCDocument,
} from "@/lib/documents/pattern-c-attachments";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requirePermission } from "@/lib/permissions-guard";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

async function verifyPrimeContractChangeOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: number,
  primeCoId: number,
) {
  const { data: pcco, error: pccoError } = await supabase
    .from("prime_contract_change_orders")
    .select("id")
    .eq("id", primeCoId)
    .eq("project_id", projectId)
    .single();

  return !pccoError && !!pcco;
}

export const GET = withApiGuardrails(
  "projects/[projectId]/prime-contract-change-orders/[primeCoId]/attachments#GET",
  async ({ params }) => {
    const { projectId, primeCoId } = await params;
    const projectIdNum = Number(projectId);
    const primeCoIdNum = Number(primeCoId);
    const supabase = await createClient();
    const serviceClient = createServiceClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/prime-contract-change-orders/[primeCoId]/attachments#GET", message: "Authentication required." });
    }

    if (!(await verifyPrimeContractChangeOrder(supabase, projectIdNum, primeCoIdNum))) {
      return NextResponse.json({ error: "Change order not found" }, { status: 404 });
    }

    try {
      const attachments = await listLinkedPatternCDocuments({
        supabase,
        serviceClient,
        entityType: "prime_contract_change_order",
        entityId: primeCoId,
      });

      return NextResponse.json({
        data: attachments.map((attachment) => ({
          id: attachment.document_metadata_id,
          fileName: attachment.file_name ?? attachment.title,
          filePath: attachment.file_path,
          fileSize: attachment.source_size,
          mimeType: attachment.mime_type,
          uploadedAt: attachment.attached_at,
          downloadUrl: attachment.download_url,
        })),
      });
    } catch (error) {
      return apiErrorResponse(error);
    }
  },
);

export const POST = withApiGuardrails(
  "projects/[projectId]/prime-contract-change-orders/[primeCoId]/attachments#POST",
  async ({ request, params }) => {
    const { projectId, primeCoId } = await params;
    const projectIdNum = Number(projectId);
    const primeCoIdNum = Number(primeCoId);
    const guard = await requirePermission(projectIdNum, "change_orders", "write");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const serviceClient = createServiceClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/prime-contract-change-orders/[primeCoId]/attachments#POST", message: "Authentication required." });
    }

    if (!(await verifyPrimeContractChangeOrder(supabase, projectIdNum, primeCoIdNum))) {
      return NextResponse.json({ error: "Change order not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = (formData.get("file") || formData.get("files")) as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    try {
      const attachment = await uploadAndLinkPatternCDocument({
        supabase,
        serviceClient,
        file,
        projectId: projectIdNum,
        entityType: "prime_contract_change_order",
        entityId: primeCoId,
        userId: user.id,
      });

      return NextResponse.json(
        {
          id: attachment.documentMetadataId,
          fileName: attachment.title,
          filePath: attachment.filePath,
          fileSize: attachment.fileSize,
          mimeType: attachment.mimeType,
          uploadedAt: attachment.attachedAt,
          downloadUrl: attachment.signedUrl,
        },
        { status: 201 },
      );
    } catch (error) {
      return apiErrorResponse(error);
    }
  },
);
