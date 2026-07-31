/**
 * GET /api/projects/[projectId]/contacts
 *
 * Returns all people in the project directory (contacts + team members)
 * as a flat list for use in form dropdowns/comboboxes.
 */

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";

export const GET = withApiGuardrails(
  "projects/[projectId]/contacts#GET",
  async ({ params }) => {
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/contacts#GET",
        message: "Authentication required.",
      });
    }

    // Fetch all people who are members of this project
    const { data, error } = await supabase
      .from("project_directory_memberships")
      .select("person:people!inner(id, first_name, last_name, email, person_type)")
      .eq("project_id", projectIdNum)
      .eq("status", "active")
      .order("person(last_name)", { ascending: true });

    if (error) {
      return apiErrorResponse(error);
    }

    // Flatten and deduplicate
    const seen = new Set<string>();
    const rows = (data ?? []) as unknown as Array<{
      person:
        | Array<{
            id: string;
            first_name: string | null;
            last_name: string | null;
            email: string | null;
            person_type: string | null;
          }>
        | null;
    }>;
    const contacts = rows
      .map((row) => {
        const p = Array.isArray(row.person) ? row.person[0] ?? null : row.person;
        if (!p) return null;
        return {
          id: p.id,
          name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Unnamed",
          email: p.email,
          person_type: p.person_type,
        };
      })
      .filter((c): c is NonNullable<typeof c> => {
        if (!c) return false;
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(contacts);
  },
);
