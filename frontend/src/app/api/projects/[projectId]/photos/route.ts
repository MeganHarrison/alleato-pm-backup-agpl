import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

const createPhotoSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().nullable().optional(),
  album: z.string().nullable().optional(),
  file_name: z.string().min(1, "File name is required"),
  file_url: z.string().min(1, "File URL is required"),
  file_size: z.number().nullable().optional(),
  content_type: z.string().nullable().optional(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  date_taken: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  trade: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  is_private: z.boolean().nullable().optional(),
  starred: z.boolean().nullable().optional(),
});

/**
 * GET /api/projects/[projectId]/photos
 * Returns all photos for the project, with optional filters.
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/photos#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/photos#GET",
        message: "Authentication required.",
      });
    }
    const { searchParams } = new URL(request.url);

    const album = searchParams.get("album");
    const search = searchParams.get("search");
    const starred = searchParams.get("starred");

    const deleted = searchParams.get("deleted") === "true";

    let query = supabase
      .from("project_photos")
      .select("*")
      .eq("project_id", parseInt(projectId, 10))
      .order("created_at", { ascending: false });

    if (deleted) {
      query = query.not("deleted_at", "is", null);
    } else {
      query = query.is("deleted_at", null);
    }

    if (album) {
      query = query.eq("album", album);
    }

    if (starred === "true") {
      query = query.eq("starred", true);
    }

    if (search) {
      query = query.or(
        `title.ilike.%${search}%,description.ilike.%${search}%,file_name.ilike.%${search}%`,
      );
    }

    const { data, error } = await query;

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json(data ?? []);
    },
);

/**
 * POST /api/projects/[projectId]/photos
 * Creates a new photo record.
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/photos#POST",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();
    const body = await request.json();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/photos#POST", message: "Authentication required." });
    }

    const validatedData = createPhotoSchema.parse(body);

    const { data, error } = await supabase
      .from("project_photos")
      .insert({
        ...validatedData,
        project_id: parseInt(projectId, 10),
        uploaded_by: user.id,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json(data, { status: 201 });
    },
);
