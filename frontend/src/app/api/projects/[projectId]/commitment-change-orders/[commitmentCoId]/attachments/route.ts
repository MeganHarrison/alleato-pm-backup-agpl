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

async function verifyCommitmentChangeOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: number,
  commitmentCoId: string,
) {
  const { data: cco, error: ccoError } = await supabase
    .from("contract_change_orders")
    .select("id, contract_id, project_id")
    .eq("id", commitmentCoId)
    .single();

  if (ccoError || !cco) return false;
  if (cco.project_id === projectId) return true;

  const { data: commitment } = await supabase
    .from("commitments_unified")
    .select("id, project_id")
    .eq("id", cco.contract_id)
    .is("deleted_at", null)
    .single();

  return commitment?.project_id === projectId;
}

export const GET = withApiGuardrails(
  "projects/[projectId]/commitment-change-orders/[commitmentCoId]/attachments#GET",
  async ({ params }) => {
    const { projectId, commitmentCoId } = await params;
    const projectIdNum = Number(projectId);
    const supabase = await createClient();
    const serviceClient = createServiceClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/commitment-change-orders/[commitmentCoId]/attachments#GET", message: "Authentication required." });
    }

    if (!(await verifyCommitmentChangeOrder(supabase, projectIdNum, commitmentCoId))) {
      return NextResponse.json({ error: "Change order not found" }, { status: 404 });
    }

    try {
      const attachments = await listLinkedPatternCDocuments({
        supabase,
        serviceClient,
        entityType: "commitment_change_order",
        entityId: commitmentCoId,
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
  "projects/[projectId]/commitment-change-orders/[commitmentCoId]/attachments#POST",
  async ({ request, params }) => {
    const { projectId, commitmentCoId } = await params;
    const projectIdNum = Number(projectId);
    const guard = await requirePermission(projectIdNum, "contracts", "write");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const serviceClient = createServiceClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/commitment-change-orders/[commitmentCoId]/attachments#POST", message: "Authentication required." });
    }

    if (!(await verifyCommitmentChangeOrder(supabase, projectIdNum, commitmentCoId))) {
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
        entityType: "commitment_change_order",
        entityId: commitmentCoId,
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
