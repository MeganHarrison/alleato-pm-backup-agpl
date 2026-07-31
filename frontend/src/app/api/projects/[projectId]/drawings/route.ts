import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { DrawingService } from "@/services/DrawingService";
import type { DrawingFilters } from "@/services/DrawingService";
import { apiErrorResponse } from "@/lib/api-error";

interface FinalizeDrawingUploadRequest {
  drawing_number: string;
  title: string;
  discipline?: string;
  drawing_type?: string;
  area_id?: string;
  revision_number: string;
  received_date: string;
  drawing_date?: string;
  description?: string;
  drawing_set_id?: string;
  upload_path: string;
  file_name: string;
  file_size: number;
  file_type: string;
  rotation_degrees?: number;
  ocr_confidence_label?: string;
  ocr_confidence_score?: number | null;
  ocr_confidence_source?: string;
}

type OcrConfidenceLabel = "high" | "medium" | "low" | "unknown";
type OcrConfidenceSource = "ocr" | "filename" | "manual" | "not_run";

function normalizeRotationDegrees(value: FormDataEntryValue | number | undefined): number {
  const rawValue = typeof value === "string" ? Number.parseInt(value, 10) : value;
  if (!Number.isFinite(rawValue)) {
    return 0;
  }
  const normalized = ((Number(rawValue) % 360) + 360) % 360;
  return [0, 90, 180, 270].includes(normalized) ? normalized : 0;
}

function normalizeOcrConfidenceLabel(value: FormDataEntryValue | string | undefined): OcrConfidenceLabel {
  return value === "high" || value === "medium" || value === "low" || value === "unknown"
    ? value
    : "unknown";
}

function normalizeOcrConfidenceSource(value: FormDataEntryValue | string | undefined): OcrConfidenceSource {
  return value === "ocr" || value === "filename" || value === "manual" || value === "not_run"
    ? value
    : "not_run";
}

function normalizeOcrConfidenceScore(
  value: FormDataEntryValue | number | null | undefined,
): number | null {
  if (value === null || value === undefined || value === "" || value instanceof File) {
    return null;
  }
  const score = typeof value === "string" ? Number.parseFloat(value) : value;
  return Number.isFinite(score) && score >= 0 && score <= 1 ? score : null;
}

/**
 * GET /api/projects/[projectId]/drawings
 * List drawings with optional filters
 */
export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/drawings#GET",
  async ({ request, params }) => {
  const { projectId } = await params;

  // Verify authentication
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/drawings#GET", message: "Authentication required." });
  }

  // Parse query parameters
  const searchParams = request.nextUrl.searchParams;
  const filters: DrawingFilters = {
    search: searchParams.get("search") || undefined,
    area_id: searchParams.get("area_id") || undefined,
    discipline: searchParams.get("discipline") || undefined,
    status: searchParams.get("status") || undefined,
    set_id: searchParams.get("set_id") || undefined,
    page: searchParams.get("page")
      ? Number(searchParams.get("page"))
      : undefined,
    page_size: searchParams.get("page_size")
      ? Number(searchParams.get("page_size"))
      : undefined,
    include_unpublished: searchParams.get("include_unpublished") === "true",
    include_obsolete: searchParams.get("include_obsolete") === "true",
  };

  const service = new DrawingService(createServiceClient());
  const result = await service.list(projectId, filters);

  if (result.error) {
    return apiErrorResponse(result.error);
  }

  return NextResponse.json(result.data);
  },
);

/**
 * POST /api/projects/[projectId]/drawings
 * Create a new drawing with file upload
 */
