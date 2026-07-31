import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { apiErrorResponse } from "@/lib/api-error";
import {
  DRAWING_MAX_UPLOAD_BYTES,
  DRAWING_MAX_UPLOAD_LABEL,
  isAllowedDrawingFileType,
} from "@/lib/drawings/upload-constraints";

interface SignedUploadRequest {
  file_name: string;
  file_size: number;
  file_type?: string;
}

/** Builds a safe storage file name for Supabase object paths. */
function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.-]/g, "_");
}

/**
 * POST /api/projects/[projectId]/drawings/upload-url
 * Creates a signed Supabase Storage upload URL for direct browser uploads.
 */
export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/drawings/upload-url#POST",
  async ({ request, params }) => {
    const { projectId } = await params;

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/drawings/upload-url#POST",
        message: "Authentication required.",
      });
    }

    try {
      const body = (await request.json()) as SignedUploadRequest;

      if (!body.file_name || !Number.isFinite(body.file_size) || body.file_size <= 0) {
        return NextResponse.json(
          { error: "Missing required fields: file_name, file_size" },
          { status: 400 },
        );
      }

      if (body.file_size > DRAWING_MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: `File too large. Maximum size is ${DRAWING_MAX_UPLOAD_LABEL}.` },
          { status: 400 },
        );
      }

      if (!isAllowedDrawingFileType({ name: body.file_name, type: body.file_type ?? "" })) {
        return NextResponse.json(
          {
            error: `Unsupported file type: ${body.file_type || body.file_name}. Drawings must be PDF or image files (PNG, JPEG, TIFF, SVG, WEBP) or DWG/DXF files.`,
          },
          { status: 400 },
        );
      }

      const timestamp = Date.now();
      const sanitizedFilename = sanitizeFilename(body.file_name);
      const storagePath = `${projectId}/drawings/tmp/${timestamp}_${sanitizedFilename}`;

      // Sensitive: this endpoint authorizes direct object writes into project storage.
      const serviceClient = createServiceClient();
      const { data, error } = await serviceClient.storage
        .from("project-files")
        .createSignedUploadUrl(storagePath);

      if (error || !data) {
        return apiErrorResponse(new Error(`Failed to create signed upload URL: ${error?.message ?? "Unknown error"}`));
      }

      return NextResponse.json({
        path: data.path,
        token: data.token,
      });
    } catch (error) {
      return apiErrorResponse(error);
    }
  },
);
