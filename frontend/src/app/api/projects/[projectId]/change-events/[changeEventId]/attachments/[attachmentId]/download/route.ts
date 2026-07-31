import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { listLinkedPatternCDocuments } from "@/lib/documents/pattern-c-attachments";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const GET = withApiGuardrails(
  "projects/[projectId]/change-events/[changeEventId]/attachments/[attachmentId]/download#GET",
  async ({ params }) => {
    const { projectId, changeEventId, attachmentId } = await params;
    const supabase = await createClient();
    const serviceClient = createServiceClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/change-events/[changeEventId]/attachments/[attachmentId]/download#GET", message: "Authentication required." });
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
      if (!attachment?.file_path) {
        return Response.json({ success: false, error_message: "Attachment not found", error: "Attachment not found" }, { status: 404 });
      }

      const { data: fileData, error: downloadError } = await serviceClient.storage
        .from("project-files")
        .download(attachment.file_path);

      if (downloadError || !fileData) {
        return NextResponse.json(
          { error: "Failed to download file", details: downloadError?.message },
          { status: 404 },
        );
      }

      const buffer = Buffer.from(await fileData.arrayBuffer());
      const headers = new Headers();
      headers.set("Content-Type", attachment.mime_type || "application/octet-stream");
      headers.set("Content-Disposition", `attachment; filename="${attachment.file_name ?? attachment.title ?? "attachment"}"`);
      headers.set("Content-Length", buffer.length.toString());

      return new NextResponse(buffer, { headers });
    } catch (error) {
      return apiErrorResponse(error);
    }
  },
);
