import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ projectId: string; albumId: string }>;
}

const updateAlbumSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
});

export const PATCH = withApiGuardrails(
  "projects/[projectId]/photo-albums/[albumId]#PATCH",
  async ({ request, params }) => {
  
    const { projectId, albumId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/photo-albums/[albumId]#PATCH", message: "Authentication required." });
    }

    const body = await request.json();
    const validated = updateAlbumSchema.parse(body);

    const { data, error } = await supabase
      .from("photo_albums")
      .update({ ...validated, updated_at: new Date().toISOString() })
      .eq("id", albumId)
      .eq("project_id", parseInt(projectId, 10))
      .select("*")
      .single();

    if (error) return apiErrorResponse(error);
    if (!data) return NextResponse.json({ error: "Album not found" }, { status: 404 });
    return NextResponse.json(data);
    },
);

export const DELETE = withApiGuardrails(
  "projects/[projectId]/photo-albums/[albumId]#DELETE",
  async ({ request, params }) => {
  
    const { projectId, albumId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/photo-albums/[albumId]#DELETE", message: "Authentication required." });
    }

    // Move photos in this album to "Default" before deleting
    await supabase
      .from("project_photos")
      .update({ album: "Default" })
      .eq("project_id", parseInt(projectId, 10))
      .eq("album", albumId); // matched by name below — see note

    const { error } = await supabase
      .from("photo_albums")
      .delete()
      .eq("id", albumId)
      .eq("project_id", parseInt(projectId, 10));

    if (error) return apiErrorResponse(error);
    return NextResponse.json({ success: true });
    },
);
