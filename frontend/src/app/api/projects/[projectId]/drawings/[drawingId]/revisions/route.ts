import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { DrawingService } from "@/services/DrawingService";
import { apiErrorResponse } from "@/lib/api-error";

interface FinalizeRevisionUploadRequest {
  revision_number: string;
  received_date: string;
  drawing_date?: string;
  drawing_set_id?: string;
  status?: string;
  description?: string;
  upload_path: string;
  file_name: string;
  file_size: number;
  file_type: string;
}

/**
 * GET /api/projects/[projectId]/drawings/[drawingId]/revisions
 * List all revisions for a drawing
 */
export const GET = withApiGuardrails<{ projectId: string; drawingId: string }>(
  "projects/[projectId]/drawings/[drawingId]/revisions#GET",
  async ({ request, params }) => {
  const { drawingId } = await params;
  const supabase = await createClient();

  // Verify authentication
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/drawings/[drawingId]/revisions#GET", message: "Authentication required." });
  }

  const service = new DrawingService(createServiceClient());
  const result = await service.listRevisions(drawingId);

  if (result.error) {
    return apiErrorResponse(result.error);
  }

  return NextResponse.json(result.data);
  },
);

/**
 * POST /api/projects/[projectId]/drawings/[drawingId]/revisions
 * Create a new revision for a drawing with file upload
 */
export const POST = withApiGuardrails<{ projectId: string; drawingId: string }>(
  "projects/[projectId]/drawings/[drawingId]/revisions#POST",
  async ({ request, params }) => {
  const { projectId, drawingId } = await params;
  const supabase = await createClient();

  // Verify authentication
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/drawings/[drawingId]/revisions#POST", message: "Authentication required." });
  }

  const serviceClient = createServiceClient();
  const service = new DrawingService(serviceClient);

  /** Removes an uploaded object when revision finalization fails. */
  const cleanupUploadedFile = async (uploadPath: string | undefined) => {
    if (!uploadPath) return;
    await serviceClient.storage.from("project-files").remove([uploadPath]);
  };

  try {
    const contentType = request.headers.get("content-type") || "";
    const isMultipart = contentType.includes("multipart/form-data");

    let revisionNumber = "";
    let receivedDate = "";
    let drawingDate: string | undefined;
    let drawingSetId: string | undefined;
    let status: string | undefined;
    let description: string | undefined;
    let fileName = "";
    let fileSize = 0;
    let fileType = "";
    let uploadPath: string | undefined;
    let fileUrl = "";
    let uploadFile: File | undefined;

    if (isMultipart) {
      const formData = await request.formData();
      const file = formData.get("file") as File;

      revisionNumber = formData.get("revision_number") as string;
      receivedDate = formData.get("received_date") as string;
      drawingDate = (formData.get("drawing_date") as string) || undefined;
      drawingSetId = (formData.get("drawing_set_id") as string) || undefined;
      status = (formData.get("status") as string) || undefined;
      description = (formData.get("description") as string) || undefined;

      if (!revisionNumber || !receivedDate || !file) {
        return NextResponse.json(
          {
            error: "Missing required fields: revision_number, received_date, file",
          },
          { status: 400 },
        );
      }

      fileName = file.name;
      fileSize = file.size;
      fileType = file.type;
      uploadFile = file;
    } else {
      const body = (await request.json()) as FinalizeRevisionUploadRequest;
      revisionNumber = body.revision_number;
      receivedDate = body.received_date;
      drawingDate = body.drawing_date;
      drawingSetId = body.drawing_set_id;
      status = body.status;
      description = body.description;
      uploadPath = body.upload_path;
      fileName = body.file_name;
      fileSize = body.file_size;
      fileType = body.file_type;

      if (
        !revisionNumber ||
        !receivedDate ||
        !uploadPath ||
        !fileName ||
        !Number.isFinite(fileSize) ||
        fileSize <= 0
      ) {
        return NextResponse.json(
          {
            error:
              "Missing required fields: revision_number, received_date, upload_path, file_name, file_size",
          },
          { status: 400 },
        );
      }

      const { data: publicUrlData } = serviceClient.storage
        .from("project-files")
        .getPublicUrl(uploadPath);
      fileUrl = publicUrlData.publicUrl;
    }

    if (isMultipart) {
      if (!uploadFile) {
        return NextResponse.json(
          { error: "Missing upload file for multipart request" },
          { status: 400 },
        );
      }
      const uploadResult = await service.uploadFile(projectId, drawingId, uploadFile);
      if (uploadResult.error) {
        return apiErrorResponse(uploadResult.error);
      }
      fileUrl = uploadResult.data.url;
      uploadPath = uploadResult.data.path;
    }

    const revisionResult = await service.createRevision(
      drawingId,
      {
        revision_number: revisionNumber,
        drawing_set_id: drawingSetId,
        drawing_date: drawingDate,
        received_date: receivedDate,
        status: status || "under_review",
        is_current_revision: true,
        update_review_revision: true,
        update_current_revision: false,
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
        file_type: fileType,
        description,
      },
      user.id,
    );

    if (revisionResult.error) {
      if (!isMultipart) {
        await cleanupUploadedFile(uploadPath);
      }
      return apiErrorResponse(revisionResult.error);
    }

    // Create a document_metadata record so the OCR → embed pipeline can process this drawing PDF.
    // Best-effort: don't fail the request if this insert errors.
    const revision = revisionResult.data;
    if (revision && fileUrl) {
      const docMetaId = crypto.randomUUID();
      const { data: docMeta } = await serviceDb.from("document_metadata")
        .insert({
          id: docMetaId,
          title: fileName,
          url: fileUrl,
          source_web_url: fileUrl,
          type: "drawing",
          source_system: "drawing_upload",
          document_type: "drawing",
          status: "no_text",
          project_id: Number.parseInt(projectId, 10),
          file_name: fileName,
          source_path: uploadPath ?? null,
          storage_bucket: "project-files",
          phase: "Current",
          source_metadata: {},
        })
        .select("id")
        .single();

      if (docMeta) {
        await serviceDb.from("drawing_revisions")
          .update({ document_metadata_id: docMeta.id })
          .eq("id", revision.id);
        await serviceDb.from("drawings")
          .update({ document_metadata_id: docMeta.id })
          .eq("id", drawingId);
      }
    }

    const projectIdNum = Number(projectId);
    // Record change history (best-effort — don't fail the request if this errors)
    void Promise.resolve(supabase.from("drawing_change_history").insert({
      drawing_id: drawingId,
      project_id: projectIdNum,
      changed_by: user.id,
      field_name: "revision",
      old_value: null,
      new_value: revisionResult.data?.revision_number ?? "new revision",
      change_type: "revision_added",
    })).catch(() => {}); // fire-and-forget

    return NextResponse.json(revisionResult.data, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to create revision",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
  },
);
