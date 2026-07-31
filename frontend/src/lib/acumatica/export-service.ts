/**
 * Acumatica export service — write-back (outbound) operations.
 *
 * Pushes data from Alleato PM into Acumatica ERP.
 * Each function is the inverse of the corresponding sync: it reads from
 * Supabase and creates/updates records in Acumatica via the REST API.
 */

import { createClient } from "@/lib/supabase/server";
import { createAcumaticaClient } from "./client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database.types";

type DbClient = SupabaseClient<Database>;
type OutboundAuditLogInsert =
  Database["public"]["Tables"]["acumatica_outbound_audit_logs"]["Insert"];

// ---------------------------------------------------------------------------
// App → Acumatica Export (Write Sync)
// ---------------------------------------------------------------------------

export interface ExportSyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface AcumaticaOutboundAuditContext {
  runId?: string;
  userId?: string | null;
}

type OutboundAuditOperation = "create" | "update" | "skip" | "error";

interface OutboundAuditLogRow {
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
  operation: OutboundAuditOperation;
  success: boolean;
  error_message: string | null;
  request_payload: Json | null;
  response_payload: Json | null;
}

async function flushOutboundAuditLogs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: OutboundAuditLogRow[],
): Promise<void> {
  if (!rows.length) return;

  const CHUNK_SIZE = 200;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk: OutboundAuditLogInsert[] = rows.slice(i, i + CHUNK_SIZE) as unknown as OutboundAuditLogInsert[];
    const { error } = await supabase
      .from("acumatica_outbound_audit_logs")
      .insert(chunk);
    if (error) {
      console.error("[acumatica-outbound-audit] insert failed:", error.message);
      return;
    }
  }
}

type AcumaticaPayloadValue = string | number | boolean | null | undefined;

function acuField(value: AcumaticaPayloadValue) {
  return { value };
}

function toIsoDate(value: string | null | undefined): string {
  if (!value) return new Date().toISOString().split("T")[0];
  return value.split("T")[0];
}

type StatusEntity = "commitment" | "primeCo" | "invoice";

// "primeCo" covers both prime contract change orders and commitment (subcontract) change orders —
// Acumatica uses the same ChangeOrder entity with identical status semantics for both.
const STATUS_MAP: Record<StatusEntity, Array<[string[], string]>> = {
  commitment: [
    [["executed", "approved", "closed"], "Open"],
    [["void", "cancelled", "canceled"], "Canceled"],
  ],
  primeCo: [
    [["approved", "executed", "closed"], "Open"],
    [["rejected", "void"], "Canceled"],
  ],
  invoice: [
    [["approved", "paid"], "Released"],
    [["submitted"], "Balanced"],
  ],
};

function mapOutboundStatus(status: string | null | undefined, entity: StatusEntity): string {
  const normalized = (status ?? "").toLowerCase();
  for (const [triggers, output] of STATUS_MAP[entity]) {
    if (triggers.includes(normalized)) return output;
  }
  return "On Hold";
}

function escapeODataString(value: string): string {
  return value.replace(/'/g, "''");
}

function toJsonValue(value: unknown): Json {
  return value as Json;
}

function isProjectPermissionOrContextError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Project '") &&
    message.includes("cannot be found in the system")
  );
}

function isAcumaticaOperationFailedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("PXInvalidOperationException") ||
    message.includes("Operation failed") ||
    message.includes("NullReferenceException")
  );
}

async function upsertInvoiceWithProjectFallback(
  acuClient: ReturnType<typeof createAcumaticaClient>,
  payload: Record<string, unknown>,
  options?: {
    allowProjectFallback?: boolean;
    allowHeaderOnlyFallback?: boolean;
  },
): Promise<Record<string, unknown>> {
  const allowProjectFallback = options?.allowProjectFallback ?? true;
  const allowHeaderOnlyFallback = options?.allowHeaderOnlyFallback ?? true;

  try {
    return await acuClient.upsertInvoice(payload);
  } catch (error) {
    if (
      allowProjectFallback &&
      isProjectPermissionOrContextError(error) &&
      "Project" in payload
    ) {
      // Some tenants reject header-level Project in AR Invoice create/update context
      // even when the project exists. Retry once without Project so sync can proceed.
      const fallbackPayload = { ...payload };
      delete fallbackPayload.Project;
      return acuClient.upsertInvoice(fallbackPayload);
    }

    if (
      allowHeaderOnlyFallback &&
      isAcumaticaOperationFailedError(error) &&
      "Details" in payload
    ) {
      // Acumatica may throw an internal Operation failed/NullReferenceException
      // for some sparse line payloads. Retry with a header-only invoice payload.
      const fallbackPayload = { ...payload };
      delete fallbackPayload.Details;
      return acuClient.upsertInvoice(fallbackPayload);
    }

    throw error;
  }
}

/**
 * Export project commitments (subcontracts + purchase orders) from the app to Acumatica.
 */
