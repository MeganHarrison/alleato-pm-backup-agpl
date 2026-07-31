import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{
    projectId: string;
    drawingId: string;
    revisionId: string;
  }>;
}

export const GET = withApiGuardrails(
  "projects/[projectId]/drawings/[drawingId]/revisions/[revisionId]/download#GET",
  async ({ request, params }) => {

    // Validate auth for sensitive download operation.
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/drawings/[drawingId]/revisions/[revisionId]/download#GET", message: "Authentication required." });
    }

    const { projectId, drawingId, revisionId } = await params;
    const serviceClient = createServiceClient();

    // Ensure the requested revision belongs to the requested drawing.
    const { data: revision, error } = await serviceDb.from("drawing_revisions")
      .select("id, drawing_id, file_url, file_name, file_size")
      .eq("id", revisionId)
      .eq("drawing_id", drawingId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new GuardrailError({
          code: "ROUTE_BINDING_MISSING",
          where: "projects/[projectId]/drawings/[drawingId]/revisions/[revisionId]/download#GET",
          message: "Revision not found.",
          status: 404,
          severity: "low",
        });
      }
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/drawings/[drawingId]/revisions/[revisionId]/download#GET",
        message: "Failed to load drawing revision for download.",
        details: { reason: error.message },
        cause: error,
      });
    }

    // Validate drawing ownership to the requested project with an explicit query.
    const { data: drawingOwner, error: drawingOwnerError } = await serviceDb.from("drawings")
      .select("id")
      .eq("id", drawingId)
      .eq("project_id", Number.parseInt(projectId, 10))
      .single();

    if (drawingOwnerError || !drawingOwner) {
      throw new GuardrailError({
        code: "ROUTE_BINDING_MISSING",
        where: "projects/[projectId]/drawings/[drawingId]/revisions/[revisionId]/download#GET",
        message: "Revision not found.",
        status: 404,
        severity: "low",
      });
    }

    let storagePath: string | null = null;
    try {
      const parsedUrl = new URL(revision.file_url);
      const publicPrefix = "/storage/v1/object/public/project-files/";
      const urlPath = parsedUrl.pathname;
      if (urlPath.startsWith(publicPrefix)) {
        storagePath = decodeURIComponent(urlPath.slice(publicPrefix.length));
      }
    } catch {
      // If file_url is already stored as a path, use it directly.
      storagePath = revision.file_url;
    }

    if (!storagePath) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/drawings/[drawingId]/revisions/[revisionId]/download#GET",
        message: "Invalid file path for revision.",
      });
    }

    // Get signed URL for file download.
    const { data: signedUrlData, error: urlError } = await serviceClient.storage
      .from("project-files")
      .createSignedUrl(storagePath, 3600); // 1 hour expiry

    if (urlError) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "projects/[projectId]/drawings/[drawingId]/revisions/[revisionId]/download#GET",
        message: "Failed to generate signed download URL.",
        details: { reason: urlError.message },
        cause: urlError,
      });
    }

    // Log download for audit trail (sensitive write).
    const { error: downloadLogError } = await serviceDb.from("drawing_downloads")
      .insert({
        drawing_revision_id: revisionId,
        downloaded_by: user.id,
        ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null,
        user_agent: request.headers.get("user-agent") || null,
      });

    if (downloadLogError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/drawings/[drawingId]/revisions/[revisionId]/download#GET",
        message: "Failed to record drawing download audit log.",
        details: { reason: downloadLogError.message },
        cause: downloadLogError,
      });
    }

    return NextResponse.json({
      downloadUrl: signedUrlData.signedUrl,
      fileName: revision.file_name,
      fileSize: revision.file_size,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    });

    },
);
