import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";

const ALLOWED_FIELDS = new Set(["category", "primary_keys", "table_comment"]);

export const PATCH = withApiGuardrails<{ schemaName: string; tableName: string }>(
  "database-tables-catalog/[schemaName]/[tableName]#PATCH",
  async ({ request, params }) => {
  const supabase = await createClient();
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "database-tables-catalog/[schemaName]/[tableName]#PATCH", message: "Authentication required." });
  }

  const { schemaName, tableName } = await params;
  const payload = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (ALLOWED_FIELDS.has(key)) {
      updates[key] = value;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No editable fields provided" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("database_tables_catalog")
    .update(updates)
    .eq("schema_name", decodeURIComponent(schemaName))
    .eq("table_name", decodeURIComponent(tableName))
    .select("*")
    .single();

  if (error) {
    return apiErrorResponse(error);
  }

  return NextResponse.json({ success: true, data });
  },
);
