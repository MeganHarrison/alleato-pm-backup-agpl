import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { buildFinanceSpendRollup } from "@/lib/accounting/finance-spend";
import { listSopBacklog } from "@/lib/accounting/sop-backlog";
import { defineReadTool, type ToolTracePayload } from "./tool-utils";
import { type ToolContext } from "./tool-context";

type CreateSaisToolsOptions = {
  onTrace?: (trace: ToolTracePayload) => void;
  // Injected data seam; defaults to building a real context when omitted.
  ctx?: ToolContext;
};

export function createSaisTools(
  _userId: string,
  options: CreateSaisToolsOptions = {},
) {
  const db = options.ctx?.db ?? createServiceClient();
  return {
    getSopBacklog: defineReadTool(
      "getSopBacklog",
      options,
      {
        description:
          "Return structured accounting/finance SOP backlog records, including missing SOP placeholders. " +
          "Use this for questions like 'what SOPs are still needed for accounting?', " +
          "'show missing finance SOPs by priority', or 'what documentation gaps should leadership care about?'. " +
          "This tool intentionally reads sop_backlog, not document_metadata, so missing SOPs are distinct from uploaded files.",
        inputSchema: z.object({
          businessArea: z.enum(["accounting", "finance", "all"]).optional().default("all"),
          status: z
            .enum(["needed", "draft", "in_review", "published", "archived", "all"])
            .optional()
            .default("all"),
        }),
        errorGuidance:
          "SOP backlog data is unavailable. Say that the structured SOP backlog source failed instead of searching uploaded files as a substitute.",
        execute: async ({ businessArea, status }) => {
          const records = await listSopBacklog(db);
          const filtered = records.filter((record) => {
            const areaMatches = businessArea === "all" || record.business_area === businessArea;
            const statusMatches = status === "all" || record.status === status;
            return areaMatches && statusMatches;
          });

          return {
            source: "sop_backlog",
            sourceRef: "[Source: SOP backlog - structured missing-document ledger]",
            count: filtered.length,
            records: filtered.map((record) => ({
              id: record.id,
              title: record.title,
              businessArea: record.business_area,
              status: record.status,
              priority: record.priority,
              priorityLabel: record.priority_label,
              owner: record.owner,
              linkedDocumentStatus: record.linked_document_status,
              linkedDocumentTitle: record.linked_document_title,
              projectName: record.project_name,
              ageDays: record.age_days,
              lastUpdatedDays: record.last_updated_days,
              description: record.description,
            })),
          };
        },
      },
    ),

    getFinanceSpendRollup: defineReadTool(
      "getFinanceSpendRollup",
      options,
      {
        description:
          "Return trailing monthly accounting/finance spend from Acumatica AP bills using the SAIS classification layer. " +
          "Use when asked about accounting spend, finance overhead spend, category/vendor monthly totals, or cleanup exceptions. " +
          "The tool excludes project-coded costs, refunds, reversals, duplicate closure entries, zero-dollar adjustments, and unclassified AP noise.",
        inputSchema: z.object({
          months: z.number().int().min(1).max(24).optional().default(12),
        }),
        errorGuidance:
          "Finance spend rollup data is unavailable. Say that the Acumatica AP classification source failed and avoid estimating spend from memory.",
        execute: async ({ months }) => {
          const rollup = await buildFinanceSpendRollup(db, months);
          return {
            source: "acumatica_ap_bills + finance_spend_classification_rules",
            sourceRef: `[Source: Acumatica AP finance spend rollup - ${rollup.window.startDate} to ${rollup.window.endDate}]`,
            ...rollup,
            includedBills: rollup.includedBills.slice(0, 25),
            exceptions: rollup.exceptions.slice(0, 50),
          };
        },
      },
    ),
  };
}
