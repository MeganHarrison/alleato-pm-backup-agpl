import { tool } from "ai";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { type ToolTracePayload, asNumber, resolveProject, withTrace as _withTrace } from "./tool-utils";
import { createToolContext, type ToolContext } from "./tool-context";

import { type AnyRow } from "./types";

type CreateFinancialToolsOptions = {
  onTrace?: (trace: ToolTracePayload) => void;
  pinnedProjectId?: number;
  // Injected data seam; defaults to building a real context when omitted.
  ctx?: ToolContext;
};

const PRIME_CHANGE_ORDER_LINES_TABLE = "change_order_lines";
const BUDGET_LINES_VIEW = "v_budget_lines";

type RuntimeRowsResult = {
  data: Array<Record<string, unknown>> | null;
  error: unknown;
};

type RuntimeProjectRowsClient = {
  from: (tableName: string) => {
    select: (columns: string) => {
      eq: (column: string, value: number) => Promise<RuntimeRowsResult>;
    };
  };
};

type RuntimeBudgetLineRowsClient = {
  from: (tableName: string) => {
    select: (columns: string) => {
      eq: (column: string, value: number) => {
        eq: (column: string, value: string) => Promise<RuntimeRowsResult>;
      } & Promise<RuntimeRowsResult>;
    };
  };
};

function withTrace<TInput extends Record<string, unknown>, TResult>(
  name: string,
  options: CreateFinancialToolsOptions,
  execute: (input: TInput) => Promise<TResult>,
) {
  return _withTrace(
    name,
    options,
    execute,
    "This financial data source failed during retrieval. Be explicit about the missing source and do not invent totals.",
  );
}

/** Loads pending prime change-order line allocations, or an empty set when the legacy table is absent. */
async function fetchPendingPrimeChangeOrderLines(
  supabase: ReturnType<typeof createServiceClient>,
  projectId: number,
) {
  const runtimeProjectClient = supabase as unknown as RuntimeProjectRowsClient;
  const result = await runtimeProjectClient
    .from(PRIME_CHANGE_ORDER_LINES_TABLE)
    .select(
      "id, change_order_id, amount, description, cost_code_id, cost_type_id",
    )
    .eq("project_id", projectId);

  // Only treat a PostgREST "relation does not exist" (PGRST205) as the legacy
  // table being absent. Matching on the table NAME would misclassify a genuine
  // RLS/permission/timeout error (whose message often includes the table name)
  // as "missing" and silently zero out change-order financials.
  const e = (result.error ?? {}) as {
    code?: string;
    message?: string;
    hint?: string;
  };
  const isMissingTable =
    e.code === "PGRST205" ||
    (e.message ?? "").includes("schema cache") ||
    (e.hint ?? "").includes("schema cache");

  if (result.error && isMissingTable) {
    return { data: [], error: null };
  }

  return result;
}

/** Loads budget-line rows from the runtime view and optionally filters by cost code. */
async function fetchRuntimeBudgetLines(
  supabase: ReturnType<typeof createServiceClient>,
  projectId: number,
  costCodeId?: string,
): Promise<RuntimeRowsResult> {
  const runtimeBudgetClient = supabase as unknown as RuntimeBudgetLineRowsClient;
  const baseQuery = runtimeBudgetClient
    .from(BUDGET_LINES_VIEW)
    .select(
      "id, original_amount, revised_budget, approved_co_total, " +
      "budget_mod_total, cost_code_id, cost_type_id, description",
    )
    .eq("project_id", projectId);

  if (!costCodeId) {
    return baseQuery;
  }

  return baseQuery.eq("cost_code_id", costCodeId);
}

