import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";

import { getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";
import { apiErrorResponse } from "@/lib/api-error";
import { logger } from "@/lib/logger";

/**
 * GET /api/projects/[projectId]/employees
 * Returns active employees/users assigned to the project's Project Team.
 */
export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/employees#GET",
  async ({ params }) => {
    const { projectId } = await params;
    const projectIdNum = Number.parseInt(projectId, 10);

    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    }

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/employees#GET",
        message: "Authentication required to load employees.",
        status: 401,
        severity: "medium",
      });
    }

        const { data, error } = await serviceDb.from("project_role_members")
      .select(
        `
        person:people!project_role_members_person_id_fkey!inner(
          id,
          first_name,
          last_name,
          person_type,
          status
        ),
        project_role:project_roles!inner(project_id)
      `,
      )
      .eq("project_role.project_id", projectIdNum)
      .in("person.person_type", ["employee", "user"])
      .eq("person.status", "active");

    if (error) {
      logger.error({
        msg: "Error fetching project team employees:",
        error: error instanceof Error ? error.message : String(error),
      });
      return apiErrorResponse(error);
    }

    const employeeMap = new Map<
      string,
      {
        id: string;
        first_name: string | null;
        last_name: string | null;
      }
    >();

    for (const row of data ?? []) {
      const person = row.person;
      if (!person) continue;
      employeeMap.set(person.id, {
        id: person.id,
        first_name: person.first_name,
        last_name: person.last_name,
      });
    }

    const employees = Array.from(employeeMap.values()).sort((a, b) => {
      const aName = [a.last_name, a.first_name].filter(Boolean).join(" ");
      const bName = [b.last_name, b.first_name].filter(Boolean).join(" ");
      return aName.localeCompare(bName);
    });

    return NextResponse.json(employees);
  },
);
