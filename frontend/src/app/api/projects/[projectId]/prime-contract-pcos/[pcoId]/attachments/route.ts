import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { uploadAndLinkPatternCDocument } from "@/lib/documents/pattern-c-attachments";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requirePermission } from "@/lib/permissions-guard";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

async function verifyPrimeContractPco(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: number,
  pcoId: string,
) {
  const { data: pco, error } = await supabase
    .from("prime_contract_pcos")
    .select("id")
    .eq("id", pcoId)
    .eq("project_id", projectId)
    .single();

  return error || !pco ? null : pco;
}

export const POST = withApiGuardrails<{ projectId: string; pcoId: string }>(
  "projects/[projectId]/prime-contract-pcos/[pcoId]/attachments#POST",
  async ({ request, params }) => {
    const { projectId, pcoId } = await params;
    const projectIdNum = Number(projectId);
    const guard = await requirePermission(projectIdNum, "change_orders", "write");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const serviceClient = createServiceClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/prime-contract-pcos/[pcoId]/attachments#POST",
        message: "Authentication required.",
      });
    }

    if (!(await verifyPrimeContractPco(supabase, projectIdNum, pcoId))) {
      return Response.json(
        {
          success: false,
          error_message: "Prime contract PCO not found",
          error: "Prime contract PCO not found",
        },
        { status: 404 },
      );
    }

    const formData = await request.formData();
    const file = (formData.get("file") || formData.get("files")) as File | null;
    if (!file) {
      return Response.json(
        { success: false, error_message: "No file provided", error: "No file provided" },
        { status: 400 },
      );
    }

    try {
      const attachment = await uploadAndLinkPatternCDocument({
        supabase,
        serviceClient,
        file,
        projectId: projectIdNum,
        entityType: "prime_contract_pco",
        entityId: pcoId,
        userId: user.id,
      });

      return NextResponse.json(
        {
          id: attachment.documentMetadataId,
          pcoId,
          fileName: attachment.title,
          filePath: attachment.filePath,
          fileSize: attachment.fileSize,
          mimeType: attachment.mimeType,
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
