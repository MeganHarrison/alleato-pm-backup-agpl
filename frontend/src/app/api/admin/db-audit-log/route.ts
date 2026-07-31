import { withApiGuardrails } from "@/lib/guardrails/api";
import { requireAdmin } from "@/app/api/admin/_shared";
import { serviceDb } from "@/lib/supabase/service-db";

export const dynamic = "force-dynamic";

const WHERE = "api.admin.db-audit-log#GET";
const MAX_PER_PAGE = 200;

export const GET = withApiGuardrails(WHERE, async ({ request }) => {
  await requireAdmin(WHERE);

    const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const perPage = Math.min(MAX_PER_PAGE, parseInt(url.searchParams.get("perPage") ?? "50", 10));
  const search = url.searchParams.get("search")?.trim() ?? "";
  const operation = url.searchParams.get("operation") ?? "";
  const tableName = url.searchParams.get("table_name") ?? "";

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = serviceDb.from("db_audit_log")
    .select(
      "id,table_name,record_id,operation,changed_by,changed_at,changed_columns,old_data,new_data",
      { count: "exact" },
    )
    .order("changed_at", { ascending: false })
    .range(from, to);

  if (search) {
    query = query.or(`table_name.ilike.%${search}%,record_id.ilike.%${search}%`);
  }
  if (operation) {
    query = query.eq("operation", operation);
  }
  if (tableName) {
    query = query.eq("table_name", tableName);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  const rows = data ?? [];

  // Resolve changed_by UUIDs → display names in one batch query
  const userIds = [...new Set(rows.map((r) => r.changed_by).filter(Boolean))] as string[];
  const nameMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await serviceDb.from("user_profiles")
      .select("id,full_name,email")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      nameMap[p.id] = p.full_name ?? p.email ?? p.id;
    }
  }

  const items = rows.map((row) => ({
    id: row.id,
    table_name: row.table_name,
    record_id: row.record_id,
    operation: row.operation,
    changed_by: row.changed_by,
    changed_by_name: row.changed_by ? (nameMap[row.changed_by] ?? null) : null,
    changed_at: row.changed_at,
    changed_columns: row.changed_columns,
    old_data: row.old_data,
    new_data: row.new_data,
  }));

  return Response.json({ items, total: count ?? 0, page, perPage });
});