export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/drawings#POST",
  async ({ request, params }) => {
  const { projectId } = await params;

  // Verify authentication
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/drawings#POST", message: "Authentication required." });
  }

  const serviceClient = createServiceClient();
  const service = new DrawingService(serviceClient);

  /** Removes an uploaded object when the DB write path fails. */
  const cleanupUploadedFile = async (uploadPath: string | undefined) => {
    if (!uploadPath) return;
    await serviceClient.storage.from("project-files").remove([uploadPath]);
  };

  try {
    const contentType = request.headers.get("content-type") || "";
    const isMultipart = contentType.includes("multipart/form-data");

    let drawingNumber = "";
    let title = "";
    let discipline: string | undefined;
    let drawingType: string | undefined;
    let areaId: string | undefined;
    let revisionNumber = "";
    let receivedDate = "";
    let drawingDate: string | undefined;
    let description: string | undefined;
    let drawingSetId: string | undefined;
    let fileName = "";
    let fileSize = 0;
    let fileType = "";
    let rotationDegrees = 0;
    let ocrConfidenceLabel: OcrConfidenceLabel = "unknown";
    let ocrConfidenceScore: number | null = null;
    let ocrConfidenceSource: OcrConfidenceSource = "not_run";
    let uploadPath: string | undefined;
    let fileUrl = "";
    let uploadFile: File | undefined;

    if (isMultipart) {
      const formData = await request.formData();
      const file = formData.get("file") as File;

      drawingNumber = formData.get("drawing_number") as string;
      title = formData.get("title") as string;
      discipline = (formData.get("discipline") as string) || undefined;
      drawingType = (formData.get("drawing_type") as string) || undefined;
      areaId = (formData.get("area_id") as string) || undefined;
      revisionNumber = formData.get("revision_number") as string;
      receivedDate = formData.get("received_date") as string;
      drawingDate = (formData.get("drawing_date") as string) || undefined;
      description = (formData.get("description") as string) || undefined;
      drawingSetId = (formData.get("drawing_set_id") as string) || undefined;
      rotationDegrees = normalizeRotationDegrees(formData.get("rotation_degrees") ?? undefined);
      ocrConfidenceLabel = normalizeOcrConfidenceLabel(
        formData.get("ocr_confidence_label") ?? undefined,
      );
      ocrConfidenceScore = normalizeOcrConfidenceScore(
        formData.get("ocr_confidence_score") ?? undefined,
      );
      ocrConfidenceSource = normalizeOcrConfidenceSource(
        formData.get("ocr_confidence_source") ?? undefined,
      );

      if (!drawingNumber || !title || !revisionNumber || !receivedDate || !file) {
        return NextResponse.json(
          {
            error: "Missing required fields: drawing_number, title, revision_number, received_date, file",
          },
          { status: 400 },
        );
      }

      fileName = file.name;
      fileSize = file.size;
      fileType = file.type;
      uploadFile = file;
    } else {
      const body = (await request.json()) as FinalizeDrawingUploadRequest;

      drawingNumber = body.drawing_number;
      title = body.title;
      discipline = body.discipline;
      drawingType = body.drawing_type;
      areaId = body.area_id;
      revisionNumber = body.revision_number;
      receivedDate = body.received_date;
      drawingDate = body.drawing_date;
      description = body.description;
      drawingSetId = body.drawing_set_id;
      uploadPath = body.upload_path;
      fileName = body.file_name;
      fileSize = body.file_size;
      fileType = body.file_type;
      rotationDegrees = normalizeRotationDegrees(body.rotation_degrees);
      ocrConfidenceLabel = normalizeOcrConfidenceLabel(body.ocr_confidence_label);
      ocrConfidenceScore = normalizeOcrConfidenceScore(body.ocr_confidence_score);
      ocrConfidenceSource = normalizeOcrConfidenceSource(body.ocr_confidence_source);

      if (
        !drawingNumber ||
        !title ||
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
              "Missing required fields: drawing_number, title, revision_number, received_date, upload_path, file_name, file_size",
          },
          { status: 400 },
        );
      }

      const { data: publicUrlData } = serviceClient.storage
        .from("project-files")
        .getPublicUrl(uploadPath);
      fileUrl = publicUrlData.publicUrl;
    }

    // Duplicate detection: a repeated drawing number is a new revision of the
    // logical sheet, not a separate drawing.
    const { data: existing } = await serviceDb.from("drawings")
      .select("id, drawing_number, title, is_published")
      .eq("project_id", Number.parseInt(projectId, 10))
      .eq("drawing_number", drawingNumber)
      .maybeSingle();

    if (existing) {
      if (isMultipart) {
        if (!uploadFile) {
          return NextResponse.json(
            { error: "Missing upload file for multipart request" },
            { status: 400 },
          );
        }

        const uploadResult = await service.uploadFile(projectId, existing.id, uploadFile);
        if (uploadResult.error) {
          return apiErrorResponse(uploadResult.error);
        }
        fileUrl = uploadResult.data.url;
        uploadPath = uploadResult.data.path;
      }

      const revisionResult = await service.createRevision(
        existing.id,
        {
          revision_number: revisionNumber,
          drawing_set_id: drawingSetId,
          drawing_date: drawingDate,
          received_date: receivedDate,
          status: "under_review",
          is_current_revision: true,
          update_review_revision: true,
          update_current_revision: existing.is_published === false,
          file_url: fileUrl,
          file_name: fileName,
          file_size: fileSize,
          file_type: fileType,
          description,
          rotation_degrees: rotationDegrees,
          ocr_confidence_label: ocrConfidenceLabel,
          ocr_confidence_score: ocrConfidenceScore,
          ocr_confidence_source: ocrConfidenceSource,
        },
        user.id,
      );

      if (revisionResult.error) {
        await cleanupUploadedFile(uploadPath);
        return apiErrorResponse(revisionResult.error);
      }

      const finalResult = await service.getById(projectId, existing.id);
      if (finalResult.error) {
        return apiErrorResponse(finalResult.error);
      }

      return NextResponse.json(
        {
          ...finalResult.data,
          revision_created: true,
          logical_drawing_created: false,
        },
        { status: 201 },
      );
    }

    // Step 1: Create the drawing
    const createResult = await service.create(
      projectId,
      {
        drawing_number: drawingNumber,
        title,
        discipline,
        drawing_type: drawingType,
        area_id: areaId,
        is_published: false,
      },
      user.id,
    );

    if (createResult.error) {
      if (!isMultipart) {
        await cleanupUploadedFile(uploadPath);
      }
      return apiErrorResponse(createResult.error);
    }

    const drawing = createResult.data;

    if (isMultipart) {
      if (!uploadFile) {
        await service.delete(projectId, drawing.id);
        return NextResponse.json(
          { error: "Missing upload file for multipart request" },
          { status: 400 },
        );
      }

      const uploadResult = await service.uploadFile(projectId, drawing.id, uploadFile);
      if (uploadResult.error) {
        await service.delete(projectId, drawing.id);
        return apiErrorResponse(uploadResult.error);
      }
      fileUrl = uploadResult.data.url;
      uploadPath = uploadResult.data.path;
    }

    // Step 3: Create the first revision with the uploaded file
    const revisionResult = await service.createRevision(
      drawing.id,
      {
        revision_number: revisionNumber,
        drawing_set_id: drawingSetId,
        drawing_date: drawingDate,
        received_date: receivedDate,
        status: "under_review",
        is_current_revision: true,
        update_review_revision: true,
        update_current_revision: true,
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
        file_type: fileType,
        description,
        rotation_degrees: rotationDegrees,
        ocr_confidence_label: ocrConfidenceLabel,
        ocr_confidence_score: ocrConfidenceScore,
        ocr_confidence_source: ocrConfidenceSource,
      },
      user.id,
    );

    if (revisionResult.error) {
      // Rollback: delete the drawing and file if revision creation fails
      await service.delete(projectId, drawing.id);
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
          title: `${drawingNumber} – ${title}`,
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
          .eq("id", drawing.id);
      }
    }

    // Fetch the complete drawing with revision
    const finalResult = await service.getById(projectId, drawing.id);

    if (finalResult.error) {
      return apiErrorResponse(finalResult.error);
    }

    return NextResponse.json(finalResult.data, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to create drawing",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
  },
);
