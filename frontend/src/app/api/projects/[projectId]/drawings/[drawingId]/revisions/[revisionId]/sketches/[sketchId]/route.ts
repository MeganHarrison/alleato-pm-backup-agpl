import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";

export const DELETE = withApiGuardrails(
  "projects/[projectId]/drawings/[drawingId]/revisions/[revisionId]/sketches/[sketchId]#DELETE",
  async ({ params }) => {
    const { projectId, revisionId, sketchId } = params as {
      projectId: string;
      drawingId: string;
      revisionId: string;
      sketchId: string;
    };
    const projectIdNum = Number(projectId);
    if (isNaN(projectIdNum)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/drawings/[drawingId]/revisions/[revisionId]/sketches/[sketchId]#DELETE",
        message: "Unauthorized",
        status: 401,
      });
    }

    // Find the sketch to get its file_url for cleanup
    const { data: sketch, error: findError } = await supabase
      .from("drawing_sketches")
      .select("id, file_url")
      .eq("id", sketchId)
      .eq("drawing_revision_id", revisionId)
      .single();

    if (findError || !sketch) {
      return NextResponse.json({ error: "Sketch not found" }, { status: 404 });
    }

    // Delete DB record first
    const { error: deleteError } = await supabase
      .from("drawing_sketches")
      .delete()
      .eq("id", sketchId)
      .eq("drawing_revision_id", revisionId);

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

    // Attempt to remove from storage (best-effort, don't fail if missing)
    if (sketch.file_url) {
      const storagePath = sketch.file_url.split("/project-files/")[1];
      if (storagePath) {
        await supabase.storage.from("project-files").remove([storagePath]);
      }
    }

    return new NextResponse(null, { status: 204 });
  },
);
