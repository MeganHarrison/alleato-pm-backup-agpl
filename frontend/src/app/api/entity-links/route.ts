export const dynamic = "force-dynamic";

/**
 * GET  /api/entity-links?entityType=rfi&entityId={uuid}&projectId={int}
 *   Returns grouped linked items for the given entity.
 *   Each group is keyed by the OTHER entity type.
 *
 * POST /api/entity-links
 *   Body: { sourceType, sourceId, targetType, targetId, projectId, linkType?, note? }
 *   Inserts into the appropriate link table.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/api-error";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import {
  getLinkSpecsForEntity,
  getLinkSpec,
  ENTITY_SOURCE_TABLE,
  ENTITY_LABEL,
  LINK_TYPES,
  type EntityType,
  type LinkType,
} from "@/lib/entity-links/table-map";

// ── Validation ────────────────────────────────────────────────────────────────

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

const getSchema = z.object({
  entityType: z.enum(VALID_ENTITY_TYPES as [EntityType, ...EntityType[]]),
  entityId: z.string().min(1),
  projectId: z.coerce.number().int().positive(),
});

const postSchema = z.object({
  sourceType: z.enum(VALID_ENTITY_TYPES as [EntityType, ...EntityType[]]),
  sourceId: z.string().min(1),
  targetType: z.enum(VALID_ENTITY_TYPES as [EntityType, ...EntityType[]]),
  targetId: z.string().min(1),
  projectId: z.coerce.number().int().positive(),
  linkType: z.enum([...LINK_TYPES] as [LinkType, ...LinkType[]]).optional().default("related"),
  note: z.string().optional(),
});

// ── Types ─────────────────────────────────────────────────────────────────────

interface LinkedItem {
  linkId: string;
  linkType: string;
  note: string | null;
  createdAt: string;
  tableName: string;
  targetType: EntityType;
  targetId: string | number;
  targetLabel: string;
  targetTitle: string;
}

interface GroupedLinks {
  targetType: EntityType;
  label: string;
  items: LinkedItem[];
}

interface QueryErrorLike {
  message: string;
  code?: string;
}

interface QueryResult<T> {
  data: T[] | null;
  error: QueryErrorLike | null;
}

interface SingleQueryResult<T> {
  data: T | null;
  error: QueryErrorLike | null;
}

interface DynamicSelectBuilder<T> extends PromiseLike<QueryResult<T>> {
  eq(column: string, value: unknown): DynamicSelectBuilder<T>;
  in(column: string, values: Array<string | number>): DynamicSelectBuilder<T>;
}

interface DynamicInsertBuilder<T> {
  select(columns: string): {
    single(): Promise<SingleQueryResult<T>>;
  };
}

interface DynamicTableClient {
  from(table: string): {
    select(columns: string): DynamicSelectBuilder<Record<string, unknown>>;
    insert(payload: Record<string, unknown>): DynamicInsertBuilder<Record<string, unknown>>;
  };
}

// ── GET ───────────────────────────────────────────────────────────────────────

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
    const parsed = getSchema.safeParse({
      entityType: searchParams.get("entityType"),
      entityId: searchParams.get("entityId"),
      projectId: searchParams.get("projectId"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const {
      entityType,
      entityId,
      projectId: numericProjectId,
    } = parsed.data;
    const supabase = await createClient();
    const dynamicSupabase = supabase as unknown as DynamicTableClient;

    const specs = getLinkSpecsForEntity(entityType);

    // Fetch from each relevant link table concurrently
    const results = await Promise.allSettled(
      specs.map(async (spec) => {
        const { data, error } = await dynamicSupabase
          .from(spec.table)
          .select("id, link_type, note, created_at, " + spec.targetColumn)
          .eq(spec.sourceColumn, entityId)
          .eq("project_id", numericProjectId);

        if (error) {
          throw new Error(`Failed to query ${spec.table}: ${error.message}`);
        }

        return { spec, rows: data ?? [] };
      }),
    );

    // Build grouped output
    const groups: GroupedLinks[] = [];

    for (const result of results) {
      if (result.status === "rejected") {
        console.error("[entity-links GET] table query failed:", result.reason);
        continue;
      }

      const { spec, rows } = result.value;
      if (rows.length === 0) continue;

      // Collect target IDs to batch-fetch titles
      const targetIds = rows.map((r: Record<string, unknown>) => r[spec.targetColumn]);
      const sourceTable = ENTITY_SOURCE_TABLE[spec.targetType];

      // Fetch titles for all target entities
      const titleColumn = getTitleColumn(spec.targetType);
      const { data: targets } = await dynamicSupabase
        .from(sourceTable)
        .select(`id, ${titleColumn}`)
        .in("id", targetIds as (string | number)[]);

      const targetMap = new Map<string | number, string>();
      for (const t of targets ?? []) {
        const record = t as Record<string, unknown>;
        const id = record.id as string | number;
        const title = record[titleColumn] as string | null;
        targetMap.set(id, title ?? String(id));
      }

      const items: LinkedItem[] = rows.map((r: Record<string, unknown>) => {
        const row = r;
        const targetId = row[spec.targetColumn] as string | number;
        return {
          linkId: row.id as string,
          linkType: row.link_type as string,
          note: (row.note as string | null) ?? null,
          createdAt: row.created_at as string,
          tableName: spec.table,
          targetType: spec.targetType,
          targetId,
          targetLabel: ENTITY_LABEL[spec.targetType],
          targetTitle: targetMap.get(targetId) ?? String(targetId),
        };
      });

      groups.push({
        targetType: spec.targetType,
        label: ENTITY_LABEL[spec.targetType],
        items,
      });
    }

    return NextResponse.json({ groups });
  } catch (err) {
    console.error("[entity-links GET] unhandled error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const user = await getApiRouteUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error_code: "AUTH_EXPIRED", error_message: "Unauthorized" },
        { status: 401 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const {
      sourceType,
      sourceId,
      targetType,
      targetId,
      projectId: numericProjectId,
      linkType,
      note,
    } = parsed.data;

    const spec = getLinkSpec(sourceType, targetType);
    if (!spec) {
      return NextResponse.json(
        {
          error: `No direct link table exists between '${sourceType}' and '${targetType}'. Check LINKABLE_TARGETS in table-map.ts.`,
        },
        { status: 422 },
      );
    }

    const supabase = await createClient();
    const dynamicSupabase = supabase as unknown as DynamicTableClient;

    // Determine which ID goes to which column
    // spec.sourceColumn always maps to the entity provided as sourceType
    const insertPayload: Record<string, unknown> = {
      project_id: numericProjectId,
      link_type: linkType,
      note: note ?? null,
    };

    // The spec.sourceColumn corresponds to sourceType, spec.targetColumn to targetType
    // But we need to handle bidirectional: getLinkSpec may flip source/target
    // Use getLinkSpec result which guarantees spec.targetColumn is the target side
    if (spec.sourceColumn === getColumnForType(sourceType)) {
      insertPayload[spec.sourceColumn] = sourceId;
      insertPayload[spec.targetColumn] = targetId;
    } else {
      // getLinkSpec returned a reversed spec
      insertPayload[spec.targetColumn] = sourceId;
      insertPayload[spec.sourceColumn] = targetId;
    }

    const { data, error } = await dynamicSupabase
      .from(spec.table)
      .insert(insertPayload)
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "This link already exists with the same link type." },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { error: `Failed to create link: ${error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ id: (data as { id: string }).id }, { status: 201 });
  } catch (err) {
    console.error("[entity-links POST] unhandled error:", err);
    return apiErrorResponse(err);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getColumnForType(entityType: EntityType): string {
  const map: Record<EntityType, string> = {
    rfi: "rfi_id",
    submittal: "submittal_id",
    change_event: "change_event_id",
    drawing: "drawing_id",
    document: "project_document_id",
    photo: "project_photo_id",
    punch_item: "punch_item_id",
    observation: "observation_id",
    daily_log: "daily_log_id",
  };
  return map[entityType];
}

/** Best title-like column for each entity type */
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
