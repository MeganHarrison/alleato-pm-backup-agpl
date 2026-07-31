import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { uploadAndLinkPatternCDocument } from "@/lib/documents/pattern-c-attachments";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requirePermission } from "@/lib/permissions-guard";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const POST = withApiGuardrails(
  "projects/[projectId]/submittals/[submittalId]/attachments#POST",
  async ({ request, params }) => {
    const { projectId, submittalId } = await params;
    const projectIdNum = Number.parseInt(projectId, 10);
    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }

    const guard = await requirePermission(projectIdNum, "submittals", "write");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const serviceClient = createServiceClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/submittals/[submittalId]/attachments#POST",
        message: "Authentication required.",
      });
    }

    const { data: submittal, error: submittalError } = await supabase
      .from("submittals")
      .select("id")
      .eq("project_id", projectIdNum)
      .eq("id", submittalId)
      .is("deleted_at", null)
      .single();

    if (submittalError || !submittal) {
      return NextResponse.json({ error: "Submittal not found" }, { status: 404 });
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
        entityType: "submittal",
        entityId: submittalId,
        userId: user.id,
      });

      return NextResponse.json(
        {
          id: attachment.documentMetadataId,
          file_name: attachment.title,
          file_url: attachment.signedUrl,
          file_size: attachment.fileSize,
          content_type: attachment.mimeType,
          is_current: true,
          uploaded_by: user.id,
          created_at: attachment.attachedAt,
        },
        { status: 201 },
      );
    } catch (error) {
      return apiErrorResponse(error);
    }
  },
);
