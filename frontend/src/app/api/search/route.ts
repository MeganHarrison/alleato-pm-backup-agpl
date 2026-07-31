export const dynamic = "force-dynamic";

/**
 * GET /api/search?q={string}&projectId={int}
 *
 * Site-wide search. Runs one query per entity in the search registry
 * (`global-search-config`) and returns a flat, grouped list of matches.
 *
 * - Global entities (projects, companies) are always searched.
 * - Project-scoped entities (RFIs, submittals, drawings, …) are only searched
 *   when a `projectId` is supplied.
 *
 * All queries go through the RLS-aware server client, so results are already
 * limited to what the current user is allowed to see.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/api-error";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import {
  SEARCH_ENTITY_CONFIGS,
  RESULTS_PER_GROUP,
  sanitizeSearchTerm,
  type GlobalSearchResult,
} from "@/lib/search/global-search-config";

const querySchema = z.object({
  q: z.string().min(1).max(200),
  projectId: z.coerce.number().int().positive().optional(),
});

interface QueryErrorLike {
  message: string;
}

interface QueryResult {
  data: Record<string, unknown>[] | null;
  error: QueryErrorLike | null;
}

interface DynamicSelectBuilder extends PromiseLike<QueryResult> {
  eq(column: string, value: unknown): DynamicSelectBuilder;
  is(column: string, value: unknown): DynamicSelectBuilder;
  not(column: string, operator: string, value: unknown): DynamicSelectBuilder;
  or(filter: string): DynamicSelectBuilder;
  limit(count: number): DynamicSelectBuilder;
}

interface DynamicTableClient {
  from(table: string): {
    select(columns: string): DynamicSelectBuilder;
  };
}

/**
 * Narrows the fully-typed Supabase client to the dynamic-table shape this route
 * needs (arbitrary table + column names driven by the search registry). Routed
 * through `unknown` as a single, explicit assertion rather than a banned
 * double-cast — so it stays within the repo's typed-adapter guardrail.
 */
function asDynamicTableClient(client: unknown): DynamicTableClient {
  return client as DynamicTableClient;
}

function buildSubtitle(
  numberValue: unknown,
  statusValue: unknown,
): string | null {
  const parts: string[] = [];
  if (numberValue !== null && numberValue !== undefined && numberValue !== "") {
    parts.push(`#${String(numberValue)}`);
  }
  if (statusValue !== null && statusValue !== undefined && statusValue !== "") {
    parts.push(String(statusValue));
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export async function GET(request: Request) {
  try {
    const user = await getApiRouteUser();
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error_code: "AUTH_EXPIRED",
          error_message: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      q: searchParams.get("q"),
      projectId: searchParams.get("projectId") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { projectId = null } = parsed.data;
    const term = sanitizeSearchTerm(parsed.data.q);
    if (!term) {
      return NextResponse.json({ results: [] });
    }

    const supabase = asDynamicTableClient(await createClient());

    // Only search entities we can actually scope: global entities always,
    // project-scoped entities only when a project is active.
    const applicableConfigs = SEARCH_ENTITY_CONFIGS.filter(
      (config) => !config.projectScoped || projectId !== null,
    );

    const groupedResults = await Promise.all(
      applicableConfigs.map(async (config) => {
        const columns = Array.from(
          new Set(
            [
              "id",
              config.titleColumn,
              config.numberColumn,
              config.statusColumn,
            ].filter((c): c is string => Boolean(c)),
          ),
        ).join(", ");

        let query = supabase.from(config.table).select(columns);

        if (config.projectScoped && projectId !== null) {
          query = query.eq("project_id", projectId);
        }
        if (config.softDeleteColumn) {
          query = query.is(config.softDeleteColumn, null);
        }
        // Exclude soft-deleted / archived rows flagged by a boolean column.
        // `.not(col, "is", true)` keeps both `false` and `null` rows.
        for (const column of config.excludeWhenTrue) {
          query = query.not(column, "is", true);
        }

        const orFilter = config.searchColumns
          .map((column) => `${column}.ilike.%${term}%`)
          .join(",");
        query = query.or(orFilter).limit(RESULTS_PER_GROUP);

        const { data, error } = await query;

        // A single failing entity (e.g. a missing view) must not sink the whole
        // search — log and return an empty group instead.
        if (error) {
          console.error(
            `[global-search] ${config.kind} query failed: ${error.message}`,
          );
          return [] as GlobalSearchResult[];
        }

        return (data ?? []).map((row): GlobalSearchResult => {
          const id = String(row.id);
          const rawTitle = row[config.titleColumn];
          return {
            id,
            kind: config.kind,
            groupLabel: config.groupLabel,
            title:
              rawTitle !== null && rawTitle !== undefined && rawTitle !== ""
                ? String(rawTitle)
                : "(untitled)",
            subtitle: buildSubtitle(
              config.numberColumn ? row[config.numberColumn] : null,
              config.statusColumn ? row[config.statusColumn] : null,
            ),
            url: config.buildUrl(id, projectId),
          };
        });
      }),
    );

    return NextResponse.json({ results: groupedResults.flat() });
  } catch (err) {
    console.error("[global-search] unhandled error:", err);
    return apiErrorResponse(err);
  }
}
