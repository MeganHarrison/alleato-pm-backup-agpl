import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { deletePatternCDocumentLink } from "@/lib/documents/pattern-c-attachments";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requirePermission } from "@/lib/permissions-guard";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

export const DELETE = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]/attachments/[attachmentId]#DELETE",
  async ({ params }) => {
    const { projectId, contractId, attachmentId } = await params;
    const projectIdNum = Number(projectId);
    const guard = await requirePermission(projectIdNum, "contracts", "admin");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/contracts/[contractId]/attachments/[attachmentId]#DELETE", message: "Authentication required." });
    }

    try {
      await deletePatternCDocumentLink({
        supabase,
        entityType: "prime_contract",
        entityId: contractId,
        documentMetadataId: attachmentId,
      });
      return NextResponse.json({ success: true });
    } catch (error) {
      return apiErrorResponse(error);
    }
  },
);