export async function exportCommitmentsToAcumatica(
  projectId: number,
  auditContext?: AcumaticaOutboundAuditContext,
): Promise<ExportSyncResult> {
  const result: ExportSyncResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const supabase = await createClient();
  const acuClient = createAcumaticaClient();
  await acuClient.login();
  const runId = auditContext?.runId ?? crypto.randomUUID();
  const auditLogs: OutboundAuditLogRow[] = [];

  const { data: project } = await supabase
    .from("projects")
    .select("acumatica_project_id")
    .eq("id", projectId)
    .single();

  if (!project?.acumatica_project_id) {
    result.errors.push("Project has no acumatica_project_id mapping.");
    return result;
  }

  const acuProjectId = project.acumatica_project_id;

  const [{ data: subcontracts, error: subError }, { data: purchaseOrders, error: poError }] =
    await Promise.all([
      supabase
        .from("subcontracts")
        .select(
          "id, contract_number, acumatica_external_key, status, description, title, contract_date, contract_company_id, executed",
        )
        .eq("project_id", projectId)
        .is("deleted_at", null),
      supabase
        .from("purchase_orders")
        .select(
          "id, contract_number, acumatica_external_key, status, description, title, contract_date, delivery_date, contract_company_id, executed",
        )
        .eq("project_id", projectId)
        .is("deleted_at", null),
    ]);

  if (subError) result.errors.push(`Failed loading subcontracts: ${subError.message}`);
  if (poError) result.errors.push(`Failed loading purchase orders: ${poError.message}`);

  const vendorIds = [
    ...(subcontracts ?? []).map((s) => s.contract_company_id).filter(Boolean),
    ...(purchaseOrders ?? []).map((p) => p.contract_company_id).filter(Boolean),
  ] as string[];

  let vendorAcuById = new Map<string, string>();
  if (vendorIds.length > 0) {
    const { data: vendors } = await supabase
      .from("companies")
      .select("id, acumatica_vendor_id")
      .eq("is_vendor", true)
      .in("id", Array.from(new Set(vendorIds)));
    vendorAcuById = new Map(
      (vendors ?? [])
        .filter((v) => !!v.acumatica_vendor_id)
        .map((v) => [v.id, v.acumatica_vendor_id as string]),
    );
  }

  const subcontractIds = (subcontracts ?? []).map((s) => s.id);
  const poIds = (purchaseOrders ?? []).map((p) => p.id);

  const [{ data: subcontractLines }, { data: poLines }] = await Promise.all([
    subcontractIds.length
      ? supabase
          .from("subcontract_sov_items")
          .select("subcontract_id, line_number, description, amount, budget_code")
          .in("subcontract_id", subcontractIds)
      : Promise.resolve({ data: [], error: null }),
    poIds.length
      ? supabase
          .from("purchase_order_sov_items")
          .select(
            "purchase_order_id, line_number, description, amount, budget_code, quantity, unit_cost, uom",
          )
          .in("purchase_order_id", poIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const subcontractLinesById = new Map<string, Array<Record<string, unknown>>>();
  for (const line of subcontractLines ?? []) {
    const current = subcontractLinesById.get(line.subcontract_id) ?? [];
    current.push({
      LineNbr: acuField(line.line_number ?? undefined),
      Description: acuField(line.description ?? undefined),
      Amount: acuField(line.amount ?? 0),
      CostCode: acuField(line.budget_code ?? undefined),
    });
    subcontractLinesById.set(line.subcontract_id, current);
  }

  const poLinesById = new Map<string, Array<Record<string, unknown>>>();
  for (const line of poLines ?? []) {
    const current = poLinesById.get(line.purchase_order_id) ?? [];
    current.push({
      LineNbr: acuField(line.line_number),
      Description: acuField(line.description ?? undefined),
      Amount: acuField(line.amount ?? 0),
      CostCode: acuField(line.budget_code ?? undefined),
      Qty: acuField(line.quantity ?? undefined),
      UnitCost: acuField(line.unit_cost ?? undefined),
      UOM: acuField(line.uom ?? undefined),
    });
    poLinesById.set(line.purchase_order_id, current);
  }

  for (const sc of subcontracts ?? []) {
    const vendorAcuId = sc.contract_company_id
      ? vendorAcuById.get(sc.contract_company_id) ?? null
      : null;
    const externalKey = sc.acumatica_external_key ?? sc.contract_number;
    const details = subcontractLinesById.get(sc.id) ?? [];

    const payload: Record<string, unknown> = {
      SubcontractNbr: acuField(externalKey),
      VendorID: acuField(vendorAcuId),
      Project: acuField(acuProjectId),
      Description: acuField(sc.description ?? sc.title ?? sc.contract_number),
      Date: acuField(toIsoDate(sc.contract_date)),
      Status: acuField(
        mapOutboundStatus(sc.executed ? "executed" : sc.status, "commitment"),
      ),
      Details: details,
    };

    try {
      const existed = !!sc.acumatica_external_key;
      const response = await acuClient.upsertSubcontract(payload);
      const returnedNbr =
        typeof response.SubcontractNbr === "string" ? response.SubcontractNbr : externalKey;

      await supabase
        .from("subcontracts")
        .update({ acumatica_external_key: returnedNbr })
        .eq("id", sc.id);

      if (existed) result.updated++;
      else result.created++;
      auditLogs.push({
        run_id: runId,
        triggered_by_user_id: auditContext?.userId ?? null,
        project_id: projectId,
        contract_id: null,
        entity_name: "commitments",
        source_table: "subcontracts",
        source_record_id: sc.id,
        source_reference: sc.contract_number ?? null,
        acumatica_entity: "Subcontract",
        acumatica_reference: returnedNbr,
        acumatica_doc_type: null,
        operation: existed ? "update" : "create",
        success: true,
        error_message: null,
        request_payload: toJsonValue(payload),
        response_payload: toJsonValue(response),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Subcontract ${sc.contract_number}: ${message}`);
      auditLogs.push({
        run_id: runId,
        triggered_by_user_id: auditContext?.userId ?? null,
        project_id: projectId,
        contract_id: null,
        entity_name: "commitments",
        source_table: "subcontracts",
        source_record_id: sc.id,
        source_reference: sc.contract_number ?? null,
        acumatica_entity: "Subcontract",
        acumatica_reference: sc.acumatica_external_key ?? externalKey,
        acumatica_doc_type: null,
        operation: "error",
        success: false,
        error_message: message,
        request_payload: toJsonValue(payload),
        response_payload: null,
      });
    }
  }

  for (const po of purchaseOrders ?? []) {
    const vendorAcuId = po.contract_company_id
      ? vendorAcuById.get(po.contract_company_id) ?? null
      : null;
    const externalKey = po.acumatica_external_key ?? po.contract_number;
    const details = poLinesById.get(po.id) ?? [];

    const payload: Record<string, unknown> = {
      Type: acuField("RegularOrder"),
      OrderNbr: acuField(externalKey),
      VendorID: acuField(vendorAcuId),
      Project: acuField(acuProjectId),
      Description: acuField(po.description ?? po.title ?? po.contract_number),
      Date: acuField(toIsoDate(po.contract_date)),
      PromisedOn: acuField(toIsoDate(po.delivery_date)),
      Status: acuField(
        mapOutboundStatus(po.executed ? "executed" : po.status, "commitment"),
      ),
      Details: details,
    };

    try {
      const existed = !!po.acumatica_external_key;
      const response = await acuClient.upsertPurchaseOrder(payload);
      const returnedNbr =
        typeof response.OrderNbr === "string" ? response.OrderNbr : externalKey;

      await supabase
        .from("purchase_orders")
        .update({ acumatica_external_key: returnedNbr })
        .eq("id", po.id);

      if (existed) result.updated++;
      else result.created++;
      auditLogs.push({
        run_id: runId,
        triggered_by_user_id: auditContext?.userId ?? null,
        project_id: projectId,
        contract_id: null,
        entity_name: "commitments",
        source_table: "purchase_orders",
        source_record_id: po.id,
        source_reference: po.contract_number ?? null,
        acumatica_entity: "PurchaseOrder",
        acumatica_reference: returnedNbr,
        acumatica_doc_type: "RegularOrder",
        operation: existed ? "update" : "create",
        success: true,
        error_message: null,
        request_payload: toJsonValue(payload),
        response_payload: toJsonValue(response),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Purchase order ${po.contract_number}: ${message}`);
      auditLogs.push({
        run_id: runId,
        triggered_by_user_id: auditContext?.userId ?? null,
        project_id: projectId,
        contract_id: null,
        entity_name: "commitments",
        source_table: "purchase_orders",
        source_record_id: po.id,
        source_reference: po.contract_number ?? null,
        acumatica_entity: "PurchaseOrder",
        acumatica_reference: po.acumatica_external_key ?? externalKey,
        acumatica_doc_type: "RegularOrder",
        operation: "error",
        success: false,
        error_message: message,
        request_payload: toJsonValue(payload),
        response_payload: null,
      });
    }
  }

  await flushOutboundAuditLogs(supabase, auditLogs);
  return result;
}

/**
 * Export prime contracts to Acumatica using the Project entity.
 */
export async function exportPrimeContractsToAcumatica(
  projectId: number,
  auditContext?: AcumaticaOutboundAuditContext,
): Promise<ExportSyncResult> {
  const result: ExportSyncResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const supabase = await createClient();
  const acuClient = createAcumaticaClient();
  await acuClient.login();
  const runId = auditContext?.runId ?? crypto.randomUUID();
  const auditLogs: OutboundAuditLogRow[] = [];

  const [{ data: primeContracts, error: contractsError }, { data: project }] =
    await Promise.all([
      supabase
        .from("prime_contracts")
        .select(
          "id, contract_number, title, description, status, executed, revised_contract_value, original_contract_value, client_id, contract_company_id",
        )
        .eq("project_id", projectId),
      supabase
        .from("projects")
        .select("id, name, acumatica_project_id")
        .eq("id", projectId)
        .single(),
    ]);

  if (contractsError) {
    result.errors.push(`Failed loading prime contracts: ${contractsError.message}`);
    return result;
  }

  if (!primeContracts?.length) {
    result.skipped++;
    return result;
  }

  const companyIds = Array.from(
    new Set(
      primeContracts
        .flatMap((c) => [c.client_id, c.contract_company_id])
        .filter(Boolean) as string[],
    ),
  );
  let customerByCompanyId = new Map<string, string>();
  if (companyIds.length > 0) {
    const { data: companies } = await supabase
      .from("companies")
      .select("id, customer_id")
      .in("id", companyIds);
    customerByCompanyId = new Map(
      (companies ?? [])
        .filter((c) => !!c.customer_id)
        .map((c) => [c.id, c.customer_id as string]),
    );
  }

  for (const contract of primeContracts) {
    const customerId =
      (contract.client_id && customerByCompanyId.get(contract.client_id)) ||
      (contract.contract_company_id &&
        customerByCompanyId.get(contract.contract_company_id)) ||
      null;
    const projectCode = project?.acumatica_project_id ?? contract.contract_number;

    const payload: Record<string, unknown> = {
      ProjectID: acuField(projectCode),
      Description: acuField(contract.description ?? contract.title),
      Customer: acuField(customerId),
      Status: acuField(contract.executed ? "Active" : "In Planning"),
      Income: acuField(
        contract.revised_contract_value ?? contract.original_contract_value ?? 0,
      ),
    };

    try {
      const response = await acuClient.upsertProject(payload);
      const returnedProjectId =
        typeof response.ProjectID === "string" ? response.ProjectID : projectCode;
      if (!project?.acumatica_project_id && returnedProjectId) {
        await supabase
          .from("projects")
          .update({ acumatica_project_id: returnedProjectId })
          .eq("id", projectId);
      }

      if (project?.acumatica_project_id) result.updated++;
      else result.created++;
      auditLogs.push({
        run_id: runId,
        triggered_by_user_id: auditContext?.userId ?? null,
        project_id: projectId,
        contract_id: contract.id,
        entity_name: "primeContracts",
        source_table: "prime_contracts",
        source_record_id: contract.id,
        source_reference: contract.contract_number ?? null,
        acumatica_entity: "Project",
        acumatica_reference: returnedProjectId,
        acumatica_doc_type: null,
        operation: project?.acumatica_project_id ? "update" : "create",
        success: true,
        error_message: null,
        request_payload: toJsonValue(payload),
        response_payload: toJsonValue(response),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Prime contract ${contract.contract_number}: ${message}`);
      auditLogs.push({
        run_id: runId,
        triggered_by_user_id: auditContext?.userId ?? null,
        project_id: projectId,
        contract_id: contract.id,
        entity_name: "primeContracts",
        source_table: "prime_contracts",
        source_record_id: contract.id,
        source_reference: contract.contract_number ?? null,
        acumatica_entity: "Project",
        acumatica_reference: projectCode,
        acumatica_doc_type: null,
        operation: "error",
        success: false,
        error_message: message,
        request_payload: toJsonValue(payload),
        response_payload: null,
      });
    }
  }

  await flushOutboundAuditLogs(supabase, auditLogs);
  return result;
}

/**
 * Export commitment + prime change orders from the app to Acumatica.
 */
export async function exportChangeOrdersToAcumatica(
  projectId: number,
  auditContext?: AcumaticaOutboundAuditContext,
): Promise<ExportSyncResult> {
  const result: ExportSyncResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const supabase = await createClient();
  const acuClient = createAcumaticaClient();
  await acuClient.login();
  const runId = auditContext?.runId ?? crypto.randomUUID();
  const auditLogs: OutboundAuditLogRow[] = [];

  const { data: project } = await supabase
    .from("projects")
    .select("acumatica_project_id")
    .eq("id", projectId)
    .single();
  if (!project?.acumatica_project_id) {
    result.errors.push("Project has no acumatica_project_id mapping.");
    return result;
  }

  const acuProjectId = project.acumatica_project_id;

  const [{ data: primeCos, error: primeError }, { data: primeContracts, error: mapError }] =
    await Promise.all([
      supabase
        .from("prime_contract_change_orders")
        .select(
          "id, pcco_number, title, total_amount, status, submitted_at, acumatica_external_key",
        )
        .eq("project_id", projectId),
      supabase
        .from("prime_contracts")
        .select("id")
        .eq("project_id", projectId),
    ]);
  if (primeError) result.errors.push(`Failed loading prime change orders: ${primeError.message}`);
  if (mapError) result.errors.push(`Failed loading contract map: ${mapError.message}`);

  const contractIds = (primeContracts ?? []).map((c) => c.id);
  const { data: commitmentCos, error: commitmentError } = contractIds.length
    ? await supabase
        .from("contract_change_orders")
        .select(
          "id, change_order_number, description, amount, status, requested_date, acumatica_external_key, contract_id",
        )
        .in("contract_id", contractIds)
    : { data: [], error: null };

  if (commitmentError) {
    result.errors.push(`Failed loading commitment change orders: ${commitmentError.message}`);
  }

  for (const co of primeCos ?? []) {
    const referenceNbr = co.acumatica_external_key ?? co.pcco_number ?? `PCCO-${co.id}`;
    const payload: Record<string, unknown> = {
      ReferenceNbr: acuField(referenceNbr),
      Project: acuField(acuProjectId),
      Description: acuField(co.title),
      ChangeDate: acuField(toIsoDate(co.submitted_at)),
      RevenueBudgetChangeTotal: acuField(co.total_amount ?? 0),
      CommitmentsChangeTotal: acuField(0),
      Status: acuField(mapOutboundStatus(co.status, "primeCo")),
    };

    try {
      const existed = !!co.acumatica_external_key;
      const response = await acuClient.upsertChangeOrder(payload);
      const returnedRef =
        typeof response.ReferenceNbr === "string" ? response.ReferenceNbr : referenceNbr;
      await supabase
        .from("prime_contract_change_orders")
        .update({ acumatica_external_key: returnedRef })
        .eq("id", co.id);

      if (existed) result.updated++;
      else result.created++;
      auditLogs.push({
        run_id: runId,
        triggered_by_user_id: auditContext?.userId ?? null,
        project_id: projectId,
        contract_id: null,
        entity_name: "changeOrders",
        source_table: "prime_contract_change_orders",
        source_record_id: String(co.id),
        source_reference: co.pcco_number ?? null,
        acumatica_entity: "ChangeOrder",
        acumatica_reference: returnedRef,
        acumatica_doc_type: null,
        operation: existed ? "update" : "create",
        success: true,
        error_message: null,
        request_payload: toJsonValue(payload),
        response_payload: toJsonValue(response),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Prime CO ${referenceNbr}: ${message}`);
      auditLogs.push({
        run_id: runId,
        triggered_by_user_id: auditContext?.userId ?? null,
        project_id: projectId,
        contract_id: null,
        entity_name: "changeOrders",
        source_table: "prime_contract_change_orders",
        source_record_id: String(co.id),
        source_reference: co.pcco_number ?? null,
        acumatica_entity: "ChangeOrder",
        acumatica_reference: referenceNbr,
        acumatica_doc_type: null,
        operation: "error",
        success: false,
        error_message: message,
        request_payload: toJsonValue(payload),
        response_payload: null,
      });
    }
  }

  for (const co of commitmentCos ?? []) {
    const referenceNbr =
      co.acumatica_external_key ?? co.change_order_number ?? `CCO-${co.id}`;
    const payload: Record<string, unknown> = {
      ReferenceNbr: acuField(referenceNbr),
      Project: acuField(acuProjectId),
      Description: acuField(co.description),
      ChangeDate: acuField(toIsoDate(co.requested_date)),
      RevenueBudgetChangeTotal: acuField(0),
      CommitmentsChangeTotal: acuField(co.amount ?? 0),
      Status: acuField(mapOutboundStatus(co.status, "primeCo")),
    };

    try {
      const existed = !!co.acumatica_external_key;
      const response = await acuClient.upsertChangeOrder(payload);
      const returnedRef =
        typeof response.ReferenceNbr === "string" ? response.ReferenceNbr : referenceNbr;
      await supabase
        .from("contract_change_orders")
        .update({ acumatica_external_key: returnedRef })
        .eq("id", co.id);

      if (existed) result.updated++;
      else result.created++;
      auditLogs.push({
        run_id: runId,
        triggered_by_user_id: auditContext?.userId ?? null,
        project_id: projectId,
        contract_id: co.contract_id,
        entity_name: "changeOrders",
        source_table: "contract_change_orders",
        source_record_id: co.id,
        source_reference: co.change_order_number ?? null,
        acumatica_entity: "ChangeOrder",
        acumatica_reference: returnedRef,
        acumatica_doc_type: null,
        operation: existed ? "update" : "create",
        success: true,
        error_message: null,
        request_payload: toJsonValue(payload),
        response_payload: toJsonValue(response),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Commitment CO ${referenceNbr}: ${message}`);
      auditLogs.push({
        run_id: runId,
        triggered_by_user_id: auditContext?.userId ?? null,
        project_id: projectId,
        contract_id: co.contract_id,
        entity_name: "changeOrders",
        source_table: "contract_change_orders",
        source_record_id: co.id,
        source_reference: co.change_order_number ?? null,
        acumatica_entity: "ChangeOrder",
        acumatica_reference: referenceNbr,
        acumatica_doc_type: null,
        operation: "error",
        success: false,
        error_message: message,
        request_payload: toJsonValue(payload),
        response_payload: null,
      });
    }
  }

  await flushOutboundAuditLogs(supabase, auditLogs);
  return result;
}

/**
 * Export prime contract payment applications from the app to Acumatica AR Invoices.
 *
 * Optional `contractId` limits export to a single prime contract.
 */
export async function exportPaymentApplicationsToAcumatica(
  projectId: number,
  contractId?: string,
  auditContext?: AcumaticaOutboundAuditContext,
): Promise<ExportSyncResult> {
  const result: ExportSyncResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const supabase = await createClient();
  const acuClient = createAcumaticaClient();
  await acuClient.login();
  const runId = auditContext?.runId ?? crypto.randomUUID();
  const auditLogs: OutboundAuditLogRow[] = [];

  const { data: project } = await supabase
    .from("projects")
    .select("acumatica_project_id")
    .eq("id", projectId)
    .single();

  if (!project?.acumatica_project_id) {
    result.errors.push("Project has no acumatica_project_id mapping.");
    return result;
  }

  let contractsQuery = supabase
    .from("prime_contracts")
    .select("id, client_id, contract_company_id")
    .eq("project_id", projectId);

  if (contractId) {
    contractsQuery = contractsQuery.eq("id", contractId);
  }

  const { data: primeContracts, error: contractsError } = await contractsQuery;
  if (contractsError) {
    result.errors.push(`Failed loading prime contracts: ${contractsError.message}`);
    return result;
  }

  const contractIds = (primeContracts ?? []).map((c) => c.id);
  if (!contractIds.length) {
    result.skipped++;
    return result;
  }

  const companyIds = Array.from(
    new Set(
      (primeContracts ?? [])
        .flatMap((c) => [c.client_id, c.contract_company_id])
        .filter(Boolean) as string[],
    ),
  );

  const customerByCompanyId = new Map<string, string>();
  if (companyIds.length) {
    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select("id, customer_id")
      .in("id", companyIds);

    if (companiesError) {
      result.errors.push(`Failed loading company mappings: ${companiesError.message}`);
      return result;
    }

    for (const company of companies ?? []) {
      if (company.customer_id) {
        customerByCompanyId.set(company.id, company.customer_id);
      }
    }
  }

  const customerByContractId = new Map<string, string>();
  for (const contract of primeContracts ?? []) {
    const customerId =
      (contract.client_id && customerByCompanyId.get(contract.client_id)) ||
      (contract.contract_company_id &&
        customerByCompanyId.get(contract.contract_company_id)) ||
      null;

    if (customerId) {
      customerByContractId.set(contract.id, customerId);
    }
  }

  const { data: applications, error: applicationsError } = await supabase
    .from("prime_contract_payment_applications")
    .select(
      "id, contract_id, application_number, amount, net_amount, retention_amount, status, period_from, period_to, notes",
    )
    .in("contract_id", contractIds)
    .order("application_number", { ascending: true });

  if (applicationsError) {
    result.errors.push(`Failed loading payment applications: ${applicationsError.message}`);
    return result;
  }

  const { data: ownerInvoices, error: ownerInvoicesError } = await supabase
    .from("owner_invoices")
    .select("acumatica_ref_nbr")
    .in("prime_contract_id", contractIds)
    .not("acumatica_ref_nbr", "is", null);

  if (ownerInvoicesError) {
    result.errors.push(`Failed loading existing Acumatica invoice refs: ${ownerInvoicesError.message}`);
    return result;
  }

  const existingRefs = new Set(
    (ownerInvoices ?? [])
      .map((invoice) => invoice.acumatica_ref_nbr)
      .filter((ref): ref is string => Boolean(ref)),
  );

  const acuProjectTasks = await acuClient.getProjectTasks({
    $filter: `ProjectID eq '${escapeODataString(project.acumatica_project_id)}'`,
    $top: 50,
  });
  const defaultProjectTaskCode =
    acuProjectTasks
      .find((task) => task.Status === "Active" && typeof task.ProjectTaskID === "string")
      ?.ProjectTaskID?.trim() ||
    acuProjectTasks
      .find((task) => typeof task.ProjectTaskID === "string")
      ?.ProjectTaskID?.trim() ||
    "PROJECT";

  for (const application of applications ?? []) {
    const customerId = customerByContractId.get(application.contract_id);
    if (!customerId) {
      const message = `Payment application ${application.application_number}: no Acumatica customer mapping found for its prime contract company.`;
      result.errors.push(message);
      auditLogs.push({
        run_id: runId,
        triggered_by_user_id: auditContext?.userId ?? null,
        project_id: projectId,
        contract_id: application.contract_id,
        entity_name: "paymentApplications",
        source_table: "prime_contract_payment_applications",
        source_record_id: application.id,
        source_reference: application.application_number ?? null,
        acumatica_entity: "Invoice",
        acumatica_reference: null,
        acumatica_doc_type: "Invoice",
        operation: "error",
        success: false,
        error_message: message,
        request_payload: null,
        response_payload: null,
      });
      continue;
    }

    const status = (application.status ?? "").toLowerCase();
    if (status === "draft" || status === "rejected") {
      result.skipped++;
      auditLogs.push({
        run_id: runId,
        triggered_by_user_id: auditContext?.userId ?? null,
        project_id: projectId,
        contract_id: application.contract_id,
        entity_name: "paymentApplications",
        source_table: "prime_contract_payment_applications",
        source_record_id: application.id,
        source_reference: application.application_number ?? null,
        acumatica_entity: "Invoice",
        acumatica_reference: null,
        acumatica_doc_type: "Invoice",
        operation: "skip",
        success: true,
        error_message: `Skipped due to status '${status}'.`,
        request_payload: null,
        response_payload: null,
      });
      continue;
    }

    const referenceNbr =
      application.application_number?.trim() || `PAYAPP-${application.id}`;
    const description = `Payment Application ${referenceNbr}`;
    const grossAmount = application.amount ?? 0;
    const netAmount = application.net_amount ?? grossAmount;
    const detailDescription =
      application.notes?.trim() || description;

    const escapedCustomer = escapeODataString(customerId);
    const escapedDescription = escapeODataString(description);
    const candidateInvoices = await acuClient.getInvoices({
      $filter: `Type eq 'Invoice' and Customer eq '${escapedCustomer}' and Description eq '${escapedDescription}'`,
      $top: 200,
    });

    const existingAcumaticaInvoiceRef = candidateInvoices
      .filter((invoice) => typeof invoice.ReferenceNbr === "string")
      .sort((a, b) =>
        String(b.LastModifiedDateTime ?? "").localeCompare(
          String(a.LastModifiedDateTime ?? ""),
        ),
      )[0]?.ReferenceNbr;

    const payload: Record<string, unknown> = {
      Type: acuField("Invoice"),
      ReferenceNbr: acuField(existingAcumaticaInvoiceRef ?? referenceNbr),
      Customer: acuField(customerId),
      Project: acuField(project.acumatica_project_id),
      Date: acuField(toIsoDate(application.period_from ?? undefined)),
      DueDate: acuField(toIsoDate(application.period_to ?? application.period_from ?? undefined)),
      Description: acuField(description),
      Amount: acuField(grossAmount),
      Status: acuField(mapOutboundStatus(application.status, "invoice")),
      ...(netAmount > 0
        ? {
            Details: [
              {
                LineNbr: acuField(1),
                TransactionDescription: acuField(detailDescription),
                ExtendedPrice: acuField(netAmount),
                Project: acuField(project.acumatica_project_id),
                ProjectTaskID: acuField(defaultProjectTaskCode),
              },
            ],
          }
        : {}),
    };

    try {
      const existed = Boolean(existingAcumaticaInvoiceRef) || existingRefs.has(referenceNbr);
      const response = await upsertInvoiceWithProjectFallback(acuClient, payload, {
        allowProjectFallback: false,
      });
      const returnedRef =
        typeof response.ReferenceNbr === "string"
          ? response.ReferenceNbr
          : existingAcumaticaInvoiceRef ?? referenceNbr;
      existingRefs.add(returnedRef);

      if (existed) result.updated++;
      else result.created++;
      auditLogs.push({
        run_id: runId,
        triggered_by_user_id: auditContext?.userId ?? null,
        project_id: projectId,
        contract_id: application.contract_id,
        entity_name: "paymentApplications",
        source_table: "prime_contract_payment_applications",
        source_record_id: application.id,
        source_reference: application.application_number ?? null,
        acumatica_entity: "Invoice",
        acumatica_reference: returnedRef,
        acumatica_doc_type: "Invoice",
        operation: existed ? "update" : "create",
        success: true,
        error_message: null,
        request_payload: toJsonValue(payload),
        response_payload: toJsonValue(response),
      });
    } catch (error) {
      const baseMessage =
        error instanceof Error ? error.message : String(error);
      const message = isProjectPermissionOrContextError(error)
        ? `${baseMessage}. Project '${project.acumatica_project_id}' could not be applied on AR Invoice for customer '${customerId}'. Verify Acumatica AR/PM project-customer configuration.`
        : baseMessage;
      result.errors.push(
        `Payment application ${referenceNbr}: ${message}`,
      );
      auditLogs.push({
        run_id: runId,
        triggered_by_user_id: auditContext?.userId ?? null,
        project_id: projectId,
        contract_id: application.contract_id,
        entity_name: "paymentApplications",
        source_table: "prime_contract_payment_applications",
        source_record_id: application.id,
        source_reference: application.application_number ?? null,
        acumatica_entity: "Invoice",
        acumatica_reference: existingAcumaticaInvoiceRef ?? referenceNbr,
        acumatica_doc_type: "Invoice",
        operation: "error",
        success: false,
        error_message: message,
        request_payload: toJsonValue(payload),
        response_payload: null,
      });
    }
  }

  await flushOutboundAuditLogs(supabase, auditLogs);
  return result;
}

/**
 * Export owner invoices from the app to Acumatica AR Invoices.
 */
export async function exportOwnerInvoicesToAcumatica(
  projectId: number,
  auditContext?: AcumaticaOutboundAuditContext,
): Promise<ExportSyncResult> {
  const result: ExportSyncResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const supabase = await createClient();
  const acuClient = createAcumaticaClient();
  await acuClient.login();
  const runId = auditContext?.runId ?? crypto.randomUUID();
  const auditLogs: OutboundAuditLogRow[] = [];

  const [{ data: project }, { data: primeContracts }] = await Promise.all([
    supabase
      .from("projects")
      .select("acumatica_project_id")
      .eq("id", projectId)
      .single(),
    supabase
      .from("prime_contracts")
      .select("id, client_id, contract_company_id")
      .eq("project_id", projectId),
  ]);

  if (!project?.acumatica_project_id) {
    result.errors.push("Project has no acumatica_project_id mapping.");
    return result;
  }

  const primeContractIds = (primeContracts ?? []).map((c) => c.id);
  if (!primeContractIds.length) {
    result.skipped++;
    return result;
  }

  const companyIds = Array.from(
    new Set(
      (primeContracts ?? [])
        .flatMap((c) => [c.client_id, c.contract_company_id])
        .filter(Boolean) as string[],
    ),
  );
  let customerByCompanyId = new Map<string, string>();
  if (companyIds.length) {
    const { data: companies } = await supabase
      .from("companies")
      .select("id, customer_id")
      .in("id", companyIds);
    customerByCompanyId = new Map(
      (companies ?? [])
        .filter((c) => !!c.customer_id)
        .map((c) => [c.id, c.customer_id as string]),
    );
  }

  const customerId =
    (primeContracts ?? [])
      .map(
        (c) =>
          (c.client_id && customerByCompanyId.get(c.client_id)) ||
          (c.contract_company_id &&
            customerByCompanyId.get(c.contract_company_id)) ||
          null,
      )
      .find(Boolean) ?? null;

  if (!customerId) {
    result.errors.push(
      "No Acumatica customer mapping found for the project's prime contract companies.",
    );
    return result;
  }

  const { data: invoices, error: invoicesError } = await supabase
    .from("owner_invoices")
    .select(
      "id, invoice_number, status, acumatica_ref_nbr, acumatica_doc_type, billing_date, due_date, period_start, period_end, gross_amount, net_amount, prime_contract_id",
    )
    .in("prime_contract_id", primeContractIds);

  if (invoicesError) {
    result.errors.push(`Failed loading owner invoices: ${invoicesError.message}`);
    return result;
  }

  const invoiceIds = (invoices ?? []).map((i) => i.id);
  const { data: lineItems } = invoiceIds.length
    ? await supabase
        .from("owner_invoice_line_items")
        .select("invoice_id, acumatica_line_nbr, description, approved_amount, category")
        .in("invoice_id", invoiceIds)
    : { data: [] };

  const linesByInvoiceId = new Map<number, Array<Record<string, unknown>>>();
  for (const line of lineItems ?? []) {
    const current = linesByInvoiceId.get(line.invoice_id) ?? [];
    current.push({
      LineNbr: acuField(line.acumatica_line_nbr ?? undefined),
      TransactionDescription: acuField(line.description ?? undefined),
      ExtendedPrice: acuField(line.approved_amount ?? 0),
      AccountID: acuField(line.category ?? undefined),
    });
    linesByInvoiceId.set(line.invoice_id, current);
  }

  const now = new Date().toISOString();

  for (const invoice of invoices ?? []) {
    const referenceNbr =
      invoice.acumatica_ref_nbr ??
      invoice.invoice_number ??
      `OWNER-INV-${invoice.id}`;
    const docType = invoice.acumatica_doc_type ?? "Invoice";
    const details = linesByInvoiceId.get(invoice.id) ?? [];

    const payload: Record<string, unknown> = {
      Type: acuField(docType),
      ReferenceNbr: acuField(referenceNbr),
      Customer: acuField(customerId),
      Date: acuField(toIsoDate(invoice.billing_date ?? invoice.period_start)),
      DueDate: acuField(toIsoDate(invoice.due_date ?? invoice.period_end)),
      Description: acuField(`Owner Invoice ${invoice.invoice_number ?? referenceNbr}`),
      Amount: acuField(invoice.gross_amount ?? invoice.net_amount ?? 0),
      Status: acuField(mapOutboundStatus(invoice.status, "invoice")),
      Details: details,
    };

    try {
      const existed = !!invoice.acumatica_ref_nbr;
      const response = await upsertInvoiceWithProjectFallback(acuClient, payload);
      const returnedRef =
        typeof response.ReferenceNbr === "string" ? response.ReferenceNbr : referenceNbr;
      const returnedType =
        typeof response.Type === "string" ? response.Type : docType;

      await supabase
        .from("owner_invoices")
        .update({
          acumatica_ref_nbr: returnedRef,
          acumatica_doc_type: returnedType,
          acumatica_sync_at: now,
        })
        .eq("id", invoice.id);

      if (existed) result.updated++;
      else result.created++;
      auditLogs.push({
        run_id: runId,
        triggered_by_user_id: auditContext?.userId ?? null,
        project_id: projectId,
        contract_id: invoice.prime_contract_id,
        entity_name: "invoices",
        source_table: "owner_invoices",
        source_record_id: String(invoice.id),
        source_reference: invoice.invoice_number ?? null,
        acumatica_entity: "Invoice",
        acumatica_reference: returnedRef,
        acumatica_doc_type: returnedType,
        operation: existed ? "update" : "create",
        success: true,
        error_message: null,
        request_payload: toJsonValue(payload),
        response_payload: toJsonValue(response),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Owner invoice ${referenceNbr}: ${message}`);
      auditLogs.push({
        run_id: runId,
        triggered_by_user_id: auditContext?.userId ?? null,
        project_id: projectId,
        contract_id: invoice.prime_contract_id,
        entity_name: "invoices",
        source_table: "owner_invoices",
        source_record_id: String(invoice.id),
        source_reference: invoice.invoice_number ?? null,
        acumatica_entity: "Invoice",
        acumatica_reference: referenceNbr,
        acumatica_doc_type: docType,
        operation: "error",
        success: false,
        error_message: message,
        request_payload: toJsonValue(payload),
        response_payload: null,
      });
    }
  }

  await flushOutboundAuditLogs(supabase, auditLogs);
  return result;
}

/**
 * Export one subcontractor invoice from Alleato to Acumatica as an AP Bill.
 *
 * The returned Acumatica reference is written back to subcontractor_invoices so
 * inbound AP checks can be reconciled without relying on vendor/project guesses.
 */
export async function exportSubcontractorInvoiceToAcumatica(
  projectId: number,
  invoiceId: number,
  auditContext?: AcumaticaOutboundAuditContext,
): Promise<ExportSyncResult> {
  const result: ExportSyncResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const supabase = await createClient();
  const acuClient = createAcumaticaClient();
  await acuClient.login();
  const runId = auditContext?.runId ?? crypto.randomUUID();
  const auditLogs: OutboundAuditLogRow[] = [];

  const { data: invoice, error: invoiceError } = await supabase
    .from("subcontractor_invoices")
    .select(
      "id, project_id, subcontract_id, purchase_order_id, invoice_number, status, billing_date, period_start, period_end, notes, acumatica_ref_nbr, acumatica_doc_type",
    )
    .eq("id", invoiceId)
    .eq("project_id", projectId)
    .single();

  if (invoiceError || !invoice) {
    result.errors.push(invoiceError?.message ?? "Subcontractor invoice not found.");
    return result;
  }

  const status = (invoice.status ?? "").toLowerCase();
  if (!["approved", "approved_as_noted", "paid"].includes(status)) {
    result.skipped++;
    result.errors.push(`Invoice ${invoice.invoice_number ?? invoice.id} must be approved before export.`);
    return result;
  }

  const [{ data: project }, { data: lineItems, error: lineItemsError }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, acumatica_project_id")
        .eq("id", projectId)
        .single(),
      supabase
        .from("subcontractor_invoice_line_items")
        .select(
          "id, description, budget_code, net_amount_this_period, total_completed_stored, materials_stored, work_completed_period",
        )
        .eq("invoice_id", invoiceId)
        .order("sort_order", { ascending: true }),
    ]);

  if (!project?.acumatica_project_id) {
    result.errors.push("Project has no acumatica_project_id mapping.");
    return result;
  }

  if (lineItemsError) {
    result.errors.push(`Failed loading invoice line items: ${lineItemsError.message}`);
    return result;
  }

  if (!invoice.subcontract_id && !invoice.purchase_order_id) {
    result.errors.push("Subcontractor invoice is not linked to a commitment.");
    return result;
  }

  const commitmentResult = invoice.subcontract_id
    ? await supabase
        .from("subcontracts")
        .select("id, contract_number, title, contract_company_id")
        .eq("id", invoice.subcontract_id)
        .single()
    : await supabase
        .from("purchase_orders")
        .select("id, contract_number, title, contract_company_id")
        .eq("id", invoice.purchase_order_id as string)
        .single();

  if (commitmentResult.error || !commitmentResult.data) {
    result.errors.push(
      commitmentResult.error?.message ?? "Commitment not found for subcontractor invoice.",
    );
    return result;
  }

  const commitment = commitmentResult.data;
  if (!commitment.contract_company_id) {
    result.errors.push("Commitment has no contract company for Acumatica vendor mapping.");
    return result;
  }

  const { data: vendorCompany, error: vendorError } = await supabase
    .from("companies")
    .select("id, name, acumatica_vendor_id")
    .eq("id", commitment.contract_company_id)
    .single();

  if (vendorError || !vendorCompany?.acumatica_vendor_id) {
    result.errors.push(
      vendorError?.message ??
        "Commitment company has no acumatica_vendor_id mapping.",
    );
    return result;
  }

  const billLines = (lineItems ?? [])
    .map((line, index) => {
      const amount =
        Number(line.net_amount_this_period ?? 0) ||
        Number(line.total_completed_stored ?? 0) ||
        Number(line.work_completed_period ?? 0) ||
        Number(line.materials_stored ?? 0) ||
        0;

      return {
        LineNbr: acuField(index + 1),
        Description: acuField(line.description ?? `Invoice line ${index + 1}`),
        Quantity: acuField(1),
        UnitCost: acuField(amount),
        ExtendedCost: acuField(amount),
        ProjectID: acuField(project.acumatica_project_id),
        ...(line.budget_code ? { CostCodeID: acuField(line.budget_code) } : {}),
      };
    })
    .filter((line) => Number((line.ExtendedCost as { value: number }).value) !== 0);

  const billAmount = billLines.reduce(
    (sum, line) => sum + Number((line.ExtendedCost as { value: number }).value || 0),
    0,
  );

  if (billAmount <= 0) {
    result.errors.push("Invoice has no payable line amount to export.");
    return result;
  }

  const referenceNbr =
    invoice.acumatica_ref_nbr ??
    invoice.invoice_number ??
    `SUBINV-${invoice.id}`;
  const docType = invoice.acumatica_doc_type ?? "Bill";
  const description =
    invoice.notes?.trim() ||
    `Subcontractor Invoice ${invoice.invoice_number ?? invoice.id}`;
  const existed = Boolean(invoice.acumatica_ref_nbr);
  const payload: Record<string, unknown> = {
    Type: acuField(docType),
    ReferenceNbr: acuField(referenceNbr),
    Vendor: acuField(vendorCompany.acumatica_vendor_id),
    VendorRef: acuField(invoice.invoice_number ?? referenceNbr),
    Project: acuField(project.acumatica_project_id),
    Date: acuField(toIsoDate(invoice.billing_date ?? invoice.period_start)),
    DueDate: acuField(toIsoDate(invoice.period_end ?? invoice.billing_date ?? invoice.period_start)),
    Description: acuField(description),
    Amount: acuField(billAmount),
    Status: acuField(mapOutboundStatus(invoice.status, "invoice")),
    Details: billLines,
  };

  try {
    const response = await acuClient.upsertBill(payload);
    const returnedRef =
      typeof response.ReferenceNbr === "string"
        ? response.ReferenceNbr
        : referenceNbr;
    const returnedType =
      typeof response.Type === "string" ? response.Type : docType;
    const now = new Date().toISOString();

    const { data: mirroredBill } = await supabase
      .from("acumatica_ap_bills")
      .select("id")
      .eq("reference_nbr", returnedRef)
      .eq("document_type", returnedType)
      .maybeSingle();

    await supabase
      .from("subcontractor_invoices")
      .update({
        acumatica_ref_nbr: returnedRef,
        acumatica_doc_type: returnedType,
        acumatica_sync_at: now,
        acumatica_ap_bill_id: mirroredBill?.id ?? null,
      })
      .eq("id", invoice.id);

    if (existed) result.updated++;
    else result.created++;

    auditLogs.push({
      run_id: runId,
      triggered_by_user_id: auditContext?.userId ?? null,
      project_id: projectId,
      contract_id: invoice.subcontract_id ?? invoice.purchase_order_id,
      entity_name: "subcontractorInvoices",
      source_table: "subcontractor_invoices",
      source_record_id: String(invoice.id),
      source_reference: invoice.invoice_number ?? null,
      acumatica_entity: "Bill",
      acumatica_reference: returnedRef,
      acumatica_doc_type: returnedType,
      operation: existed ? "update" : "create",
      success: true,
      error_message: null,
      request_payload: toJsonValue(payload),
      response_payload: toJsonValue(response),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(`Subcontractor invoice ${referenceNbr}: ${message}`);
    auditLogs.push({
      run_id: runId,
      triggered_by_user_id: auditContext?.userId ?? null,
      project_id: projectId,
      contract_id: invoice.subcontract_id ?? invoice.purchase_order_id,
      entity_name: "subcontractorInvoices",
      source_table: "subcontractor_invoices",
      source_record_id: String(invoice.id),
      source_reference: invoice.invoice_number ?? null,
      acumatica_entity: "Bill",
      acumatica_reference: referenceNbr,
      acumatica_doc_type: docType,
      operation: "error",
      success: false,
      error_message: message,
      request_payload: toJsonValue(payload),
      response_payload: null,
    });
  }

  await flushOutboundAuditLogs(supabase, auditLogs);
  return result;
}
