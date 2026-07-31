import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";


interface OutboundAuditRow {
  run_id: string;
  triggered_by_user_id: string | null;
  project_id: number;
  contract_id: string | null;
  entity_name: string;
  source_table: string;
  source_record_id: string;
  source_reference: string | null;
  acumatica_entity: string;
  acumatica_reference: string | null;
  acumatica_doc_type: string | null;
  operation: "create" | "update" | "skip" | "error";
  success: boolean;
  error_message: string | null;
  request_payload: Record<string, unknown> | null;
  response_payload: Record<string, unknown> | null;
  created_at: string;
}

interface RunSummary {
  runId: string;
  startedAt: string;
  endedAt: string;
  triggeredByUserId: string | null;
  projectIds: number[];
  entities: string[];
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  total: number;
}

interface DailySummary {
  date: string;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  total: number;
}

interface LegacyLinkedRow {
  entity: string;
  sourceTable: string;
  sourceId: string;
  sourceReference: string | null;
  projectId: number | null;
  contractId: string | null;
  acumaticaReference: string;
  acumaticaDocType: string | null;
  linkedAt: string | null;
}

interface LegacySummary {
  totalLinked: number;
  byEntity: Array<{ entity: string; count: number }>;
}

async function requireAdminAuth() {
  const supabase = await createClient();
  const user = await getApiRouteUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return {
      error: NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      ),
    };
  }

  return { supabase };
}

function buildDailySummary(rows: OutboundAuditRow[]): DailySummary[] {
  const byDate = new Map<string, DailySummary>();

  for (const row of rows) {
    const date = row.created_at.slice(0, 10);
    const current = byDate.get(date) ?? {
      date,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      total: 0,
    };

    current.total += 1;
    if (row.operation === "create") current.created += 1;
    else if (row.operation === "update") current.updated += 1;
    else if (row.operation === "skip") current.skipped += 1;
    else current.errors += 1;

    byDate.set(date, current);
  }

  return Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));
}

function buildRunSummaries(rows: OutboundAuditRow[]): RunSummary[] {
  const byRun = new Map<string, RunSummary>();

  for (const row of rows) {
    const existing = byRun.get(row.run_id);
    if (!existing) {
      byRun.set(row.run_id, {
        runId: row.run_id,
        startedAt: row.created_at,
        endedAt: row.created_at,
        triggeredByUserId: row.triggered_by_user_id,
        projectIds: [row.project_id],
        entities: [row.entity_name],
        created: row.operation === "create" ? 1 : 0,
        updated: row.operation === "update" ? 1 : 0,
        skipped: row.operation === "skip" ? 1 : 0,
        errors: row.operation === "error" ? 1 : 0,
        total: 1,
      });
      continue;
    }

    if (row.created_at < existing.startedAt) existing.startedAt = row.created_at;
    if (row.created_at > existing.endedAt) existing.endedAt = row.created_at;
    if (!existing.projectIds.includes(row.project_id)) {
      existing.projectIds.push(row.project_id);
    }
    if (!existing.entities.includes(row.entity_name)) {
      existing.entities.push(row.entity_name);
    }

    existing.total += 1;
    if (row.operation === "create") existing.created += 1;
    else if (row.operation === "update") existing.updated += 1;
    else if (row.operation === "skip") existing.skipped += 1;
    else existing.errors += 1;
  }

  return Array.from(byRun.values()).sort((a, b) =>
    b.endedAt.localeCompare(a.endedAt),
  );
}

