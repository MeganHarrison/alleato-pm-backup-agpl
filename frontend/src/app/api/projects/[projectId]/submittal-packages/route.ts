import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

const createPackageSchema = z.object({
  name: z.string().min(1, "Package name is required"),
  description: z.string().nullable().optional(),
});

/**
 * Compatibility endpoint for package CRUD used by remediation workflows.
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/submittal-packages#GET",
  async ({ params }) => {
    const { projectId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/submittal-packages#GET",
        message: "Authentication required.",
      });
    }

    const { data, error } = await supabase
      .from("submittal_packages")
      .select("id, name, description")
      .eq("project_id", parseInt(projectId, 10))
      .order("name");

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json(data ?? []);
  },
);

export const POST = withApiGuardrails(
  "projects/[projectId]/submittal-packages#POST",
  async ({ request, params }) => {
    const { projectId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/submittal-packages#POST",
        message: "Authentication required.",
      });
    }

    const body = await request.json();
    const { name, description } = createPackageSchema.parse(body);

    const { data, error } = await supabase
      .from("submittal_packages")
      .insert({
        project_id: parseInt(projectId, 10),
        name,
        description: description ?? null,
        created_by: user.id,
      })
      .select("id, name, description")
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json(data, { status: 201 });
  },
);
