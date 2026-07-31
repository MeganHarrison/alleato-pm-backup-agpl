import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { listLinkedPatternCDocuments } from "@/lib/documents/pattern-c-attachments";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const GET = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]/attachments/[attachmentId]/download#GET",
  async ({ params }) => {
    const { projectId, contractId, attachmentId } = await params;
    const supabase = await createClient();
    const serviceClient = createServiceClient();

    const { data: contract } = await supabase
      .from("prime_contracts")
      .select("id, project_id")
      .eq("id", contractId)
      .eq("project_id", Number.parseInt(projectId, 10))
      .single();

    if (!contract) {
      return Response.json({ success: false, error_message: "Contract not found", error: "Contract not found" }, { status: 404 });
    }

    try {
      const attachments = await listLinkedPatternCDocuments({
        supabase,
        serviceClient,
        entityType: "prime_contract",
        entityId: contractId,
      });
      const attachment = attachments.find((row) => row.document_metadata_id === attachmentId);
      if (!attachment?.download_url) {
        return Response.json({ success: false, error_message: "Attachment not found", error: "Attachment not found" }, { status: 404 });
      }

      return NextResponse.redirect(new URL(attachment.download_url));
    } catch (error) {
      return apiErrorResponse(error);
    }
  },
);
