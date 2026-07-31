import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";

const createSpecificationDivisionSchema = z.object({
  division_number: z.string().trim().min(1).max(20),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(500).optional().nullable(),
});

export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/specifications/divisions#GET",
  async ({ params }) => {
    const { projectId } = await params;
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/specifications/divisions#GET",
        message: "Authentication required.",
      });
    }

    const projectIdNum = Number.parseInt(projectId, 10);
    if (!Number.isFinite(projectIdNum)) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "projects/[projectId]/specifications/divisions#GET",
        message: "Invalid project ID.",
      });
    }

        const { data, error } = await serviceDb.from("specification_divisions")
      .select("id, division_number, title, description")
      .eq("project_id", projectIdNum)
      .order("division_number");

    if (error) return apiErrorResponse(error);

    return NextResponse.json(data ?? []);
  },
);

export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/specifications/divisions#POST",
  async ({ request, params }) => {
    const { projectId } = await params;
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/specifications/divisions#POST",
        message: "Authentication required.",
      });
    }

    const projectIdNum = Number.parseInt(projectId, 10);
    if (!Number.isFinite(projectIdNum)) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "projects/[projectId]/specifications/divisions#POST",
        message: "Invalid project ID.",
      });
    }

    const parsed = createSpecificationDivisionSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "projects/[projectId]/specifications/divisions#POST",
        message: "Division number and title are required.",
      });
    }

        const { data, error } = await serviceDb.from("specification_divisions")
      .insert({
        project_id: projectIdNum,
        division_number: parsed.data.division_number,
        title: parsed.data.title,
        description: parsed.data.description || null,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          {
            error: "Specification division already exists",
            details: "Division numbers must be unique within a project.",
          },
          { status: 409 },
        );
      }

      return apiErrorResponse(error);
    }

    return NextResponse.json(data, { status: 201 });
  },
);
