import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const updatePackageSchema = z.object({
  name: z.string().min(1, "Package name is required").optional(),
  description: z.string().nullable().optional(),
});

/**
 * PATCH /api/projects/[projectId]/submittals/packages/[packageId]
 * Updates a submittal package name or description.
 */
export const PATCH = withApiGuardrails(
  "projects/[projectId]/submittals/packages/[packageId]#PATCH",
  async ({ request, params }) => {
    const { projectId, packageId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/submittals/packages/[packageId]#PATCH",
        message: "Authentication required.",
      });
    }

    const body = await request.json();
    const parsed = updatePackageSchema.parse(body);

    const { data, error } = await supabase
      .from("submittal_packages")
      .update({
        ...parsed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", packageId)
      .eq("project_id", parseInt(projectId, 10))
      .select()
      .single();

    if (error) return apiErrorResponse(error);
    if (!data) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  },
);

/**
 * DELETE /api/projects/[projectId]/submittals/packages/[packageId]
 * Deletes a submittal package and unlinks any submittals that reference it.
 */
export const DELETE = withApiGuardrails(
  "projects/[projectId]/submittals/packages/[packageId]#DELETE",
  async ({ request, params }) => {
    const { projectId, packageId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/submittals/packages/[packageId]#DELETE",
        message: "Authentication required.",
      });
    }

    // Unlink any submittals that reference this package before deleting
    await supabase
      .from("submittals")
      .update({ submittal_package_id: null })
      .eq("submittal_package_id", packageId)
      .eq("project_id", parseInt(projectId, 10));

    const { error } = await supabase
      .from("submittal_packages")
      .delete()
      .eq("id", packageId)
      .eq("project_id", parseInt(projectId, 10));

    if (error) return apiErrorResponse(error);

    return new NextResponse(null, { status: 204 });
  },
);