async function loadLegacyLinkedRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  days: number,
): Promise<{ rows: LegacyLinkedRow[]; summary: LegacySummary }> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [
    ownerInvoicesRes,
    paymentTransactionsRes,
    subcontractsRes,
    purchaseOrdersRes,
    primeCoRes,
    contractCoRes,
  ] = await Promise.all([
    (supabase as any)
      .from("owner_invoices")
      .select(
        "id, invoice_number, prime_contract_id, acumatica_ref_nbr, acumatica_doc_type, updated_at",
      )
      .not("acumatica_ref_nbr", "is", null)
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(1000),
    (supabase as any)
      .from("prime_contract_payments")
      .select(
        "id, payment_number, project_id, contract_id, acumatica_ref_nbr, acumatica_doc_type, updated_at",
      )
      .not("acumatica_ref_nbr", "is", null)
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(1000),
    (supabase as any)
      .from("subcontracts")
      .select("id, contract_number, project_id, acumatica_external_key, updated_at")
      .not("acumatica_external_key", "is", null)
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(1000),
    (supabase as any)
      .from("purchase_orders")
      .select("id, contract_number, project_id, acumatica_external_key, updated_at")
      .not("acumatica_external_key", "is", null)
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(1000),
    (supabase as any)
      .from("prime_contract_change_orders")
      .select("id, pcco_number, project_id, contract_id, acumatica_external_key, created_at")
      .not("acumatica_external_key", "is", null)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000),
    (supabase as any)
      .from("contract_change_orders")
      .select("id, change_order_number, contract_id, acumatica_external_key, updated_at")
      .not("acumatica_external_key", "is", null)
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(1000),
  ]);

  const errors = [
    ownerInvoicesRes.error,
    paymentTransactionsRes.error,
    subcontractsRes.error,
    purchaseOrdersRes.error,
    primeCoRes.error,
    contractCoRes.error,
  ].filter(Boolean);
  if (errors.length) {
    throw new Error(errors[0]?.message ?? "Failed to load legacy linked rows.");
  }

  const rows: LegacyLinkedRow[] = [];

  for (const row of ownerInvoicesRes.data ?? []) {
    rows.push({
      entity: "invoices",
      sourceTable: "owner_invoices",
      sourceId: String(row.id),
      sourceReference: row.invoice_number ?? null,
      projectId: null,
      contractId: row.prime_contract_id ?? null,
      acumaticaReference: row.acumatica_ref_nbr,
      acumaticaDocType: row.acumatica_doc_type ?? null,
      linkedAt: row.updated_at ?? null,
    });
  }

  for (const row of paymentTransactionsRes.data ?? []) {
    rows.push({
      entity: "paymentTransactions",
      sourceTable: "prime_contract_payments",
      sourceId: String(row.id),
      sourceReference: row.payment_number ?? null,
      projectId: row.project_id ?? null,
      contractId: row.contract_id ?? null,
      acumaticaReference: row.acumatica_ref_nbr,
      acumaticaDocType: row.acumatica_doc_type ?? null,
      linkedAt: row.updated_at ?? null,
    });
  }

  for (const row of subcontractsRes.data ?? []) {
    rows.push({
      entity: "commitments",
      sourceTable: "subcontracts",
      sourceId: String(row.id),
      sourceReference: row.contract_number ?? null,
      projectId: row.project_id ?? null,
      contractId: null,
      acumaticaReference: row.acumatica_external_key,
      acumaticaDocType: "Subcontract",
      linkedAt: row.updated_at ?? null,
    });
  }

  for (const row of purchaseOrdersRes.data ?? []) {
    rows.push({
      entity: "commitments",
      sourceTable: "purchase_orders",
      sourceId: String(row.id),
      sourceReference: row.contract_number ?? null,
      projectId: row.project_id ?? null,
      contractId: null,
      acumaticaReference: row.acumatica_external_key,
      acumaticaDocType: "RegularOrder",
      linkedAt: row.updated_at ?? null,
    });
  }

  for (const row of primeCoRes.data ?? []) {
    rows.push({
      entity: "changeOrders",
      sourceTable: "prime_contract_change_orders",
      sourceId: String(row.id),
      sourceReference: row.pcco_number ?? null,
      projectId: row.project_id ?? null,
      contractId: row.contract_id ?? null,
      acumaticaReference: row.acumatica_external_key,
      acumaticaDocType: "ChangeOrder",
      linkedAt: row.created_at ?? null,
    });
  }

  for (const row of contractCoRes.data ?? []) {
    rows.push({
      entity: "changeOrders",
      sourceTable: "contract_change_orders",
      sourceId: String(row.id),
      sourceReference: row.change_order_number ?? null,
      projectId: null,
      contractId: row.contract_id ?? null,
      acumaticaReference: row.acumatica_external_key,
      acumaticaDocType: "ChangeOrder",
      linkedAt: row.updated_at ?? null,
    });
  }

  rows.sort((a, b) => (b.linkedAt ?? "").localeCompare(a.linkedAt ?? ""));

  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.entity, (counts.get(row.entity) ?? 0) + 1);
  }

  const summary: LegacySummary = {
    totalLinked: rows.length,
    byEntity: Array.from(counts.entries()).map(([entity, count]) => ({
      entity,
      count,
    })),
  };

  return { rows: rows.slice(0, 1000), summary };
}

export const GET = withApiGuardrails("/api/admin/acumatica-outbound-logs#GET", async ({ request }) => {
  const auth = await requireAdminAuth();
  if ("error" in auth) return auth.error!;
  const { supabase } = auth;

  const url = new URL(request.url);
  const daysRaw = Number(url.searchParams.get("days") ?? "14");
  const rowLimitRaw = Number(url.searchParams.get("rowLimit") ?? "5000");
  const selectedRunId = url.searchParams.get("runId");

  const days = Number.isFinite(daysRaw) ? Math.min(Math.max(daysRaw, 1), 90) : 14;
  const rowLimit = Number.isFinite(rowLimitRaw)
    ? Math.min(Math.max(rowLimitRaw, 100), 10000)
    : 5000;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await (supabase as any)
    .from("acumatica_outbound_audit_logs")
    .select("*")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(rowLimit);

  if (error) {
    throw new GuardrailError({ code: "INTERNAL_ERROR", where: "/api/admin/acumatica-outbound-logs#GET", message: error.message });
  }

  const rows = (data ?? []) as OutboundAuditRow[];
  const runs = buildRunSummaries(rows);
  const daily = buildDailySummary(rows);

  let legacy: { rows: LegacyLinkedRow[]; summary: LegacySummary; error?: string } = {
    rows: [],
    summary: { totalLinked: 0, byEntity: [] },
  };
  try {
    const loaded = await loadLegacyLinkedRows(supabase, days);
    legacy = { ...loaded };
  } catch (legacyError) {
    legacy.error =
      legacyError instanceof Error
        ? legacyError.message
        : "Failed to load legacy linked rows.";
  }

  const effectiveRunId = selectedRunId ?? runs[0]?.runId ?? null;
  const runRows = effectiveRunId ? rows.filter((r) => r.run_id === effectiveRunId) : [];

  return NextResponse.json({
    rows,
    runs,
    daily,
    selectedRunId: effectiveRunId,
    runRows,
    legacyRows: legacy.rows,
    legacySummary: legacy.summary,
    legacyError: legacy.error ?? null,
  });
});
