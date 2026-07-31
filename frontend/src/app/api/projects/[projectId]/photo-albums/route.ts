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

const createAlbumSchema = z.object({
  name: z.string().min(1, "Album name is required").max(100),
  description: z.string().nullable().optional(),
});

export const GET = withApiGuardrails(
  "projects/[projectId]/photo-albums#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/photo-albums#GET",
        message: "Authentication required.",
      });
    }

    const { data, error } = await supabase
      .from("photo_albums")
      .select("*")
      .eq("project_id", parseInt(projectId, 10))
      .order("name", { ascending: true });

    if (error) return apiErrorResponse(error);
    return NextResponse.json(data ?? []);
    },
);

export const POST = withApiGuardrails(
  "projects/[projectId]/photo-albums#POST",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/photo-albums#POST", message: "Authentication required." });
    }

    const body = await request.json();
    const validated = createAlbumSchema.parse(body);

    const { data, error } = await supabase
      .from("photo_albums")
      .insert({
        ...validated,
        project_id: parseInt(projectId, 10),
        created_by: user.id,
      })
      .select("*")
      .single();

    if (error) return apiErrorResponse(error);
    return NextResponse.json(data, { status: 201 });
    },
);
