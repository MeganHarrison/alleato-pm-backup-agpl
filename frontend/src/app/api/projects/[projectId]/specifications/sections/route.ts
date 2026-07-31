import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";

const createSpecificationSectionSchema = z.object({
  section_number: z.string().trim().min(1).max(50),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(1000).optional().nullable(),
});

export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/specifications/sections#POST",
  async ({ request, params }) => {
    const { projectId } = await params;
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/specifications/sections#POST",
        message: "Authentication required.",
      });
    }

    const projectIdNum = Number.parseInt(projectId, 10);
    if (!Number.isFinite(projectIdNum)) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "projects/[projectId]/specifications/sections#POST",
        message: "Invalid project ID.",
      });
    }

    const parsed = createSpecificationSectionSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "projects/[projectId]/specifications/sections#POST",
        message: "Specification section number and title are required.",
      });
    }

        const { data, error } = await serviceDb.from("specification_sections")
      .insert({
        project_id: projectIdNum,
        section_number: parsed.data.section_number,
        title: parsed.data.title,
        description: parsed.data.description || null,
        status: "active",
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          {
            error: "Specification section already exists",
            details: "Section numbers must be unique within a project.",
          },
          { status: 409 },
        );
      }

      return apiErrorResponse(error);
    }

    return NextResponse.json(data, { status: 201 });
  },
);
