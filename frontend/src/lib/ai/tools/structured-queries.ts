import { tool } from "ai";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { type ToolGuardrails } from "./guardrails";
import { type ToolTracePayload, asNumber, resolveProject, withTrace as _withTrace } from "./tool-utils";

import { type AnyRow } from "./types";

// Module-level constant — avoids re-allocating on every tool invocation.
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "for", "to", "of", "in", "on", "at",
  "with", "by", "from", "is", "are", "was", "were", "be", "been", "being",
  "what", "which", "who", "when", "where", "why", "how",
  "need", "show", "tell", "details", "detail", "about",
]);

type CreateStructuredQueryToolsOptions = {
  onTrace?: (trace: ToolTracePayload) => void;
  pinnedProjectId?: number;
};

function withTrace<TInput extends Record<string, unknown>, TResult>(
  name: string,
  options: CreateStructuredQueryToolsOptions,
  execute: (input: TInput) => Promise<TResult>,
) {
  return _withTrace(
    name,
    options,
    execute,
    "Structured data query failed. Try a different filter or broader search.",
  );
}

export function createStructuredQueryTools(
  supabase: ReturnType<typeof createServiceClient>,
  guardrails: ToolGuardrails,
  options: CreateStructuredQueryToolsOptions,
) {
  return {

    queryBudgetData: tool({
      description:
        "Query budget line items for a project. Returns cost codes, original budget, " +
        "changes, revised budget, committed costs, and projected costs. Use for ANY " +
        "budget or cost question.",
      inputSchema: z.object({
        projectId: z.number().optional().describe("Project ID if known"),
        projectName: z.string().optional().describe("Project name to search for"),
        costCodeFilter: z
          .string()
          .optional()
          .describe("Filter by cost code (partial match, e.g. '03-100')"),
      }),
      execute: withTrace(
        "queryBudgetData",
        options,
        async ({ projectId, projectName, costCodeFilter }) => {
          const resolved = await resolveProject(supabase, guardrails, projectId, projectName);
          if ("error" in resolved) return resolved;

          const query = supabase
            .from("budget_lines")
            // cost_type_id -> cost_code_types, which has code/description (NOT
            // title — selecting title errors). cost_code_id -> cost_codes,
            // which does have title. Guarded by the AI read-tool contract harness.
            .select("*, cost_codes:cost_code_id(id, title), cost_types:cost_type_id(id, code, description)")
            .eq("project_id", resolved.id)
            .order("cost_code_id", { ascending: true });

          const { data, error } = await query.limit(500);
          if (error) return { error: `Budget query failed: ${error.message}` };

          // costCodeFilter applies to cost_codes.title — the cost_code_id column is a UUID FK,
          // not the code string (e.g. "03-100"). Post-filter in JS using the joined relation.
          let rows = (data ?? []) as AnyRow[];
          if (costCodeFilter) {
            const filter = costCodeFilter.toLowerCase();
            rows = rows.filter((r) => {
              const title = String((r.cost_codes as Record<string, unknown>)?.title ?? "").toLowerCase();
              return title.includes(filter);
            });
          }

          const totalOriginal = rows.reduce((sum, r) => sum + asNumber(r.original_amount), 0);
          const totalQuantity = rows.reduce((sum, r) => sum + asNumber(r.quantity), 0);

          return {
            project: { id: resolved.id, name: resolved.name },
            totalLineItems: rows.length,
            totals: {
              originalBudget: totalOriginal,
              totalQuantity,
            },
            lineItems: rows.map((r) => ({
              id: r.id,
              costCode: r.cost_codes,
              costType: r.cost_types,
              description: r.description,
              originalAmount: r.original_amount,
              quantity: r.quantity,
              unitCost: r.unit_cost,
              unitOfMeasure: r.unit_of_measure,
              forecastingEnabled: r.forecasting_enabled,
            })),
          };
        },
      ),
    }),

    queryChangeOrders: tool({
      description:
        "Query change orders for a project. Returns CO number, title, status, amount, " +
        "and related details. Searches both commitment change orders (subcontractor) " +
        "and prime contract change orders (owner). Use when asked about change orders, " +
        "COs, PCCOs, or cost changes.",
      inputSchema: z.object({
        projectId: z.number().optional().describe("Project ID if known"),
        projectName: z.string().optional().describe("Project name to search for"),
        status: z
          .string()
          .optional()
          .describe("Filter by status (e.g. 'draft', 'pending', 'approved', 'void')"),
      }),
      execute: withTrace(
        "queryChangeOrders",
        options,
        async ({ projectId, projectName, status }) => {
          const resolved = await resolveProject(supabase, guardrails, projectId, projectName);
          if ("error" in resolved) return resolved;

          // Fetch prime contract change orders (PCCOs)
          let pccoQuery = supabase
            .from("prime_contract_change_orders")
            .select("*")
            .eq("project_id", resolved.id)
            .order("created_at", { ascending: false });

          if (status) {
            pccoQuery = pccoQuery.ilike("status", `%${status}%`);
          }

          const { data: pccoData, error: pccoError } = await pccoQuery.limit(200);
          if (pccoError) return { error: `Prime contract CO query failed: ${pccoError.message}` };
          const pccos = (pccoData ?? []) as AnyRow[];

          // Fetch commitment (subcontractor) change orders. contract_change_orders
          // has a direct project_id FK (it does NOT have a contract_id
          // relationship — embedding contracts:contract_id errors). Query by
          // project_id directly. Guarded by the AI read-tool contract harness.
          let ccoQuery = supabase
            .from("contract_change_orders")
            .select("*")
            .eq("project_id", resolved.id)
            .order("created_at", { ascending: false });

          if (status) {
            ccoQuery = ccoQuery.ilike("status", `%${status}%`);
          }

          const { data: ccoData, error: ccoError } = await ccoQuery.limit(500);
          if (ccoError) return { error: `Commitment CO query failed: ${ccoError.message}` };
          const ccos = (ccoData ?? []) as AnyRow[];

          const totalPccoAmount = pccos.reduce((sum, r) => sum + asNumber(r.total_amount), 0);
          const totalCcoAmount = ccos.reduce((sum, r) => sum + asNumber(r.amount), 0);

          return {
            project: { id: resolved.id, name: resolved.name },
            summary: {
              totalPrimeContractCOs: pccos.length,
              totalCommitmentCOs: ccos.length,
              totalPccoAmount,
              totalCcoAmount,
              grandTotal: totalPccoAmount + totalCcoAmount,
            },
            primeContractChangeOrders: pccos.map((r) => ({
              id: r.id,
              pccoNumber: r.pcco_number,
              title: r.title,
              status: r.status,
              totalAmount: r.total_amount,
              executed: r.executed,
              createdAt: r.created_at,
              approvedAt: r.approved_at,
            })),
            commitmentChangeOrders: ccos.map((r) => ({
              id: r.id,
              changeOrderNumber: r.change_order_number,
              description: r.description,
              status: r.status,
              amount: r.amount,
              requestedDate: r.requested_date,
              approvedDate: r.approved_date,
            })),
          };
        },
      ),
    }),

    queryCommitments: tool({
      description:
        "Query commitments (subcontracts, purchase orders) for a project. Returns " +
        "commitment type, title, status, contract number, and financial details. " +
        "Use when asked about subcontracts, POs, commitments, or vendor contracts.",
      inputSchema: z.object({
        projectId: z.number().optional().describe("Project ID if known"),
        projectName: z.string().optional().describe("Project name to search for"),
        status: z
          .string()
          .optional()
          .describe("Filter by status (e.g. 'draft', 'approved', 'complete')"),
      }),
      execute: withTrace(
        "queryCommitments",
        options,
        async ({ projectId, projectName, status }) => {
          const resolved = await resolveProject(supabase, guardrails, projectId, projectName);
          if ("error" in resolved) return resolved;

          let query = supabase
            .from("commitments_unified")
            .select("*")
            .eq("project_id", resolved.id)
            .is("deleted_at", null)
            .order("created_at", { ascending: false });

          if (status) {
            query = query.ilike("status", `%${status}%`);
          }

          const { data, error } = await query.limit(300);
          if (error) return { error: `Commitments query failed: ${error.message}` };

          const rows = (data ?? []) as AnyRow[];

          return {
            project: { id: resolved.id, name: resolved.name },
            totalCommitments: rows.length,
            commitments: rows.map((r) => ({
              id: r.id,
              title: r.title,
              commitmentType: r.commitment_type,
              contractNumber: r.contract_number,
              status: r.status,
              executed: r.executed,
              contractDate: r.contract_date,
              defaultRetainagePercent: r.default_retainage_percent,
              description: r.description,
              createdAt: r.created_at,
            })),
          };
        },
      ),
    }),

    queryDirectCosts: tool({
      description:
        "Query direct costs for a project. Returns cost type, amount, invoice number, " +
        "vendor, date, and status. Use when asked about direct costs, expenses, " +
        "invoices, or project spend.",
      inputSchema: z.object({
        projectId: z.number().optional().describe("Project ID if known"),
        projectName: z.string().optional().describe("Project name to search for"),
      }),
      execute: withTrace(
        "queryDirectCosts",
        options,
        async ({ projectId, projectName }) => {
          const resolved = await resolveProject(supabase, guardrails, projectId, projectName);
          if ("error" in resolved) return resolved;

          const { data, error } = await supabase
            .from("direct_costs")
            .select("*")
            .eq("project_id", resolved.id)
            .neq("is_deleted", true)
            .order("date", { ascending: false })
            .limit(300);

          if (error) return { error: `Direct costs query failed: ${error.message}` };

          const rows = (data ?? []) as AnyRow[];
          const totalAmount = rows.reduce((sum, r) => sum + asNumber(r.total_amount), 0);

          // Group by cost_type
          const byCostType: Record<string, { count: number; total: number }> = {};
          rows.forEach((r) => {
            const ct = (r.cost_type as string) || "unknown";
            if (!byCostType[ct]) byCostType[ct] = { count: 0, total: 0 };
            byCostType[ct].count++;
            byCostType[ct].total += asNumber(r.total_amount);
          });

          return {
            project: { id: resolved.id, name: resolved.name },
            totalDirectCosts: rows.length,
            totalAmount,
            byCostType,
            directCosts: rows.map((r) => ({
              id: r.id,
              costType: r.cost_type,
              date: r.date,
              description: r.description,
              invoiceNumber: r.invoice_number,
              totalAmount: r.total_amount,
              status: r.status,
              paidDate: r.paid_date,
              receivedDate: r.received_date,
              terms: r.terms,
            })),
          };
        },
      ),
    }),

    queryScheduleTasks: tool({
      description:
        "Query schedule tasks for a project. Returns task name, start/end dates, " +
        "percent complete, status, and WBS code. Use when asked about schedule, " +
        "tasks, timelines, or project progress.",
      inputSchema: z.object({
        projectId: z.number().optional().describe("Project ID if known"),
        projectName: z.string().optional().describe("Project name to search for"),
        status: z
          .string()
          .optional()
          .describe("Filter by status (e.g. 'active', 'completed', 'not_started')"),
      }),
      execute: withTrace(
        "queryScheduleTasks",
        options,
        async ({ projectId, projectName, status }) => {
          const resolved = await resolveProject(supabase, guardrails, projectId, projectName);
          if ("error" in resolved) return resolved;

          let query = supabase
            .from("schedule_tasks")
            .select("*")
            .eq("project_id", resolved.id)
            .order("start_date", { ascending: true });

          if (status) {
            query = query.ilike("status", `%${status}%`);
          }

          const { data, error } = await query.limit(500);
          if (error) return { error: `Schedule tasks query failed: ${error.message}` };

          const rows = (data ?? []) as AnyRow[];

          const totalTasks = rows.length;
          const completedCount = rows.filter(
            (t) => t.status === "completed" || asNumber(t.percent_complete) >= 100,
          ).length;
          const avgCompletion =
            totalTasks > 0
              ? Math.round(
                  rows.reduce((sum, t) => sum + asNumber(t.percent_complete), 0) / totalTasks,
                )
              : 0;

          return {
            project: { id: resolved.id, name: resolved.name },
            summary: {
              totalTasks,
              completedTasks: completedCount,
              avgCompletionPct: avgCompletion,
            },
            tasks: rows.map((t) => ({
              id: t.id,
              name: t.name,
              status: t.status,
              startDate: t.start_date,
              finishDate: t.finish_date,
              percentComplete: t.percent_complete,
              isMilestone: t.is_milestone,
              wbsCode: t.wbs_code,
            })),
          };
        },
      ),
    }),

    queryDocumentRows: tool({
      description:
        "Query structured tabular data extracted from uploaded spreadsheets and " +
        "financial documents. Each row contains column-value pairs from the original " +
        "Excel/CSV. Use when asked about data from uploaded spreadsheets or when you " +
        "need to analyze structured document data.",
      inputSchema: z.object({
        datasetId: z
          .string()
          .describe("The document_metadata ID (dataset) to query rows from"),
        sheetFilter: z
          .string()
          .optional()
          .describe("Filter to a specific sheet name within the spreadsheet"),
      }),
      execute: withTrace(
        "queryDocumentRows",
        options,
        async ({ datasetId, sheetFilter }) => {
          const scope = await guardrails.getScope();
          if (!scope.isAdmin && scope.allowedProjectIds.length === 0) {
            return {
              error:
                "You are not assigned to any projects in the current database scope, so I cannot query structured documents safely.",
            };
          }

          const { data: dataset, error: datasetError } = await supabase
            .from("document_metadata")
            .select("id, title, category, project_id")
            .eq("id", datasetId)
            .maybeSingle();
          if (datasetError) {
            return { error: `Dataset lookup failed: ${datasetError.message}` };
          }
          if (!dataset) {
            return { error: `No dataset found for id "${datasetId}".` };
          }

          const projectId = (dataset as AnyRow).project_id as number | null;
          const category = String((dataset as AnyRow).category ?? "");
          if (!scope.isAdmin) {
            if (!projectId || !scope.allowedProjectIds.includes(projectId)) {
              return { error: "You do not have access to that dataset." };
            }
            if (["email", "teams_message"].includes(category)) {
              return { error: "Email and Teams datasets are admin-only in Alleato." };
            }
          }

          let query = supabase
            .from("document_rows")
            .select("*")
            .eq("dataset_id", datasetId)
            .order("id", { ascending: true });

          if (sheetFilter) {
            query = query.eq("row_data->>sheet", sheetFilter);
          }

          const { data, error } = await query.limit(1000);
          if (error) return { error: `Document rows query failed: ${error.message}` };

          const rows = (data ?? []) as AnyRow[];

          return {
            datasetId,
            datasetTitle: (dataset as AnyRow).title ?? null,
            projectId,
            totalRows: rows.length,
            rows: rows.map((r) => ({
              id: r.id,
              rowData: r.row_data,
            })),
          };
        },
      ),
    }),

    searchStructuredFinancialRows: tool({
      description:
        "Search structured spreadsheet/financial rows extracted into document_rows for a project. " +
        "Use this when the user asks about numbers inside uploaded spreadsheets (budgets, estimates, invoices, tabular exports). " +
        "This is structured-first retrieval (token match on row_data) — better than semantic chunking for numeric questions.",
      inputSchema: z.object({
        query: z.string().describe("The financial question or keywords to match against structured rows."),
        projectId: z.number().optional().describe("Project ID if known (defaults to pinned project when available)."),
        projectName: z.string().optional().describe("Project name to resolve when ID is unknown."),
        matchCount: z.number().optional().default(8).describe("Max structured rows to return."),
        scanLimit: z
          .number()
          .optional()
          .default(400)
          .describe("How many recent rows to scan across candidate datasets (higher = slower)."),
      }),
      execute: withTrace(
        "searchStructuredFinancialRows",
        options,
        async ({ query, projectId, projectName, matchCount, scanLimit }) => {
          const resolved = await resolveProject(supabase, guardrails, projectId, projectName);
          if ("error" in resolved) return resolved;

          const rawTokens =
            query.toLowerCase().match(/[a-z0-9$%./-]+/g) ?? [];

          const tokens: string[] = [];
          const seen = new Set<string>();
          for (const tokenRaw of rawTokens) {
            let token = tokenRaw.trim();
            if (!token) continue;
            if (token.startsWith("$")) token = token.slice(1);
            if (!token) continue;
            if (STOPWORDS.has(token)) continue;
            if (token.length < 3 && !/^q[1-4]$/.test(token)) continue;
            if (!seen.has(token)) {
              seen.add(token);
              tokens.push(token);
            }
          }

          if (tokens.length === 0) {
            return {
              results: [],
              message:
                "Your query did not include any useful keywords to match against structured rows. Try including a cost code, vendor name, invoice number, quarter (q1–q4), or a specific amount.",
            };
          }

          const { data: datasets, error: datasetError } = await supabase
            .from("document_metadata")
            .select("id, title, category, file_name, captured_at, date")
            .eq("project_id", resolved.id)
            .order("captured_at", { ascending: false })
            .limit(140);

          if (datasetError) {
            return { error: `Structured dataset lookup failed: ${datasetError.message}` };
          }

          const candidateIds = (datasets ?? [])
            .filter((row) => {
              const category = String((row as AnyRow).category ?? "").toLowerCase();
              const fileName = String((row as AnyRow).file_name ?? "").toLowerCase();
              return (
                category.includes("financial") ||
                category === "financial_document" ||
                fileName.endsWith(".csv") ||
                fileName.endsWith(".tsv") ||
                fileName.endsWith(".xls") ||
                fileName.endsWith(".xlsx") ||
                ["budget", "estimate", "invoice", "p&l", "balance"].some((k) => fileName.includes(k))
              );
            })
            .map((row) => String((row as AnyRow).id ?? ""))
            .filter(Boolean)
            .slice(0, 30);

          if (candidateIds.length === 0) {
            return {
              results: [],
              message:
                "I did not find any recent spreadsheet/financial datasets for this project. Upload a spreadsheet or tag it as a financial document so it is parsed into structured rows.",
            };
          }

          const datasetById = new Map<string, AnyRow>(
            (datasets ?? []).map((row) => [String((row as AnyRow).id ?? ""), row as AnyRow]),
          );

          const { data: rows, error: rowError } = await supabase
            .from("document_rows")
            .select("id, dataset_id, row_data")
            .in("dataset_id", candidateIds)
            .order("id", { ascending: false })
            .limit(scanLimit ?? 400);

          if (rowError) {
            return { error: `Structured row scan failed: ${rowError.message}` };
          }

          const queryLc = query.toLowerCase().trim();
          const scored = (rows ?? [])
            .map((row) => {
              const rowData = (row as AnyRow).row_data;
              const haystack =
                typeof rowData === "object" && rowData !== null
                  ? JSON.stringify(rowData).toLowerCase()
                  : String(rowData ?? "").toLowerCase();
              const tokenHits = tokens.reduce((sum, t) => (haystack.includes(t) ? sum + 1 : sum), 0);
              if (tokenHits === 0) return null;
              const phraseBonus = queryLc && haystack.includes(queryLc) ? 4 : 0;
              const score = tokenHits + phraseBonus;

              const datasetId = String((row as AnyRow).dataset_id ?? "");
              const dataset = datasetById.get(datasetId) ?? null;

              const columns =
                typeof rowData === "object" && rowData !== null
                  ? (rowData as AnyRow).columns
                  : null;
              const preview =
                columns && typeof columns === "object"
                  ? Object.entries(columns as Record<string, unknown>)
                      .filter(([, v]) => v !== null && v !== "")
                      .slice(0, 8)
                      .map(([k, v]) => `${k}=${String(v)}`)
                      .join("; ")
                  : "";

              return {
                score,
                datasetId,
                datasetTitle: dataset ? String(dataset.title ?? "(untitled)") : "(unknown dataset)",
                datasetDate: dataset ? String(dataset.date ?? dataset.captured_at ?? "") : "",
                rowId: (row as AnyRow).id,
                rowData,
                preview,
              };
            })
            .filter(Boolean) as Array<{
            score: number;
            datasetId: string;
            datasetTitle: string;
            datasetDate: string;
            rowId: number;
            rowData: unknown;
            preview: string;
          }>;

          scored.sort((a, b) => b.score - a.score);
          const top = scored.slice(0, matchCount ?? 8);

          if (top.length === 0) {
            return {
              results: [],
              message:
                "No structured rows matched your query tokens. Try a different cost code/vendor name or confirm the spreadsheet was parsed into document_rows.",
            };
          }

          return {
            project: { id: resolved.id, name: resolved.name },
            query,
            tokenCount: tokens.length,
            scannedRows: (rows ?? []).length,
            resultCount: top.length,
            results: top.map((row) => ({
              datasetId: row.datasetId,
              datasetTitle: row.datasetTitle,
              datasetDate: row.datasetDate || null,
              rowId: row.rowId,
              score: row.score,
              preview: row.preview || null,
              rowData: row.rowData,
              citation: `[Source: Structured Row - dataset ${row.datasetId} row ${row.rowId}]`,
            })),
          };
        },
      ),
    }),

  };
}
