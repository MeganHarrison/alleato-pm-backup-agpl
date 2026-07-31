import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { getPublicTables } from "@/lib/supabase/dev-rpc";
import { listRuntimeTableRowsWhereEqual } from "@/lib/supabase/runtime-table";
import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import type { SupabaseClient } from "@supabase/supabase-js";

interface RuntimeHeadQueryClient {
  from: (tableName: string) => {
    select: (
      selectedColumns: string,
      options?: { count?: "exact"; head?: boolean },
    ) => PromiseLike<{ error: { message: string } | null }>;
  };
}

interface RuntimeSingleRowClient {
  from: (tableName: string) => {
    select: (selectedColumns: string) => {
      limit: (count: number) => {
        maybeSingle: () => PromiseLike<{
          data: Record<string, unknown> | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
}

function runtimeHeadQueryClient(client: SupabaseClient): RuntimeHeadQueryClient {
  return {
    from(tableName) {
      return client.from(tableName) as ReturnType<RuntimeHeadQueryClient["from"]>;
    },
  };
}

function runtimeSingleRowClient(client: SupabaseClient): RuntimeSingleRowClient {
  return {
    from(tableName) {
      return client.from(tableName) as ReturnType<RuntimeSingleRowClient["from"]>;
    },
  };
}

/**
 * DEV ONLY: Get Supabase table schemas for table page generator.
 * Only accessible in development/local environments.
 */

export const GET = withApiGuardrails(
  "dev/schema#GET",
  async () => {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.VERCEL_ENV === "production"
  ) {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 403 },
    );
  }

  const supabase = await createClient();
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "dev/schema#GET", message: "Authentication required." });
  }

  try {
    let rpcFailure: string | null = null;

    // Query information_schema for all public tables via dev RPC helper.
    try {
      const data = await getPublicTables(supabase);
      if (data.length > 0) {
        const tables = data.map((r) => r.table_name).sort();
        return NextResponse.json({
          tables,
          count: tables.length,
          note: `Found ${tables.length} accessible tables.`,
        });
      }
    } catch (error) {
      rpcFailure =
        error instanceof Error
          ? error.message
          : "Unknown dev RPC table discovery failure.";
    }

    // Fallback: query the Postgres catalog through the runtime table helper
    // because pg_tables is outside the generated public schema types.
    const { data: pgData, error: pgError } = await listRuntimeTableRowsWhereEqual(
      supabase,
      "pg_tables",
      { column: "schemaname", value: "public" },
      "tablename",
    );

    if (!pgError && pgData && pgData.length > 0) {
      const tables = (pgData as Array<{ tablename: string }>)
        .map((r) => r.tablename)
        .filter((t) => !t.startsWith("_"))
        .sort();
      return NextResponse.json({
        tables,
        count: tables.length,
        note: rpcFailure
          ? `Found ${tables.length} accessible tables after dev RPC failed: ${rpcFailure}`
          : `Found ${tables.length} accessible tables.`,
      });
    }

    // Final fallback: probe known table names
    const knownTables = await discoverTablesByProbing(supabase);
    return NextResponse.json({
      tables: knownTables,
      count: knownTables.length,
      note:
        knownTables.length === 0
          ? "No tables found. Check Supabase connection and RLS policies."
          : rpcFailure
            ? `Found ${knownTables.length} accessible tables via probing after dev RPC failed: ${rpcFailure}`
            : `Found ${knownTables.length} accessible tables (via probing).`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
  },
);

/**
 * Fallback: probe a list of common table names to see which exist.
 */
async function discoverTablesByProbing(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string[]> {
  const candidates = [
    "companies",
    "contacts",
    "risks",
    "opportunities",
    "projects",
    "tasks",
    "meetings",
    "documents",
    "issues",
    "rfis",
    "submittals",
    "daily_logs",
    "daily_reports",
    "punch_list",
    "drawings",
    "photos",
    "emails",
    "notes",
    "insights",
    "decisions",
    "meeting_segments",
    "employees",
    "clients",
    "teams",
    "budget_line_items",
    "prime_contract_change_orders",
    "contract_change_orders",
    "contracts",
    "invoices",
    "purchase_orders",
    "commitments",
    "meeting_transcripts",
    "meeting_notes",
    "meeting_participants",
    "ai_insights",
    "notifications",
    "activities",
    "audit_logs",
    "settings",
    "roles",
    "permissions",
    "equipment",
    "vendors",
    "inspections",
    "permits",
    "specifications",
    "schedules",
    "milestones",
    "profiles",
    "project_members",
    "document_metadata",
    "comments",
    "tags",
    "cost_codes",
    "work_orders",
    "time_entries",
    "expenses",
    "payments",
    "prospects",
    "change_events",
    "prime_contracts",
    "subcontracts",
    "direct_costs",
    "schedule_tasks",
    "drawing_areas",
    "observations",
    "correspondence",
    "bid_packages",
  ];

  // Probing arbitrary table names requires bypassing the generated table union.
  // Safe: this is a dev-only diagnostic that ignores result data.
	  const untyped = runtimeHeadQueryClient(supabase);
  const results = await Promise.allSettled(
    candidates.map(async (tableName) => {
      const { error } = await untyped
        .from(tableName)
        .select("*", { count: "exact", head: true });
      return { tableName, exists: !error };
    }),
  );

  const existing: string[] = [];
  for (const result of results) {
    if (result.status === "fulfilled" && result.value.exists) {
      existing.push(result.value.tableName);
    }
  }
  return existing.sort();
}

/**
 * Get column information for a specific table.
 */
export const POST = withApiGuardrails(
  "dev/schema#POST",
  async ({ request }) => {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.VERCEL_ENV === "production"
  ) {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 403 },
    );
  }

  const supabase = await createClient();
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "dev/schema#POST", message: "Authentication required." });
  }

  try {
    const { tableName } = await request.json();

    if (!tableName) {
      return NextResponse.json(
        { error: "Table name required" },
        { status: 400 },
      );
    }

    // Fetch a sample row to infer column types. tableName is dynamic, so we
    // bypass the generated table union here. Safe: dev-only, return shape is
    // narrowed to Record<string, unknown> below.
	    const untyped = runtimeSingleRowClient(supabase);
    const { data: sampleRow, error: sampleError } = await untyped
      .from(tableName)
      .select("*")
      .limit(1)
      .maybeSingle();

    if (sampleError) {
      return NextResponse.json(
        {
          error: "Could not fetch table data",
          details: sampleError.message,
        },
        { status: 500 },
      );
    }

    // If table is empty, return placeholder columns
    if (!sampleRow) {
      const commonColumns = [
        { name: "id", type: "text", isSystemField: true },
        { name: "created_at", type: "date", isSystemField: true },
        { name: "updated_at", type: "date", isSystemField: true },
        { name: "name", type: "text", isSystemField: false },
        { name: "title", type: "text", isSystemField: false },
        { name: "description", type: "text", isSystemField: false },
        { name: "status", type: "badge", isSystemField: false },
      ];

      return NextResponse.json({
        columns: commonColumns,
        note: "Table is empty. Showing common columns. Add data for accurate detection.",
      });
    }

    // Infer column types from the first returned row.
    const columns = Object.keys(sampleRow).map((key) => {
      const value = (sampleRow as Record<string, unknown>)[key];
      let inferredType: "text" | "date" | "badge" | "number" | "email" =
        "text";

      if (
        key.includes("_at") ||
        key.includes("date") ||
        key.includes("_date")
      ) {
        inferredType = "date";
      } else if (key.includes("email")) {
        inferredType = "email";
      } else if (
        key === "status" ||
        key === "category" ||
        key === "type" ||
        key === "priority" ||
        key === "impact" ||
        key === "likelihood" ||
        key === "role" ||
        key === "stage" ||
        key === "pipeline_stage"
      ) {
        inferredType = "badge";
      } else if (typeof value === "number") {
        inferredType = "number";
      } else if (typeof value === "boolean") {
        inferredType = "badge";
      }

      return {
        name: key,
        type: inferredType,
        isSystemField:
          key === "id" || key === "created_at" || key === "updated_at",
      };
    });

    return NextResponse.json({ columns });
  } catch (error) {
    return apiErrorResponse(error);
  }
  },
);
