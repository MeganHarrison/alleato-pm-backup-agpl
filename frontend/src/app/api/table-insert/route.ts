import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { insertRuntimeTableRow } from "@/lib/supabase/runtime-table";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import { NextResponse } from "next/server";

type TableName = keyof Database["public"]["Tables"];

/**
 * Strict allowlist of tables accessible via the generic insert endpoint.
 * Any table not in this set will be rejected with 403.
 * OWASP A01:2021 - Broken Access Control
 */
const TABLE_ALLOWLIST = [
  "projects",
  "budget_lines",
  "prime_contracts",
  "change_events",
  "direct_costs",
  "rfis",
  "submittals",
  "daily_logs",
  "daily_log_manpower",
  "daily_log_equipment",
  "daily_log_notes",
  "daily_recaps",
  "notes",
  "meeting_segments",
  "specifications",
  "drawings",
  "photos",
  "document_metadata",
  "project_transmittals",
  "project_emails",
  "companies",
  "people",
  "user_profiles",
  "schedule_tasks",
  "prime_contract_change_orders",
  "prime_contract_payment_applications",
  "payment_application_line_items",
  "direct_cost_line_items",
  "change_event_line_items",
  "project_budget_codes",
  "procore_features",
  "procore_pages",
] as const satisfies readonly TableName[];

function isAllowedTable(value: string): value is (typeof TABLE_ALLOWLIST)[number] {
  return (TABLE_ALLOWLIST as readonly string[]).includes(value);
}

export const POST = withApiGuardrails(
  "table-insert#POST",
  async ({ request }) => {
  
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "table-insert#POST", message: "Authentication required." });
    }

    const body = await request.json();
    const { table, data } = body as { table?: string; data?: Record<string, unknown> };

    if (!table || !data) {
      return NextResponse.json(
        { error: "Missing required fields: table or data" },
        { status: 400 },
      );
    }

    if (!isAllowedTable(table)) {
      return NextResponse.json(
        { error: `Table "${table}" is not accessible via this endpoint` },
        { status: 403 },
      );
    }

    const { data: inserted, error } = await insertRuntimeTableRow(supabase, table, data);

    if (error) {
      return NextResponse.json(
        { error: "Failed to insert record", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: inserted });
    },
);
