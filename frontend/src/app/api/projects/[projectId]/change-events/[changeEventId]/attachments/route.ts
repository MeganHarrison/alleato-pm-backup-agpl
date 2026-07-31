import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import {
  deletePatternCDocumentLink,
  listLinkedPatternCDocuments,
  uploadAndLinkPatternCDocument,
} from "@/lib/documents/pattern-c-attachments";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requirePermission } from "@/lib/permissions-guard";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";

async function verifyChangeEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: number,
  changeEventId: string,
) {
  const { data: changeEvent, error: eventError } = await supabase
    .from("change_events")
    .select("id, number")
    .eq("project_id", projectId)
    .eq("id", changeEventId)
    .is("deleted_at", null)
    .single();

  return eventError || !changeEvent ? null : changeEvent;
}

function formatAttachment(
  projectId: string,
  changeEventId: string,
  attachment: Awaited<ReturnType<typeof listLinkedPatternCDocuments>>[number],
) {
  return {
    id: attachment.document_metadata_id,
    changeEventId,
    fileName: attachment.file_name ?? attachment.title,
    filePath: attachment.file_path,
    fileSize: attachment.source_size,
    mimeType: attachment.mime_type,
    uploadedBy: null,
    uploadedAt: attachment.attached_at,
    downloadUrl: attachment.download_url,
    _links: {
      self: `/api/projects/${projectId}/change-events/${changeEventId}/attachments/${attachment.document_metadata_id}`,
      download: `/api/projects/${projectId}/change-events/${changeEventId}/attachments/${attachment.document_metadata_id}/download`,
    },
  };
}

export const GET = withApiGuardrails(
  "projects/[projectId]/change-events/[changeEventId]/attachments#GET",
  async ({ params }) => {
    const { projectId, changeEventId } = await params;
    const supabase = await createClient();
    const serviceClient = createServiceClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/change-events/[changeEventId]/attachments#GET",
        message: "Authentication required.",
      });
    }

    if (!(await verifyChangeEvent(supabase, Number(projectId), changeEventId))) {
      return Response.json({ success: false, error_message: "Change event not found", error: "Change event not found" }, { status: 404 });
    }

    try {
      const attachments = await listLinkedPatternCDocuments({
        supabase,
        serviceClient,
        entityType: "change_event",
        entityId: changeEventId,
      });

      return NextResponse.json({
        data: attachments.map((attachment) => formatAttachment(projectId, changeEventId, attachment)),
        _links: {
          self: `/api/projects/${projectId}/change-events/${changeEventId}/attachments`,
          changeEvent: `/api/projects/${projectId}/change-events/${changeEventId}`,
        },
      });
    } catch (error) {
      return apiErrorResponse(error);
    }
  },
);

export const POST = withApiGuardrails(
  "projects/[projectId]/change-events/[changeEventId]/attachments#POST",
  async ({ request, params }) => {
    const { projectId, changeEventId } = await params;
    const projectIdNum = Number(projectId);
    const guard = await requirePermission(projectIdNum, "change_orders", "write");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const serviceClient = createServiceClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/change-events/[changeEventId]/attachments#POST", message: "Authentication required." });
    }

    const changeEvent = await verifyChangeEvent(supabase, projectIdNum, changeEventId);
    if (!changeEvent) {
      return Response.json({ success: false, error_message: "Change event not found", error: "Change event not found" }, { status: 404 });
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
        entityType: "change_event",
        entityId: changeEventId,
        userId: user.id,
      });

      await serviceDb.from("change_events")
        .update({ updated_at: new Date().toISOString(), updated_by: user.id })
        .eq("id", changeEventId);

      await serviceDb.from("change_event_history").insert({
        change_event_id: changeEventId,
        field_name: "attachment_added",
        new_value: attachment.title,
        changed_by: user.id,
        change_type: "UPDATE",
      });

      return NextResponse.json(
        {
          id: attachment.documentMetadataId,
          changeEventId,
          fileName: attachment.title,
          filePath: attachment.filePath,
          fileSize: attachment.fileSize,
          mimeType: attachment.mimeType,
          uploadedBy: { id: user.id, email: user.email },
          uploadedAt: attachment.attachedAt,
          publicUrl: attachment.signedUrl,
          downloadUrl: attachment.signedUrl,
          _links: {
            self: `/api/projects/${projectId}/change-events/${changeEventId}/attachments/${attachment.documentMetadataId}`,
            download: `/api/projects/${projectId}/change-events/${changeEventId}/attachments/${attachment.documentMetadataId}/download`,
            changeEvent: `/api/projects/${projectId}/change-events/${changeEventId}`,
          },
        },
        { status: 201 },
      );
    } catch (error) {
      return apiErrorResponse(error);
    }
  },
);

export const DELETE = withApiGuardrails(
  "projects/[projectId]/change-events/[changeEventId]/attachments#DELETE",
  async ({ request, params }) => {
    const { projectId, changeEventId } = await params;
    const projectIdNum = Number(projectId);
    const guard = await requirePermission(projectIdNum, "change_orders", "admin");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const serviceClient = createServiceClient();
    const body = await request.json();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/change-events/[changeEventId]/attachments#DELETE", message: "Authentication required." });
    }

    if (!(await verifyChangeEvent(supabase, projectIdNum, changeEventId))) {
      return Response.json({ success: false, error_message: "Change event not found", error: "Change event not found" }, { status: 404 });
    }

    if (!Array.isArray(body.attachmentIds)) {
      return Response.json({ success: false, error_message: "Request body must contain an array of attachment IDs", error: "Request body must contain an array of attachment IDs" }, { status: 400 });
    }

    try {
      await Promise.all(
        body.attachmentIds.map((attachmentId: string) =>
          deletePatternCDocumentLink({
            supabase,
            entityType: "change_event",
            entityId: changeEventId,
            documentMetadataId: attachmentId,
          }),
        ),
      );

      await serviceDb.from("change_events")
        .update({ updated_at: new Date().toISOString(), updated_by: user.id })
        .eq("id", changeEventId);

      return NextResponse.json({ message: `${body.attachmentIds.length} attachment(s) deleted successfully` });
    } catch (error) {
      return apiErrorResponse(error);
    }
  },
);
