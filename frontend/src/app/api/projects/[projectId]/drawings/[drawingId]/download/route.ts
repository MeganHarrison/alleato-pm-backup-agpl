import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";

function reportDrawingDownloadSideEffectFailure(details: Record<string, unknown>) {
  console.warn(JSON.stringify({
    event: "drawing_download_side_effect_failed",
    timestamp: new Date().toISOString(),
    ...details,
  }));
}

/**
 * GET /api/projects/[projectId]/drawings/[drawingId]/download
 * Download the current revision of a drawing
 */
export const GET = withApiGuardrails<{ projectId: string; drawingId: string }>(
  "projects/[projectId]/drawings/[drawingId]/download#GET",
  async ({ request, params }) => {

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/drawings/[drawingId]/download#GET", message: "Authentication required." });
    }

    const { drawingId } = await params;
    const serviceClient = createServiceClient();

    // Get drawing with current revision
    const { data: drawing, error: drawingError } = await serviceDb.from("drawings")
      .select("*, current_revision:drawing_revisions!fk_drawings_current_revision(*)")
      .eq("id", drawingId)
      .single();

    if (drawingError || !drawing) {
      return NextResponse.json({ error: "Drawing not found" }, { status: 404 });
    }

    const revision = drawing.current_revision;
    if (!revision) {
      return NextResponse.json({ error: "No current revision found" }, { status: 404 });
    }

    // Extract storage path from the full URL
    // file_url format: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
    let downloadUrl = revision.file_url;
    try {
      const fileUrl = new URL(revision.file_url);
      const pathParts = fileUrl.pathname.split("/object/public/project-files/");
      if (pathParts.length === 2) {
        const storagePath = pathParts[1];
        const { data: signedUrlData, error: urlError } = await serviceClient.storage
          .from("project-files")
          .createSignedUrl(storagePath, 3600);
        if (!urlError && signedUrlData?.signedUrl) {
          downloadUrl = signedUrlData.signedUrl;
        }
      }
    } catch (error) {
      reportDrawingDownloadSideEffectFailure({
        operation: "create-signed-url",
        drawingId,
        revisionId: revision.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      await serviceDb.from("drawing_downloads").insert({
        drawing_revision_id: revision.id,
        downloaded_by: user.id,
        ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null,
        user_agent: request.headers.get("user-agent") || null,
      });
    } catch (error) {
      reportDrawingDownloadSideEffectFailure({
        operation: "record-download-audit",
        drawingId,
        revisionId: revision.id,
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return NextResponse.json({
      downloadUrl,
      fileName: revision.file_name,
      fileSize: revision.file_size,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    });
    },
);
