import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import {
  deletePatternCDocumentLink,
  listLinkedPatternCDocuments,
} from "@/lib/documents/pattern-c-attachments";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const DELETE = withApiGuardrails(
  "projects/[projectId]/invoicing/owner/[invoiceId]/attachments/[attachmentId]#DELETE",
  async ({ params }) => {
    const { invoiceId, attachmentId } = params as {
      projectId: string;
      invoiceId: string;
      attachmentId: string;
    };
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/invoicing/owner/[invoiceId]/attachments/[attachmentId]#DELETE",
        message: "Authentication required.",
      });
    }

    try {
      await deletePatternCDocumentLink({
        supabase,
        entityType: "invoice",
        entityId: invoiceId,
        documentMetadataId: attachmentId,
      });
      return NextResponse.json({ message: "Attachment deleted successfully" });
    } catch (error) {
      return apiErrorResponse(error);
    }
  },
);

export const GET = withApiGuardrails(
  "projects/[projectId]/invoicing/owner/[invoiceId]/attachments/[attachmentId]#GET",
  async ({ params }) => {
    const { invoiceId, attachmentId } = params as {
      projectId: string;
      invoiceId: string;
      attachmentId: string;
    };
    const supabase = await createClient();
    const serviceClient = createServiceClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/invoicing/owner/[invoiceId]/attachments/[attachmentId]#GET",
        message: "Authentication required.",
      });
    }

    try {
      const attachments = await listLinkedPatternCDocuments({
        supabase,
        serviceClient,
        entityType: "invoice",
        entityId: invoiceId,
      });
      const attachment = attachments.find((row) => row.document_metadata_id === attachmentId);
      if (!attachment) {
        return Response.json({ success: false, error_message: "Attachment not found", error: "Attachment not found" }, { status: 404 });
      }
      return NextResponse.json({ url: attachment.download_url, fileName: attachment.file_name ?? attachment.title });
    } catch (error) {
      return apiErrorResponse(error);
    }
  },
);