/** Detect errors caused by the v_budget_lines view being absent or stale in the schema cache. */
export function isMissingBudgetViewError(error: unknown): boolean {
  if (typeof error === "string") {
    return error.includes("v_budget_lines") || error.includes("schema cache");
  }

  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    // PGRST205 = PostgREST "relation does not exist" / schema cache miss
    if (e["code"] === "PGRST205") return true;
    const msg = typeof e["message"] === "string" ? e["message"] : "";
    const hint = typeof e["hint"] === "string" ? e["hint"] : "";
    if (
      msg.includes("v_budget_lines") ||
      hint.includes("v_budget_lines") ||
      msg.includes("schema cache") ||
      hint.includes("schema cache")
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Fetch budget rows for briefing tools, falling back from v_budget_lines to
 * budget_lines when the view is unavailable. Returns a source tag so callers
 * can surface a data-gap warning when the fallback is used.
 */
export async function fetchBudgetRowsForBriefing(
  supabase: ReturnType<typeof createServiceClient>,
  projectId: number,
): Promise<{
  data: Array<Record<string, unknown>> | null;
  error: { message: string } | null;
  source: "v_budget_lines" | "budget_lines";
}> {
  const viewResult = (await supabase
    .from("v_budget_lines" as never)
    .select("id, original_amount, revised_budget, approved_co_total, budget_mod_total")
    .eq("project_id", projectId)) as unknown as {
    data: Array<Record<string, unknown>> | null;
    error: { message: string } | null;
  };

  if (!viewResult.error || !isMissingBudgetViewError(viewResult.error)) {
    return { ...viewResult, source: "v_budget_lines" };
  }

  const tableResult = await supabase
    .from("budget_lines")
    .select("id, original_amount")
    .eq("project_id", projectId);

  return {
    data:
      tableResult.data?.map((row) => ({
        ...row,
        revised_budget: row.original_amount,
        approved_co_total: 0,
        budget_mod_total: 0,
      })) ?? null,
    error: tableResult.error,
    source: "budget_lines",
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createFinancialTools(
  _userId: string,
  options: CreateFinancialToolsOptions = {},
) {
  const ctx = options.ctx ?? createToolContext({ userId: _userId, pinnedProjectId: options.pinnedProjectId });
  const supabase = ctx.db;
  const guardrails = ctx.guardrails;

  return {
    // -----------------------------------------------------------------------
    // 1. Commitments Overview
    // -----------------------------------------------------------------------
    getCommitmentsOverview: tool({
      description:
        "Get all commitments (subcontracts and purchase orders) for a project. " +
        "Returns commitment number, vendor/company, status, original value, " +
        "change order value, current value, billed to date, and remaining balance. " +
        "Use when asked about subcontractors, subcontracts, purchase orders, " +
        "committed costs, or vendor contracts.",
      inputSchema: z.object({
        projectId: z.number().optional().describe("Project ID if known"),
        projectName: z
          .string()
          .optional()
          .describe("Project name to search for"),
        status: z
          .string()
          .optional()
          .describe("Filter by status (e.g. 'approved', 'draft', 'complete')"),
      }),
      execute: withTrace(
        "getCommitmentsOverview",
        options,
        async ({ projectId, projectName, status }) => {
          const resolved = await resolveProject(supabase, guardrails, projectId, projectName);
          if ("error" in resolved) return resolved;

          // Fetch subcontracts and purchase orders in parallel
          let subQuery = supabase
            .from("subcontracts")
            .select(
              "id, contract_number, title, status, contract_company_id, " +
              "contract_date, executed, description, default_retainage_percent, " +
              "created_at, deleted_at, project_id",
            )
            .eq("project_id", resolved.id)
            .is("deleted_at", null);

          let poQuery = supabase
            .from("purchase_orders")
            .select(
              "id, contract_number, title, status, contract_company_id, " +
              "contract_date, executed, description, default_retainage_percent, " +
              "created_at, deleted_at, project_id",
            )
            .eq("project_id", resolved.id)
            .is("deleted_at", null);

          if (status) {
            subQuery = subQuery.ilike("status", `%${status}%`);
            poQuery = poQuery.ilike("status", `%${status}%`);
          }

          const [subRes, poRes, sovRes, vendorRes] = await Promise.all([
            subQuery,
            poQuery,
            // Get all schedule_of_values for this project's commitments
            supabase
              .from("schedule_of_values")
              .select("id, commitment_id, total_amount, status")
              .not("commitment_id", "is", null),
            // Get vendor names
            supabase
              .from("companies")
              .select("id, name")
              .eq("is_vendor", true),
          ]);

          const subs = (subRes.data ?? []) as unknown as AnyRow[];
          const pos = (poRes.data ?? []) as unknown as AnyRow[];
          const sovs = (sovRes.data ?? []) as unknown as AnyRow[];
          const vendors = (vendorRes.data ?? []) as unknown as AnyRow[];

          // Build vendor lookup
          const vendorMap = new Map<string, string>();
          vendors.forEach((v) => {
            if (v.id && v.name) vendorMap.set(v.id as string, v.name as string);
          });

          // Build SOV lookup by commitment_id
          const sovByCommitment = new Map<string, AnyRow>();
          sovs.forEach((s) => {
            if (s.commitment_id) {
              sovByCommitment.set(s.commitment_id as string, s);
            }
          });

          // Combine into unified commitments
          const allCommitments: AnyRow[] = [
            ...subs.map((s) => ({ ...s, commitment_type: "subcontract" } as AnyRow)),
            ...pos.map((p) => ({ ...p, commitment_type: "purchase_order" } as AnyRow)),
          ];

          // Get commitment change orders for value calculations
          const commitmentIds = allCommitments.map((c) => c.id as string);

          // Fetch SOV line items for billed-to-date calculation
          const sovIds = commitmentIds
            .map((id) => sovByCommitment.get(id)?.id as string)
            .filter(Boolean);

          let sovLineItems: AnyRow[] = [];
          if (sovIds.length > 0) {
            const { data } = await supabase
              .from("sov_line_items")
              .select("sov_id, scheduled_value, description")
              .in("sov_id", sovIds);
            sovLineItems = (data ?? []) as unknown as AnyRow[];
          }

          // Group SOV line items by sov_id
          const sovLinesBySov = new Map<string, AnyRow[]>();
          sovLineItems.forEach((li) => {
            const arr = sovLinesBySov.get(li.sov_id as string) || [];
            arr.push(li);
            sovLinesBySov.set(li.sov_id as string, arr);
          });

          const commitmentSummaries = allCommitments.map((c) => {
            const sov = sovByCommitment.get(c.id as string);
            const originalValue = asNumber(sov?.total_amount);
            const vendorName = c.contract_company_id
              ? vendorMap.get(c.contract_company_id as string) ?? "Unknown"
              : "No vendor assigned";

            return {
              id: c.id,
              commitmentNumber: c.contract_number,
              title: c.title,
              type: c.commitment_type,
              status: c.status,
              vendorName,
              executed: c.executed,
              contractDate: c.contract_date,
              originalValue,
              retainagePercent: c.default_retainage_percent,
              description: c.description
                ? (c.description as string).substring(0, 200)
                : null,
            };
          });

          // Summary totals
          const totalOriginalValue = commitmentSummaries.reduce(
            (sum, c) => sum + asNumber(c.originalValue),
            0,
          );

          const byStatus = new Map<string, number>();
          commitmentSummaries.forEach((c) => {
            const s = (c.status as string) || "unknown";
            byStatus.set(s, (byStatus.get(s) ?? 0) + 1);
          });

          const byType = new Map<string, number>();
          commitmentSummaries.forEach((c) => {
            const t = c.type as string;
            byType.set(t, (byType.get(t) ?? 0) + 1);
          });

          return {
            sourceRef: `[Source: Commitments - ${resolved.name}]`,
            project: { id: resolved.id, name: resolved.name },
            summary: {
              totalCommitments: commitmentSummaries.length,
              totalOriginalValue,
              subcontractCount: byType.get("subcontract") ?? 0,
              purchaseOrderCount: byType.get("purchase_order") ?? 0,
              statusBreakdown: Object.fromEntries(byStatus),
            },
            commitments: commitmentSummaries,
          };
        },
      ),
    }),

    // -----------------------------------------------------------------------
    // 2. Change Order Details
    // -----------------------------------------------------------------------
    getChangeOrderDetails: tool({
      description:
        "Get change order details for a project, including CO number, title, " +
        "status, amount, associated change events, approval information, and " +
        "submission dates. Also includes commitment change order lines if relevant. " +
        "Use when asked about change orders, COs, contract modifications, or " +
        "scope changes.",
      inputSchema: z.object({
        projectId: z.number().optional().describe("Project ID if known"),
        projectName: z
          .string()
          .optional()
          .describe("Project name to search for"),
        status: z
          .string()
          .optional()
          .describe("Filter by CO status (e.g. 'approved', 'pending', 'draft')"),
        contractId: z
          .number()
          .optional()
          .describe("Filter by specific contract ID"),
      }),
      execute: withTrace(
        "getChangeOrderDetails",
        options,
        async ({ projectId, projectName, status, contractId }) => {
          const resolved = await resolveProject(supabase, guardrails, projectId, projectName);
          if ("error" in resolved) return resolved;

          // Fetch COs from both tables, CO lines, change events, and contracts in parallel
          let primeCoQuery = supabase
            .from("prime_contract_change_orders")
            .select(
              "id, pcco_number, title, status, total_amount, description, " +
              "due_date, submitted_at, created_by, approved_at, approved_by, " +
              "contract_id, change_event_id, project_id, created_at",
            )
            .eq("project_id", resolved.id)
            .order("created_at", { ascending: false })
            .limit(100);

          let commitCoQuery = supabase
            .from("contract_change_orders")
            .select(
              "id, change_order_number, description, status, amount, " +
              "requested_date, contract_id, change_event_id, created_at",
            )
            .order("created_at", { ascending: false })
            .limit(100);

          if (status) {
            primeCoQuery = primeCoQuery.ilike("status", `%${status}%`);
            commitCoQuery = commitCoQuery.ilike("status", `%${status}%`);
          }
          if (contractId) {
            primeCoQuery = primeCoQuery.eq("contract_id", String(contractId));
            // contract_change_orders.contract_id is text
            commitCoQuery = commitCoQuery.eq("contract_id", String(contractId));
          }

          const [primeCoRes, commitCoRes, ceRes, contractRes, coLinesRes] = await Promise.all([
            primeCoQuery,
            commitCoQuery,
            supabase
              .from("change_events")
              .select(
                "id, number, title, status, type, scope, origin, reason, " +
                "expecting_revenue, description, prime_contract_id, created_at",
              )
              .eq("project_id", resolved.id)
              .is("deleted_at", null)
              .order("created_at", { ascending: false })
              .limit(100),
            supabase
              .from("prime_contracts")
              .select("id, title, contract_number, status")
              .eq("project_id", resolved.id),
             
            fetchPendingPrimeChangeOrderLines(
              supabase,
              resolved.id,
            ) as Promise<{ data: Array<Record<string, unknown>> | null; error: unknown }>,
          ]);

          // Normalize both CO types into a unified shape
          const primeCOs = ((primeCoRes.data ?? []) as unknown as Record<string, unknown>[]).map((co) => ({
            ...co,
            co_number: co.pcco_number,
            amount: co.total_amount,
          }));
          const commitCOs = ((commitCoRes.data ?? []) as unknown as Record<string, unknown>[]).map((co) => ({
            ...co,
            co_number: co.change_order_number,
          }));
          const changeOrders = [...primeCOs, ...commitCOs] as unknown as AnyRow[];
          const changeEvents = (ceRes.data ?? []) as unknown as AnyRow[];
          const contracts = (contractRes.data ?? []) as unknown as AnyRow[];
          const coLines = (coLinesRes.data ?? []) as unknown as AnyRow[];

          // Build lookups
          const ceMap = new Map<string, AnyRow>();
          changeEvents.forEach((ce) => ceMap.set(ce.id as string, ce));

          const contractMap = new Map<number, AnyRow>();
          contracts.forEach((c) => contractMap.set(c.id as number, c));

          const linesByCoId = new Map<number, AnyRow[]>();
          coLines.forEach((l) => {
            const coId = l.change_order_id as number;
            const arr = linesByCoId.get(coId) || [];
            arr.push(l);
            linesByCoId.set(coId, arr);
          });

          // Enrich COs
          const enrichedCOs = changeOrders.map((co) => {
            const ce = co.change_event_id
              ? ceMap.get(co.change_event_id as string)
              : null;
            const contract = co.contract_id
              ? contractMap.get(co.contract_id as number)
              : null;
            const lines = linesByCoId.get(co.id as number) ?? [];

            return {
              id: co.id,
              coNumber: co.co_number,
              title: co.title,
              status: co.status,
              amount: co.amount,
              description: co.description
                ? (co.description as string).substring(0, 300)
                : null,
              dueDate: co.due_date,
              submittedAt: co.submitted_at,
              approvedAt: co.approved_at,
              rejectionReason: co.rejection_reason,
              contractTitle: contract?.title ?? null,
              contractNumber: contract?.contract_number ?? null,
              changeEvent: ce
                ? {
                    number: ce.number,
                    title: ce.title,
                    status: ce.status,
                    type: ce.type,
                    scope: ce.scope,
                    origin: ce.origin,
                    expectingRevenue: ce.expecting_revenue,
                  }
                : null,
              lineItemCount: lines.length,
              lineItemTotal: lines.reduce(
                (sum, l) => sum + asNumber(l.amount),
                0,
              ),
            };
          });

          // Summary
          const totalApproved = enrichedCOs
            .filter((co) => co.status === "approved")
            .reduce((sum, co) => sum + asNumber(co.amount), 0);
          const totalPending = enrichedCOs
            .filter(
              (co) => co.status !== "approved" && co.status !== "rejected",
            )
            .reduce((sum, co) => sum + asNumber(co.amount), 0);
          const totalRejected = enrichedCOs
            .filter((co) => co.status === "rejected")
            .reduce((sum, co) => sum + asNumber(co.amount), 0);

          // Change events not yet linked to a CO
          const coLinkedCEIds = new Set(
            changeOrders
              .map((co) => co.change_event_id as string)
              .filter(Boolean),
          );
          const unlinkedCEs = changeEvents
            .filter((ce) => !coLinkedCEIds.has(ce.id as string))
            .map((ce) => ({
              number: ce.number,
              title: ce.title,
              status: ce.status,
              type: ce.type,
              scope: ce.scope,
              expectingRevenue: ce.expecting_revenue,
            }));

          return {
            sourceRef: `[Source: Change Orders - ${resolved.name}]`,
            project: { id: resolved.id, name: resolved.name },
            summary: {
              totalChangeOrders: enrichedCOs.length,
              totalApprovedAmount: totalApproved,
              totalPendingAmount: totalPending,
              totalRejectedAmount: totalRejected,
              changeEventsNotYetCOs: unlinkedCEs.length,
            },
            changeOrders: enrichedCOs,
            unlinkedChangeEvents: unlinkedCEs.slice(0, 20),
          };
        },
      ),
    }),

    // -----------------------------------------------------------------------
    // 3. Direct Costs Summary
    // -----------------------------------------------------------------------
    getDirectCostsSummary: tool({
      description:
        "Get direct costs for a project with categorization by cost type, vendor, " +
        "and time period. Includes line item details with cost codes. Use when " +
        "asked about direct costs, project expenses, vendor payments, or non-commitment costs.",
      inputSchema: z.object({
        projectId: z.number().optional().describe("Project ID if known"),
        projectName: z
          .string()
          .optional()
          .describe("Project name to search for"),
        costType: z
          .string()
          .optional()
          .describe("Filter by cost type (e.g. 'invoice', 'expense')"),
        vendorId: z
          .string()
          .optional()
          .describe("Filter by vendor ID"),
        startDate: z
          .string()
          .optional()
          .describe("Start date filter (YYYY-MM-DD)"),
        endDate: z
          .string()
          .optional()
          .describe("End date filter (YYYY-MM-DD)"),
      }),
      execute: withTrace(
        "getDirectCostsSummary",
        options,
        async ({ projectId, projectName, costType, vendorId, startDate, endDate }) => {
          const resolved = await resolveProject(supabase, guardrails, projectId, projectName);
          if ("error" in resolved) return resolved;

          let dcQuery = supabase
            .from("direct_costs")
            .select(
              "id, cost_type, date, description, total_amount, status, " +
              "invoice_number, vendor_id, paid_date, received_date, terms, created_at",
            )
            .eq("project_id", resolved.id)
            .or("is_deleted.is.null,is_deleted.eq.false")
            .order("date", { ascending: false })
            .limit(200);

          if (costType) {
            dcQuery = dcQuery.ilike("cost_type", `%${costType}%`);
          }
          if (vendorId) {
            dcQuery = dcQuery.eq("vendor_id", vendorId);
          }
          if (startDate) {
            dcQuery = dcQuery.gte("date", startDate);
          }
          if (endDate) {
            dcQuery = dcQuery.lte("date", endDate);
          }

          const [dcRes, vendorRes, lineItemsRes] = await Promise.all([
            dcQuery,
            supabase.from("companies").select("id, name").eq("is_vendor", true),
            supabase
              .from("direct_cost_line_items")
              .select(
                "id, direct_cost_id, description, budget_code_id, quantity, " +
                "unit_cost, line_total",
              ),
          ]);

          const directCosts = (dcRes.data ?? []) as unknown as AnyRow[];
          const vendors = (vendorRes.data ?? []) as unknown as AnyRow[];
          const allLineItems = (lineItemsRes.data ?? []) as unknown as AnyRow[];

          // Build lookups
          const vendorMap = new Map<string, string>();
          vendors.forEach((v) => {
            if (v.id && v.name) vendorMap.set(v.id as string, v.name as string);
          });

          const lineItemsByDcId = new Map<string, AnyRow[]>();
          allLineItems.forEach((li) => {
            const dcId = li.direct_cost_id as string;
            const arr = lineItemsByDcId.get(dcId) || [];
            arr.push(li);
            lineItemsByDcId.set(dcId, arr);
          });

          // Filter line items to only those belonging to our direct costs
          const dcIds = new Set(directCosts.map((dc) => dc.id as string));

          const enrichedCosts = directCosts.map((dc) => {
            const vendorName = dc.vendor_id
              ? vendorMap.get(dc.vendor_id as string) ?? "Unknown"
              : null;
            const lines = (lineItemsByDcId.get(dc.id as string) ?? []).filter(
              (li) => dcIds.has(li.direct_cost_id as string),
            );

            return {
              id: dc.id,
              costType: dc.cost_type,
              date: dc.date,
              description: dc.description
                ? (dc.description as string).substring(0, 200)
                : null,
              totalAmount: dc.total_amount,
              status: dc.status,
              invoiceNumber: dc.invoice_number,
              vendorName,
              paidDate: dc.paid_date,
              lineItemCount: lines.length,
            };
          });

          // Aggregate by cost type
          const byCostType = new Map<string, { count: number; total: number }>();
          enrichedCosts.forEach((dc) => {
            const ct = (dc.costType as string) || "other";
            const existing = byCostType.get(ct) ?? { count: 0, total: 0 };
            existing.count += 1;
            existing.total += asNumber(dc.totalAmount);
            byCostType.set(ct, existing);
          });

          // Aggregate by vendor
          const byVendor = new Map<string, { count: number; total: number }>();
          enrichedCosts.forEach((dc) => {
            const vn = (dc.vendorName as string) ?? "No vendor";
            const existing = byVendor.get(vn) ?? { count: 0, total: 0 };
            existing.count += 1;
            existing.total += asNumber(dc.totalAmount);
            byVendor.set(vn, existing);
          });

          // Monthly breakdown
          const byMonth = new Map<string, number>();
          enrichedCosts.forEach((dc) => {
            if (dc.date) {
              const month = (dc.date as string).substring(0, 7); // YYYY-MM
              byMonth.set(month, (byMonth.get(month) ?? 0) + asNumber(dc.totalAmount));
            }
          });

          const totalAmount = enrichedCosts.reduce(
            (sum, dc) => sum + asNumber(dc.totalAmount),
            0,
          );

          return {
            sourceRef: `[Source: Direct Costs - ${resolved.name}]`,
            project: { id: resolved.id, name: resolved.name },
            summary: {
              totalDirectCosts: enrichedCosts.length,
              totalAmount,
              byCostType: Object.fromEntries(byCostType),
              byVendor: Object.fromEntries(
                [...byVendor.entries()]
                  .sort((a, b) => b[1].total - a[1].total)
                  .slice(0, 15),
              ),
              monthlySpend: Object.fromEntries(
                [...byMonth.entries()].sort(),
              ),
            },
            directCosts: enrichedCosts.slice(0, 50),
          };
        },
      ),
    }),

    // -----------------------------------------------------------------------
    // 4. Budget Line Items
    // -----------------------------------------------------------------------
    getBudgetLineItems: tool({
      description:
        "Get granular budget line items for a project with original budget, " +
        "budget modifications, approved CO impacts, revised budget, and forecasting " +
        "data including projected final cost and variance at completion. " +
        "Use when asked about specific budget lines, cost codes, budget detail, " +
        "or cost-at-completion projections.",
      inputSchema: z.object({
        projectId: z.number().optional().describe("Project ID if known"),
        projectName: z
          .string()
          .optional()
          .describe("Project name to search for"),
        costCodeId: z
          .string()
          .optional()
          .describe("Filter by specific cost code ID"),
      }),
      execute: withTrace(
        "getBudgetLineItems",
        options,
        async ({ projectId, projectName, costCodeId }) => {
          const resolved = await resolveProject(supabase, guardrails, projectId, projectName);
          if ("error" in resolved) return resolved;

          // Fetch budget lines (from the view), cost codes, cost types, and forecasts
           
          const [blRes, ccRes, ctRes, forecastRes, directCostLinesRes] =
            await Promise.all([
              fetchRuntimeBudgetLines(supabase, resolved.id, costCodeId),
              supabase
                .from("cost_codes")
                .select("id, division_id, title, division_title"),
              supabase
                .from("cost_code_types")
                .select("id, code, description"),
              // Get latest forecasts for each budget line
              supabase
                .from("budget_line_forecasts")
                .select(
                  "budget_line_id, forecast_to_complete, forecasted_cost, " +
                  "projected_final_cost, variance_at_completion, percent_complete, " +
                  "burn_rate, ftc_method, forecast_date",
                )
                .order("forecast_date", { ascending: false }),
              // Direct cost line items for actual costs by budget code
              supabase
                .from("direct_cost_line_items")
                .select("budget_code_id, line_total"),
            ]);

          const budgetLines = (blRes.data ?? []) as unknown as AnyRow[];
          const costCodes = (ccRes.data ?? []) as unknown as AnyRow[];
          const costTypes = (ctRes.data ?? []) as unknown as AnyRow[];
          const forecasts = (forecastRes.data ?? []) as unknown as AnyRow[];
          const dcLineItems = (directCostLinesRes.data ?? []) as unknown as AnyRow[];

          // Build lookups
          const ccMap = new Map<string, AnyRow>();
          costCodes.forEach((cc) => ccMap.set(cc.id as string, cc));

          const ctMap = new Map<string, AnyRow>();
          costTypes.forEach((ct) => ctMap.set(ct.id as string, ct));

          // Latest forecast per budget line (first one in desc-sorted list)
          const latestForecastMap = new Map<string, AnyRow>();
          forecasts.forEach((f) => {
            const blId = f.budget_line_id as string;
            if (!latestForecastMap.has(blId)) {
              latestForecastMap.set(blId, f);
            }
          });

          // Direct cost totals by budget code
          const directCostByBudgetCode = new Map<string, number>();
          dcLineItems.forEach((li) => {
            const bcId = li.budget_code_id as string;
            if (bcId) {
              directCostByBudgetCode.set(
                bcId,
                (directCostByBudgetCode.get(bcId) ?? 0) + asNumber(li.line_total),
              );
            }
          });

          // Enrich budget lines
          const enrichedLines = budgetLines.map((bl) => {
            const cc = bl.cost_code_id
              ? ccMap.get(bl.cost_code_id as string)
              : null;
            const ct = bl.cost_type_id
              ? ctMap.get(bl.cost_type_id as string)
              : null;
            const forecast = bl.id
              ? latestForecastMap.get(bl.id as string)
              : null;
            const directCostTotal = bl.id
              ? directCostByBudgetCode.get(bl.id as string) ?? 0
              : 0;

            const originalAmount = asNumber(bl.original_amount);
            const budgetModTotal = asNumber(bl.budget_mod_total);
            const approvedCoTotal = asNumber(bl.approved_co_total);
            const revisedBudget = asNumber(bl.revised_budget);
            const projectedFinalCost = forecast
              ? asNumber(forecast.projected_final_cost)
              : null;
            const varianceAtCompletion = forecast
              ? asNumber(forecast.variance_at_completion)
              : null;

            return {
              id: bl.id,
              costCode: cc
                ? `${cc.division_id}.${cc.id}`
                : bl.cost_code_id,
              costCodeTitle: cc?.title ?? null,
              costCodeDivision: cc?.division_title ?? null,
              costType: ct?.description ?? bl.cost_type_id,
              costTypeCode: ct?.code ?? null,
              description: bl.description,
              originalBudget: originalAmount,
              budgetModifications: budgetModTotal,
              approvedCOImpact: approvedCoTotal,
              revisedBudget,
              directCosts: directCostTotal,
              projectedFinalCost,
              varianceAtCompletion,
              percentComplete: forecast
                ? asNumber(forecast.percent_complete)
                : null,
              burnRate: forecast ? asNumber(forecast.burn_rate) : null,
              forecastMethod: forecast?.ftc_method ?? null,
            };
          });

          // Sort by revised budget descending (biggest items first)
          enrichedLines.sort(
            (a, b) => asNumber(b.revisedBudget) - asNumber(a.revisedBudget),
          );

          // Totals
          const totalOriginal = enrichedLines.reduce(
            (sum, l) => sum + asNumber(l.originalBudget),
            0,
          );
          const totalRevised = enrichedLines.reduce(
            (sum, l) => sum + asNumber(l.revisedBudget),
            0,
          );
          const totalDirectCosts = enrichedLines.reduce(
            (sum, l) => sum + asNumber(l.directCosts),
            0,
          );
          const totalProjectedFinal = enrichedLines
            .filter((l) => l.projectedFinalCost !== null)
            .reduce((sum, l) => sum + asNumber(l.projectedFinalCost), 0);
          const totalVariance = enrichedLines
            .filter((l) => l.varianceAtCompletion !== null)
            .reduce((sum, l) => sum + asNumber(l.varianceAtCompletion), 0);

          // Lines with concerning variances
          const overBudgetLines = enrichedLines.filter(
            (l) =>
              l.varianceAtCompletion !== null &&
              asNumber(l.varianceAtCompletion) < 0,
          );

          return {
            sourceRef: `[Source: Budget Line Items - ${resolved.name}]`,
            project: { id: resolved.id, name: resolved.name },
            summary: {
              lineCount: enrichedLines.length,
              totalOriginalBudget: totalOriginal,
              totalRevisedBudget: totalRevised,
              totalDirectCosts,
              totalProjectedFinalCost: totalProjectedFinal || null,
              totalVarianceAtCompletion: totalVariance || null,
              overBudgetLineCount: overBudgetLines.length,
              budgetGrowthPct:
                totalOriginal > 0
                  ? Math.round(
                      ((totalRevised - totalOriginal) / totalOriginal) * 100,
                    )
                  : 0,
            },
            budgetLines: enrichedLines,
            overBudgetAlerts: overBudgetLines.slice(0, 10).map((l) => ({
              costCode: l.costCode,
              description: l.description,
              revisedBudget: l.revisedBudget,
              projectedFinalCost: l.projectedFinalCost,
              variance: l.varianceAtCompletion,
            })),
          };
        },
      ),
    }),

    // -----------------------------------------------------------------------
    // 5. Cost Trends
    // -----------------------------------------------------------------------
    getCostTrends: tool({
      description:
        "Analyze spending patterns and cost trends for a project over time. " +
        "Uses budget snapshots, direct cost dates, and invoice data to show " +
        "how costs have changed. Returns monthly spend by category, " +
        "acceleration/deceleration of spending, and burn rate analysis. " +
        "Use when asked about spending trends, cost velocity, burn rate, " +
        "or financial trajectory.",
      inputSchema: z.object({
        projectId: z.number().optional().describe("Project ID if known"),
        projectName: z
          .string()
          .optional()
          .describe("Project name to search for"),
        months: z
          .number()
          .optional()
          .default(12)
          .describe("Number of months to analyze (default 12)"),
      }),
      execute: withTrace(
        "getCostTrends",
        options,
        async ({ projectId, projectName, months }) => {
          const resolved = await resolveProject(supabase, guardrails, projectId, projectName);
          if ("error" in resolved) return resolved;

          const lookbackMonths = months ?? 12;
          const cutoffDate = new Date();
          cutoffDate.setMonth(cutoffDate.getMonth() - lookbackMonths);
          const cutoffStr = cutoffDate.toISOString().split("T")[0];

          // Fetch direct costs, invoices, budget snapshots, and change orders
          const [dcRes, invoiceRes, snapshotRes, coRes] = await Promise.all([
            supabase
              .from("direct_costs")
              .select("id, date, total_amount, cost_type, status")
              .eq("project_id", resolved.id)
              .or("is_deleted.is.null,is_deleted.eq.false")
              .gte("date", cutoffStr)
              .order("date", { ascending: true }),
            supabase
              .from("owner_invoices")
              .select(
                "id, invoice_number, status, period_start, period_end, " +
                "submitted_at, approved_at, contract_id",
              )
              .order("period_start", { ascending: true }),
            supabase
              .from("budget_snapshots")
              .select(
                "id, name, snapshot_type, is_baseline, grand_totals, created_at",
              )
              .eq("project_id", resolved.id)
              .order("created_at", { ascending: true }),
            supabase
              .from("prime_contract_change_orders")
              .select("id, total_amount, status, created_at, approved_at")
              .eq("project_id", resolved.id)
              .gte("created_at", cutoffStr)
              .order("created_at", { ascending: true }),
          ]);

          const directCosts = (dcRes.data ?? []) as unknown as AnyRow[];
          const invoices = (invoiceRes.data ?? []) as unknown as AnyRow[];
          const snapshots = (snapshotRes.data ?? []) as unknown as AnyRow[];
          const changeOrders = ((coRes.data ?? []) as unknown as AnyRow[]).map(co => ({
            ...co,
            amount: co.total_amount,
          })) as unknown as AnyRow[];

          // Filter invoices to contracts in this project
          // (owner_invoices link through contract_id to contracts table)
          // We'll keep all invoices and let the AI correlate

          // Monthly direct cost spend
          const monthlyDirectCosts = new Map<string, number>();
          directCosts.forEach((dc) => {
            const month = (dc.date as string).substring(0, 7);
            monthlyDirectCosts.set(
              month,
              (monthlyDirectCosts.get(month) ?? 0) + asNumber(dc.total_amount),
            );
          });

          // Monthly direct cost spend by cost type
          const monthlyCostType = new Map<
            string,
            Map<string, number>
          >();
          directCosts.forEach((dc) => {
            const month = (dc.date as string).substring(0, 7);
            const ct = (dc.cost_type as string) || "other";
            if (!monthlyCostType.has(month)) {
              monthlyCostType.set(month, new Map());
            }
            const typeMap = monthlyCostType.get(month)!;
            typeMap.set(ct, (typeMap.get(ct) ?? 0) + asNumber(dc.total_amount));
          });

          // Monthly change order amounts
          const monthlyCOAmounts = new Map<string, number>();
          changeOrders.forEach((co) => {
            if (co.created_at) {
              const month = (co.created_at as string).substring(0, 7);
              monthlyCOAmounts.set(
                month,
                (monthlyCOAmounts.get(month) ?? 0) + asNumber(co.amount),
              );
            }
          });

          // Compute spend velocity (month-over-month change)
          const sortedMonths = [...monthlyDirectCosts.entries()].sort(
            (a, b) => a[0].localeCompare(b[0]),
          );

          const spendVelocity: Array<{
            month: string;
            spend: number;
            changeFromPrior: number | null;
            changePct: number | null;
          }> = [];

          for (let i = 0; i < sortedMonths.length; i++) {
            const [month, spend] = sortedMonths[i];
            const priorSpend = i > 0 ? sortedMonths[i - 1][1] : null;
            const changeFromPrior =
              priorSpend !== null ? spend - priorSpend : null;
            const changePct =
              priorSpend !== null && priorSpend > 0
                ? Math.round(((spend - priorSpend) / priorSpend) * 100)
                : null;

            spendVelocity.push({ month, spend, changeFromPrior, changePct });
          }

          // Determine acceleration/deceleration
          const recentMonths = spendVelocity.slice(-3);
          let trendDirection: "accelerating" | "decelerating" | "stable" | "insufficient_data" =
            "insufficient_data";
          if (recentMonths.length >= 2) {
            const changes = recentMonths
              .filter((m) => m.changePct !== null)
              .map((m) => m.changePct!);
            if (changes.length >= 2) {
              const avgChange = changes.reduce((s, c) => s + c, 0) / changes.length;
              if (avgChange > 10) trendDirection = "accelerating";
              else if (avgChange < -10) trendDirection = "decelerating";
              else trendDirection = "stable";
            }
          }

          // Cumulative spend
          let cumulative = 0;
          const cumulativeSpend = sortedMonths.map(([month, spend]) => {
            cumulative += spend;
            return { month, monthlySpend: spend, cumulativeSpend: cumulative };
          });

          // Budget snapshot timeline (if any exist)
          const snapshotTimeline = snapshots.map((s) => ({
            name: s.name,
            type: s.snapshot_type,
            isBaseline: s.is_baseline,
            date: s.created_at,
            grandTotals: s.grand_totals,
          }));

          // Total spend and averages
          const totalDirectCostSpend = directCosts.reduce(
            (sum, dc) => sum + asNumber(dc.total_amount),
            0,
          );
          const monthCount = monthlyDirectCosts.size || 1;
          const avgMonthlySpend = totalDirectCostSpend / monthCount;

          // Monthly breakdown by cost type (flattened)
          const monthlyBreakdown: Record<string, Record<string, number>> = {};
          monthlyCostType.forEach((typeMap, month) => {
            monthlyBreakdown[month] = Object.fromEntries(typeMap);
          });

          return {
            sourceRef: `[Source: Cost Trends - ${resolved.name}]`,
            project: { id: resolved.id, name: resolved.name },
            summary: {
              analysisWindow: `${lookbackMonths} months`,
              totalDirectCostSpend,
              avgMonthlySpend: Math.round(avgMonthlySpend),
              monthsWithData: monthCount,
              spendTrend: trendDirection,
              totalChangeOrderValue: changeOrders.reduce(
                (sum, co) => sum + asNumber(co.amount),
                0,
              ),
            },
            spendVelocity,
            cumulativeSpend,
            monthlyBreakdownByCostType: monthlyBreakdown,
            monthlyChangeOrderAmounts: Object.fromEntries(monthlyCOAmounts),
            budgetSnapshots: snapshotTimeline,
          };
        },
      ),
    }),

    // -----------------------------------------------------------------------
    // 6. Margin Analysis
    // -----------------------------------------------------------------------
    getMarginAnalysis: tool({
      description:
        "Compare revenue (prime contracts and owner change orders) against costs " +
        "(commitments, direct costs) to analyze project profitability. Returns " +
        "original estimated margin, current projected margin, margin trend, and " +
        "breakdown showing where margin is being gained or lost. " +
        "Use when asked about profitability, margin, revenue vs cost, " +
        "project financial health, or over/under budget analysis.",
      inputSchema: z.object({
        projectId: z.number().optional().describe("Project ID if known"),
        projectName: z
          .string()
          .optional()
          .describe("Project name to search for"),
      }),
      execute: withTrace(
        "getMarginAnalysis",
        options,
        async ({ projectId, projectName }) => {
          const resolved = await resolveProject(supabase, guardrails, projectId, projectName);
          if ("error" in resolved) return resolved;

          // Fetch revenue data (prime contracts) and cost data in parallel
          const [
            primeContractRes,
            budgetRes,
            directCostRes,
            sovRes,
            forecastRes,
            coRes,
          ] = await Promise.all([
            // Revenue: prime contracts
            supabase
              .from("prime_contract_financial_summary")
              .select(
                "contract_id, title, original_contract_amount, revised_contract_amount, " +
                "approved_change_orders, pending_change_orders, invoiced_amount, " +
                "payments_received, remaining_balance, status",
              )
              .eq("project_id", resolved.id),
            // Budget lines for budget-based analysis
             
            fetchRuntimeBudgetLines(supabase, resolved.id),
            // Direct costs
            supabase
              .from("direct_costs")
              .select("id, total_amount, cost_type, date")
              .eq("project_id", resolved.id)
              .or("is_deleted.is.null,is_deleted.eq.false"),
            // Commitments (SOV totals as committed cost)
            supabase
              .from("schedule_of_values")
              .select("id, commitment_id, total_amount, status"),
            // Latest forecasts
            supabase
              .from("budget_line_forecasts")
              .select(
                "budget_line_id, projected_final_cost, variance_at_completion, " +
                "forecast_date",
              )
              .order("forecast_date", { ascending: false }),
            // Change orders for scope change tracking
            supabase
              .from("prime_contract_change_orders")
              .select("id, total_amount, status, contract_id")
              .eq("project_id", resolved.id),
          ]);

          const primeContracts = (primeContractRes.data ?? []) as unknown as AnyRow[];
          const budgetLines = (budgetRes.data ?? []) as unknown as AnyRow[];
          const directCosts = (directCostRes.data ?? []) as unknown as AnyRow[];
          const sovs = (sovRes.data ?? []) as unknown as AnyRow[];
          const forecasts = (forecastRes.data ?? []) as unknown as AnyRow[];
          const changeOrders = ((coRes.data ?? []) as unknown as AnyRow[]).map(co => ({
            ...co,
            amount: co.total_amount,
          })) as unknown as AnyRow[];

          // ---- Revenue side ----
          const totalOriginalRevenue = primeContracts.reduce(
            (sum, pc) => sum + asNumber(pc.original_contract_amount),
            0,
          );
          const totalRevisedRevenue = primeContracts.reduce(
            (sum, pc) => sum + asNumber(pc.revised_contract_amount),
            0,
          );
          const totalApprovedRevenueCOs = primeContracts.reduce(
            (sum, pc) => sum + asNumber(pc.approved_change_orders),
            0,
          );
          const totalPendingRevenueCOs = primeContracts.reduce(
            (sum, pc) => sum + asNumber(pc.pending_change_orders),
            0,
          );
          const totalInvoiced = primeContracts.reduce(
            (sum, pc) => sum + asNumber(pc.invoiced_amount),
            0,
          );
          const totalPaymentsReceived = primeContracts.reduce(
            (sum, pc) => sum + asNumber(pc.payments_received),
            0,
          );

          // ---- Cost side ----
          const totalOriginalBudget = budgetLines.reduce(
            (sum, bl) => sum + asNumber(bl.original_amount),
            0,
          );
          const totalRevisedBudget = budgetLines.reduce(
            (sum, bl) => sum + asNumber(bl.revised_budget),
            0,
          );

          const totalDirectCosts = directCosts.reduce(
            (sum, dc) => sum + asNumber(dc.total_amount),
            0,
          );

          // Committed costs from SOVs (filter to commitments in this project)
          // SOVs are linked via commitment_id to subcontracts/POs
          const totalCommittedCosts = sovs.reduce(
            (sum, s) => sum + asNumber(s.total_amount),
            0,
          );

          // Latest forecast per budget line for projected final cost
          const latestForecastMap = new Map<string, AnyRow>();
          forecasts.forEach((f) => {
            const blId = f.budget_line_id as string;
            if (!latestForecastMap.has(blId)) {
              latestForecastMap.set(blId, f);
            }
          });

          const totalProjectedFinalCost = budgetLines.reduce((sum, bl) => {
            const forecast = bl.id
              ? latestForecastMap.get(bl.id as string)
              : null;
            if (forecast) {
              return sum + asNumber(forecast.projected_final_cost);
            }
            // Fall back to revised budget if no forecast
            return sum + asNumber(bl.revised_budget);
          }, 0);

          // ---- Margin calculations ----
          const originalMargin = totalOriginalRevenue - totalOriginalBudget;
          const originalMarginPct =
            totalOriginalRevenue > 0
              ? Math.round((originalMargin / totalOriginalRevenue) * 1000) / 10
              : 0;

          const currentMargin = totalRevisedRevenue - totalRevisedBudget;
          const currentMarginPct =
            totalRevisedRevenue > 0
              ? Math.round((currentMargin / totalRevisedRevenue) * 1000) / 10
              : 0;

          const projectedMargin = totalRevisedRevenue - totalProjectedFinalCost;
          const projectedMarginPct =
            totalRevisedRevenue > 0
              ? Math.round((projectedMargin / totalRevisedRevenue) * 1000) / 10
              : 0;

          // Margin change (original vs projected)
          const marginDelta = projectedMarginPct - originalMarginPct;
          let marginTrend: "improving" | "declining" | "stable" | "no_data" = "no_data";
          if (totalOriginalRevenue > 0 && totalProjectedFinalCost > 0) {
            if (marginDelta > 1) marginTrend = "improving";
            else if (marginDelta < -1) marginTrend = "declining";
            else marginTrend = "stable";
          }

          // Revenue vs cost change orders
          const approvedCostCOs = changeOrders
            .filter((co) => co.status === "approved")
            .reduce((sum, co) => sum + asNumber(co.amount), 0);

          // Financial alerts
          const alerts: string[] = [];
          if (projectedMarginPct < 0) {
            alerts.push(
              `Project is projected to lose money (${projectedMarginPct}% margin)`,
            );
          }
          if (marginDelta < -5) {
            alerts.push(
              `Margin has eroded ${Math.abs(marginDelta).toFixed(1)}% from original estimate`,
            );
          }
          if (totalPendingRevenueCOs > 0) {
            alerts.push(
              `$${totalPendingRevenueCOs.toLocaleString()} in pending revenue COs could improve margin`,
            );
          }
          if (
            totalRevisedRevenue > 0 &&
            totalDirectCosts / totalRevisedRevenue > 0.8
          ) {
            alerts.push(
              `Direct costs alone consume ${Math.round((totalDirectCosts / totalRevisedRevenue) * 100)}% of revenue`,
            );
          }

          return {
            sourceRef: `[Source: Margin Analysis - ${resolved.name}]`,
            project: { id: resolved.id, name: resolved.name },
            revenue: {
              originalContractValue: totalOriginalRevenue,
              revisedContractValue: totalRevisedRevenue,
              approvedChangeOrders: totalApprovedRevenueCOs,
              pendingChangeOrders: totalPendingRevenueCOs,
              invoiced: totalInvoiced,
              paymentsReceived: totalPaymentsReceived,
              contractCount: primeContracts.length,
            },
            costs: {
              originalBudget: totalOriginalBudget,
              revisedBudget: totalRevisedBudget,
              directCostsActual: totalDirectCosts,
              projectedFinalCost: totalProjectedFinalCost,
              budgetLineCount: budgetLines.length,
            },
            margin: {
              originalEstimatedMargin: originalMargin,
              originalMarginPct,
              currentBudgetMargin: currentMargin,
              currentMarginPct,
              projectedMargin,
              projectedMarginPct,
              marginDelta,
              marginTrend,
            },
            alerts,
            contracts: primeContracts.map((pc) => ({
              title: pc.title,
              originalAmount: pc.original_contract_amount,
              revisedAmount: pc.revised_contract_amount,
              approvedCOs: pc.approved_change_orders,
              status: pc.status,
            })),
          };
        },
      ),
    }),
  };
}
