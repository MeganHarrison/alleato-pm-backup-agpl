import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import {
  deletePatternCDocumentLink,
  listLinkedPatternCDocuments,
} from "@/lib/documents/pattern-c-attachments";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requirePermission } from "@/lib/permissions-guard";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";

export const GET = withApiGuardrails(
  "projects/[projectId]/change-events/[changeEventId]/attachments/[attachmentId]#GET",
  async ({ params }) => {
    const { projectId, changeEventId, attachmentId } = await params;
    const supabase = await createClient();
    const serviceClient = createServiceClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/change-events/[changeEventId]/attachments/[attachmentId]#GET",
        message: "Authentication required.",
      });
    }

    const { data: changeEvent, error: eventError } = await supabase
      .from("change_events")
      .select("id")
      .eq("project_id", Number(projectId))
      .eq("id", changeEventId)
      .is("deleted_at", null)
      .single();

    if (eventError || !changeEvent) {
      return Response.json({ success: false, error_message: "Change event not found", error: "Change event not found" }, { status: 404 });
    }

    try {
      const attachments = await listLinkedPatternCDocuments({
        supabase,
        serviceClient,
        entityType: "change_event",
        entityId: changeEventId,
      });
      const attachment = attachments.find((row) => row.document_metadata_id === attachmentId);
      if (!attachment) {
        return Response.json({ success: false, error_message: "Attachment not found", error: "Attachment not found" }, { status: 404 });
      }

      return NextResponse.json({
        id: attachment.document_metadata_id,
        changeEventId,
        fileName: attachment.file_name ?? attachment.title,
        filePath: attachment.file_path,
        fileSize: attachment.source_size,
        mimeType: attachment.mime_type,
        uploadedBy: null,
        uploadedAt: attachment.attached_at,
        publicUrl: attachment.download_url,
        downloadUrl: attachment.download_url,
        _links: {
          self: `/api/projects/${projectId}/change-events/${changeEventId}/attachments/${attachmentId}`,
          download: `/api/projects/${projectId}/change-events/${changeEventId}/attachments/${attachmentId}/download`,
          changeEvent: `/api/projects/${projectId}/change-events/${changeEventId}`,
        },
      });
    } catch (error) {
      return apiErrorResponse(error);
    }
  },
);

export const DELETE = withApiGuardrails(
  "projects/[projectId]/change-events/[changeEventId]/attachments/[attachmentId]#DELETE",
  async ({ params }) => {
    const { projectId, changeEventId, attachmentId } = await params;
    const projectIdNum = Number(projectId);
    const guard = await requirePermission(projectIdNum, "change_orders", "admin");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const serviceClient = createServiceClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/change-events/[changeEventId]/attachments/[attachmentId]#DELETE", message: "Authentication required." });
    }

    try {
      await deletePatternCDocumentLink({
        supabase,
        entityType: "change_event",
        entityId: changeEventId,
        documentMetadataId: attachmentId,
      });

      await serviceDb.from("change_events")
        .update({ updated_at: new Date().toISOString(), updated_by: user.id })
        .eq("id", changeEventId);

      return new NextResponse(null, { status: 204 });
    } catch (error) {
      return apiErrorResponse(error);
    }
  },
);
