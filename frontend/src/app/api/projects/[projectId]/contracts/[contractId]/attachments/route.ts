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

async function verifyPrimeContract(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: number,
  contractId: string,
) {
  const { data: contract, error } = await supabase
    .from("prime_contracts")
    .select("id, project_id")
    .eq("id", contractId)
    .eq("project_id", projectId)
    .single();

  return error || !contract ? null : contract;
}

export const GET = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]/attachments#GET",
  async ({ params }) => {
    const { projectId, contractId } = await params;
    const supabase = await createClient();
    const serviceClient = createServiceClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/contracts/[contractId]/attachments#GET",
        message: "Authentication required.",
      });
    }

    if (!(await verifyPrimeContract(supabase, Number(projectId), contractId))) {
      return Response.json({ success: false, error_message: "Contract not found", error: "Contract not found" }, { status: 404 });
    }

    try {
      const attachments = await listLinkedPatternCDocuments({
        supabase,
        serviceClient,
        entityType: "prime_contract",
        entityId: contractId,
      });

      return NextResponse.json({
        data: attachments.map((attachment) => ({
          id: attachment.document_metadata_id,
          contractId,
          fileName: attachment.file_name ?? attachment.title,
          url: attachment.download_url,
          downloadUrl: attachment.download_url,
          uploadedBy: null,
          uploadedAt: attachment.attached_at,
          _links: {
            self: `/api/projects/${projectId}/contracts/${contractId}/attachments/${attachment.document_metadata_id}`,
          },
        })),
        _links: {
          self: `/api/projects/${projectId}/contracts/${contractId}/attachments`,
          contract: `/api/projects/${projectId}/contracts/${contractId}`,
        },
      });
    } catch (error) {
      return apiErrorResponse(error);
    }
  },
);

export const POST = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]/attachments#POST",
  async ({ request, params }) => {
    const { projectId, contractId } = await params;
    const projectIdNum = Number(projectId);
    const guard = await requirePermission(projectIdNum, "contracts", "write");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const serviceClient = createServiceClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/contracts/[contractId]/attachments#POST", message: "Authentication required." });
    }

    if (!(await verifyPrimeContract(supabase, projectIdNum, contractId))) {
      return Response.json({ success: false, error_message: "Contract not found", error: "Contract not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = (formData.get("file") || formData.get("files")) as File | null;
    if (!file) {
      return Response.json({ success: false, error_message: "No file provided", error: "No file provided" }, { status: 400 });
    }

    try {
      const attachment = await uploadAndLinkPatternCDocument({
        supabase,
        serviceClient,
        file,
        projectId: projectIdNum,
        entityType: "prime_contract",
        entityId: contractId,
        userId: user.id,
      });

      return NextResponse.json(
        {
          id: attachment.documentMetadataId,
          contractId,
          fileName: attachment.title,
          url: attachment.signedUrl,
          uploadedBy: { id: user.id, email: user.email },
          uploadedAt: attachment.attachedAt,
          publicUrl: attachment.signedUrl,
          downloadUrl: attachment.signedUrl,
        },
        { status: 201 },
      );
    } catch (error) {
      return apiErrorResponse(error);
    }
  },
);
