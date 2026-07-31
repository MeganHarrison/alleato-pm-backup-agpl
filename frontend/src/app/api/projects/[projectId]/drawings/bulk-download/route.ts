import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import JSZip from "jszip";

const MAX_DRAWINGS = 50;

export const POST = withApiGuardrails(
  "projects/[projectId]/drawings/bulk-download#POST",
  async ({ request, params }) => {
    const { projectId } = params as { projectId: string };
    const projectIdNum = Number(projectId);
    if (isNaN(projectIdNum)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/drawings/bulk-download#POST",
        message: "Unauthorized",
        status: 401,
      });
    }

    let body: { drawingIds: string[] };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { drawingIds } = body;
    if (!Array.isArray(drawingIds) || drawingIds.length === 0) {
      return NextResponse.json({ error: "drawingIds array is required" }, { status: 400 });
    }
    if (drawingIds.length > MAX_DRAWINGS) {
      return NextResponse.json(
        { error: `Cannot download more than ${MAX_DRAWINGS} drawings at once` },
        { status: 400 }
      );
    }

    // Fetch drawings with their current revision file info — verify they belong to project
    const { data: drawings, error: drawError } = await supabase
      .from("drawing_log")
      .select("id, drawing_number, title, file_url, file_name, file_type")
      .in("id", drawingIds)
      .eq("project_id", projectIdNum)
      .is("deleted_at", null);

    if (drawError) return NextResponse.json({ error: drawError.message }, { status: 500 });
    if (!drawings || drawings.length === 0) {
      return NextResponse.json({ error: "No drawings found" }, { status: 404 });
    }

    const zip = new JSZip();
    const errors: string[] = [];

    await Promise.all(
      drawings.map(async (drawing) => {
        if (!drawing.file_url) {
          errors.push(`${drawing.drawing_number}: no file attached`);
          return;
        }

        try {
          // Get signed URL for the file
          const storagePath = drawing.file_url.split("/project-files/")[1];
          if (!storagePath) {
            errors.push(`${drawing.drawing_number}: invalid file URL`);
            return;
          }

          const { data: signedData, error: signError } = await supabase.storage
            .from("project-files")
            .createSignedUrl(storagePath, 300); // 5-minute URL for download

          if (signError || !signedData?.signedUrl) {
            errors.push(`${drawing.drawing_number}: could not generate download URL`);
            return;
          }

          const response = await fetch(signedData.signedUrl);
          if (!response.ok) {
            errors.push(`${drawing.drawing_number}: download failed (${response.status})`);
            return;
          }

          const buffer = await response.arrayBuffer();
          const ext = drawing.file_name?.split(".").pop() ?? "pdf";
          const safeNumber = drawing.drawing_number?.replace(/[^a-zA-Z0-9\-_.]/g, "_") ?? drawing.id;
          const fileName = `${safeNumber}.${ext}`;

          zip.file(fileName, buffer);
        } catch (err) {
          errors.push(`${drawing.drawing_number}: ${err instanceof Error ? err.message : "unknown error"}`);
        }
      })
    );

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const today = new Date().toISOString().split("T")[0];

    const headers = new Headers({
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="drawings-${today}.zip"`,
      "Content-Length": String(zipBuffer.byteLength),
    });

    if (errors.length > 0) {
      headers.set("X-Download-Errors", JSON.stringify(errors));
    }

    return new NextResponse(zipBuffer as unknown as BodyInit, { headers });
  },
);
