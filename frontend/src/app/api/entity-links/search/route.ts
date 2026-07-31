export const dynamic = "force-dynamic";

/**
 * GET /api/entity-links/search?targetType=rfi&projectId={int}&q={string}
 *
 * Search for entities by type within a project.
 * Used by the RelatedItemsPanel "Add Link" dialog to let the user pick a target.
 *
 * Returns up to 20 results matching the query string.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/api-error";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import {
  ENTITY_SOURCE_TABLE,
  type EntityType,
} from "@/lib/entity-links/table-map";

const VALID_ENTITY_TYPES: EntityType[] = [
  "rfi",
  "submittal",
  "change_event",
  "drawing",
  "document",
  "photo",
  "punch_item",
  "observation",
  "daily_log",
];

const searchSchema = z.object({
  targetType: z.enum(VALID_ENTITY_TYPES as [EntityType, ...EntityType[]]),
  projectId: z.coerce.number().int().positive(),
  q: z.string().min(1).max(200),
});

interface SearchResult {
  id: string;
  title: string;
}

interface QueryErrorLike {
  message: string;
}

interface QueryResult<T> {
  data: T[] | null;
  error: QueryErrorLike | null;
}

interface DynamicSelectBuilder<T> extends PromiseLike<QueryResult<T>> {
  eq(column: string, value: unknown): DynamicSelectBuilder<T>;
  ilike(column: string, value: string): DynamicSelectBuilder<T>;
  limit(count: number): DynamicSelectBuilder<T>;
}

interface DynamicTableClient {
  from(table: string): {
    select(columns: string): DynamicSelectBuilder<Record<string, unknown>>;
  };
}

/** Which column to display as the title and to search on */
function getTitleColumn(entityType: EntityType): string {
  const map: Record<EntityType, string> = {
    rfi: "subject",
    submittal: "title",
    change_event: "title",
    drawing: "name",
    document: "file_name",
    photo: "file_name",
    punch_item: "title",
    observation: "name",
    daily_log: "date",
  };
  return map[entityType];
}

export async function GET(request: Request) {
  try {
    const user = await getApiRouteUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error_code: "AUTH_EXPIRED", error_message: "Unauthorized" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const parsed = searchSchema.safeParse({
      targetType: searchParams.get("targetType"),
      projectId: searchParams.get("projectId"),
      q: searchParams.get("q"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const {
      targetType,
      projectId: numericProjectId,
      q,
    } = parsed.data;
    const supabase = await createClient();
    const dynamicSupabase = supabase as unknown as DynamicTableClient;
    const sourceTable = ENTITY_SOURCE_TABLE[targetType];
    const titleColumn = getTitleColumn(targetType);

    // Build the query — filter by project_id and title match
    // Use ilike for case-insensitive search
    let query = dynamicSupabase
      .from(sourceTable)
      .select(`id, ${titleColumn}`)
      .limit(20);

    // All Tier-1 entity tables have a project_id column
    query = query.eq("project_id", numericProjectId);

    query = query.ilike(titleColumn, `%${q}%`);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: `Search failed: ${error.message}` },
        { status: 500 },
      );
    }

    const results: SearchResult[] = (data ?? []).map((row: Record<string, unknown>) => {
      const r = row;
      return {
        id: String(r.id),
        title: (r[titleColumn] as string | null) ?? String(r.id),
      };
    });

    return NextResponse.json({ results });
  } catch (err) {
    console.error("[entity-links search] unhandled error:", err);
    return apiErrorResponse(err);
  }
}
