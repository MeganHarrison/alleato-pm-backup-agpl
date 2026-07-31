import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import {
  listLinkedPatternCDocuments,
  uploadAndLinkPatternCDocument,
} from "@/lib/documents/pattern-c-attachments";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

async function verifyOwnerInvoice(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: number,
  invoiceId: number,
) {
  const { data: invoice, error: invoiceError } = await supabase
    .from("owner_invoices")
    .select("id, prime_contract:prime_contracts!owner_invoices_prime_contract_id_fkey(project_id)")
    .eq("id", invoiceId)
    .single();

  return !invoiceError && invoice?.prime_contract?.project_id === projectId;
}

export const GET = withApiGuardrails(
  "projects/[projectId]/invoicing/owner/[invoiceId]/attachments#GET",
  async ({ params }) => {
    const { projectId, invoiceId } = params as { projectId: string; invoiceId: string };
    const projectIdNum = Number(projectId);
    const invoiceIdNum = Number(invoiceId);
    const supabase = await createClient();
    const serviceClient = createServiceClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/invoicing/owner/[invoiceId]/attachments#GET",
        message: "Authentication required.",
      });
    }

    if (!(await verifyOwnerInvoice(supabase, projectIdNum, invoiceIdNum))) {
      return Response.json({ success: false, error_message: "Invoice not found", error: "Invoice not found" }, { status: 404 });
    }

    try {
      const attachments = await listLinkedPatternCDocuments({
        supabase,
        serviceClient,
        entityType: "invoice",
        entityId: invoiceId,
      });

      return NextResponse.json({
        data: attachments.map((attachment) => ({
          id: attachment.document_metadata_id,
          fileName: attachment.file_name ?? attachment.title,
          filePath: attachment.file_path,
          fileSize: attachment.source_size,
          mimeType: attachment.mime_type,
          createdAt: attachment.attached_at,
          downloadUrl: attachment.download_url,
        })),
      });
    } catch (error) {
      return apiErrorResponse(error);
    }
  },
);

export const POST = withApiGuardrails(
  "projects/[projectId]/invoicing/owner/[invoiceId]/attachments#POST",
  async ({ request, params }) => {
    const { projectId, invoiceId } = params as { projectId: string; invoiceId: string };
    const projectIdNum = Number(projectId);
    const invoiceIdNum = Number(invoiceId);
    const supabase = await createClient();
    const serviceClient = createServiceClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/invoicing/owner/[invoiceId]/attachments#POST",
        message: "Authentication required.",
      });
    }

    if (!(await verifyOwnerInvoice(supabase, projectIdNum, invoiceIdNum))) {
      return Response.json({ success: false, error_message: "Invoice not found", error: "Invoice not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = (formData.get("file") ?? formData.get("files")) as File | null;
    if (!file) {
      return Response.json({ success: false, error_message: "No file provided", error: "No file provided" }, { status: 400 });
    }

    try {
      const attachment = await uploadAndLinkPatternCDocument({
        supabase,
        serviceClient,
        file,
        projectId: projectIdNum,
        entityType: "invoice",
        entityId: invoiceId,
        userId: user.id,
      });

      return NextResponse.json(
        {
          id: attachment.documentMetadataId,
          fileName: attachment.title,
          filePath: attachment.filePath,
          fileSize: attachment.fileSize,
          mimeType: attachment.mimeType,
          createdAt: attachment.attachedAt,
          downloadUrl: attachment.signedUrl,
        },
        { status: 201 },
      );
    } catch (error) {
      return apiErrorResponse(error);
    }
  },
);
