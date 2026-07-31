import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { SMART_GROUPS } from "@/features/documents/smart-groups";
import { DEFAULT_EXCLUDED_TYPES } from "@/app/api/documents/status/route";

export const dynamic = "force-dynamic";

export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/documents/group-counts#GET",
  async ({ params }) => {
    const { projectId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/documents/group-counts#GET",
        message: "Authentication required.",
      });
    }

    const numericProjectId = Number(projectId);
    if (Number.isNaN(numericProjectId)) {
      throw new GuardrailError({
        code: "BAD_REQUEST",
        where: "projects/[projectId]/documents/group-counts#GET",
        message: "Invalid project id.",
        status: 400,
      });
    }

    const counts: Record<string, number> = {};

    const queries = SMART_GROUPS.map((group) => {
      let query = supabase
        .from("document_metadata")
        .select("id", { count: "exact", head: true })
        .eq("project_id", numericProjectId)
        .is("deleted_at", null);

      if (group.filter.category) {
        query = query.eq("category", String(group.filter.category));
      }
      if (group.filter.document_type) {
        query = query.eq("document_type", String(group.filter.document_type));
      }
      if (group.filter.type) {
        query = query.eq("type", String(group.filter.type));
      } else {
        // Match the grid's default population: hide communication/transcript
        // types unless a group explicitly selects them via a `type` filter.
        for (const excluded of DEFAULT_EXCLUDED_TYPES) {
          query = query.neq("type", excluded);
        }
      }
      if (group.search) {
        // Mirror the /api/documents/status search predicate so the rail count
        // matches the filtered grid exactly.
        const escaped = group.search.replace(/[%_,]/g, (c) => `\\${c}`);
        query = query.or(
          [
            `title.ilike.%${escaped}%`,
            `summary.ilike.%${escaped}%`,
            `overview.ilike.%${escaped}%`,
            `participants.ilike.%${escaped}%`,
          ].join(","),
        );
      }

      return query.then(({ count, error }) => {
        if (error) {
          throw new GuardrailError({
            code: "DB_ERROR",
            where: "projects/[projectId]/documents/group-counts#GET",
            message: error.message,
          });
        }
        return { groupId: group.id, count: count ?? 0 };
      });
    });

    const results = await Promise.all(queries);
    for (const { groupId, count } of results) {
      counts[groupId] = count;
    }

    return NextResponse.json({ counts });
  },
);
