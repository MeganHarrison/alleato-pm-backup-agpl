import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";

const MAX_SKETCH_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export const GET = withApiGuardrails(
  "projects/[projectId]/drawings/[drawingId]/revisions/[revisionId]/sketches#GET",
  async ({ params }) => {
    const { projectId, revisionId } = params as { projectId: string; drawingId: string; revisionId: string };
    const projectIdNum = Number(projectId);
    if (isNaN(projectIdNum)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/drawings/[drawingId]/revisions/[revisionId]/sketches#GET",
        message: "Unauthorized",
        status: 401,
      });
    }

    const { data, error } = await supabase
      .from("drawing_sketches")
      .select("*")
      .eq("drawing_revision_id", revisionId)
      .order("sketch_number", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Generate signed URLs for each sketch file
    const sketchesWithUrls = await Promise.all(
      (data || []).map(async (sketch) => {
        if (!sketch.file_url) return { ...sketch, signed_url: null };
        const path = sketch.file_url.split("/project-files/")[1];
        if (!path) return { ...sketch, signed_url: null };
        const { data: signedData } = await supabase.storage
          .from("project-files")
          .createSignedUrl(path, 3600);
        return { ...sketch, signed_url: signedData?.signedUrl ?? null };
      })
    );

    return NextResponse.json({ sketches: sketchesWithUrls });
  },
);

export const POST = withApiGuardrails(
  "projects/[projectId]/drawings/[drawingId]/revisions/[revisionId]/sketches#POST",
  async ({ request, params }) => {
    const { projectId, drawingId, revisionId } = params as { projectId: string; drawingId: string; revisionId: string };
    const projectIdNum = Number(projectId);
    if (isNaN(projectIdNum)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/drawings/[drawingId]/revisions/[revisionId]/sketches#POST",
        message: "Unauthorized",
        status: 401,
      });
    }

    // Verify revision belongs to drawing and project
    const { data: revision, error: revError } = await supabase
      .from("drawing_revisions")
      .select("id, drawing_id")
      .eq("id", revisionId)
      .eq("drawing_id", drawingId)
      .single();

    if (revError || !revision) {
      return NextResponse.json({ error: "Revision not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const name = formData.get("name") as string | null;
    const sketchNumber = formData.get("sketch_number") as string | null;
    const description = formData.get("description") as string | null;

    if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

    if (file.size > MAX_SKETCH_SIZE_BYTES) {
      return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 });
    }

    // Auto-assign sketch_number if not provided
    let finalSketchNumber = sketchNumber;
    if (!finalSketchNumber) {
      const { count } = await supabase
        .from("drawing_sketches")
        .select("id", { count: "exact", head: true })
        .eq("drawing_revision_id", revisionId);
      finalSketchNumber = String((count ?? 0) + 1);
    }

    // Upload file to Supabase Storage
    const storagePath = `${projectId}/drawings/sketches/${revisionId}/${Date.now()}-${file.name}`;
    const buffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("project-files")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage
      .from("project-files")
      .getPublicUrl(storagePath);

    const { data: sketch, error: insertError } = await supabase
      .from("drawing_sketches")
      .insert({
        drawing_revision_id: revisionId,
        name,
        sketch_number: finalSketchNumber,
        description: description || null,
        file_url: publicUrl,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      // Clean up uploaded file on insert failure
      await supabase.storage.from("project-files").remove([storagePath]);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ sketch }, { status: 201 });
  },
);
