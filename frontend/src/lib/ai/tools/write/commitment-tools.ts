import { tool } from "ai";
import type { Database, Json } from "@/types/database.types";
import {
  createCommitmentDescription,
  createCommitmentInputSchema,
} from "@/lib/ai/tool-descriptors";
import {
  recordAiNotificationDecision,
} from "@/lib/ai/notification-decision-ledger";
import {
  fetchCommitmentSovProjectBudgetCodes,
  resolveCommitmentSovBudgetCodeFromLookup,
} from "@/lib/commitments/sov-budget-code-resolution.server";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  buildCommitmentDraftWidget,
  buildCommitmentSovInserts,
  validateCommitmentLineItems,
} from "../action-tools";
import { type ActionToolInternals, withWriteTrace } from "./action-tool-internals";

function resolvePreviewEventKey(
  toolName: string,
  input: Record<string, unknown>,
): string {
  const { createHash } = require("crypto") as typeof import("crypto");
  return createHash("sha256")
    .update(`${toolName}:preview:${JSON.stringify(input)}`)
    .digest("hex");
}

async function recordCommitmentPreviewNotificationDecision({
  userId,
  projectId,
  title,
  type,
  eventKey,
  preview,
}: {
  userId: string;
  projectId: number;
  title: string;
  type: "subcontract" | "purchase_order";
  eventKey: string;
  preview: unknown;
}) {
  return recordAiNotificationDecision({
    recipientUserId: userId,
    eventType: "ai_commitment_awaiting_approval",
    severity: "normal",
    projectId,
    entityType: type === "subcontract" ? "subcontracts" : "purchase_orders",
    eventKey,
    title: "AI commitment draft ready",
    body: `Confirm vendor, dates, and line items before creating the AI-drafted commitment: ${title}`,
    preferenceHints: {
      suppressTeams: true,
    },
    isUserOnRelatedPage: true,
    preview,
  });
}

export function createCommitmentWriteTools(internals: ActionToolInternals) {
  const {
    userId,
    options,
    supabase,
    runtimeCommitmentReadClient,
    runtimeCommitmentWriteClient,
    resolveIdempotencyKey,
    getReplayResponse,
    recordWriteAudit,
    enforceProjectWriteAccess,
  } = internals;

  return {
    createCommitment: tool({
      description: createCommitmentDescription,
      inputSchema: createCommitmentInputSchema,
      execute: withWriteTrace("createCommitment", options, async (input) => {
        const {
          projectId,
          type,
          title,
          vendorName,
          contractNumber,
          status,
          description,
          startDate,
          estimatedCompletionDate,
          defaultRetainagePercent,
          lineItems,
          confirmed,
        } = input;
        const access = await enforceProjectWriteAccess(projectId);
        if (!access.ok) return { success: false, error: access.error };

        const table = type === "subcontract" ? "subcontracts" : "purchase_orders";
        const prefix = type === "subcontract" ? "SC" : "PO";

        // Auto-generate contract number if not provided
        let finalContractNumber = contractNumber;
        if (!finalContractNumber) {
          const { data: existing } = await runtimeCommitmentReadClient
            .from(table)
            .select("contract_number")
            .eq("project_id", projectId)
            .order("created_at", { ascending: false })
            .limit(100);

          // Find highest numeric suffix among existing contract numbers for this prefix
          let maxNum = 0;
          for (const row of existing ?? []) {
            const match = row.contract_number?.match(new RegExp(`^${prefix}-(\\d+)$`));
            if (match) {
              const n = parseInt(match[1], 10);
              if (n > maxNum) maxNum = n;
            }
          }
          finalContractNumber = `${prefix}-${String(maxNum + 1).padStart(3, "0")}`;
        }

        // Look up vendor ID by name if provided
        let contractCompanyId: string | null = null;
        if (vendorName) {
          const { data: vendorRows } = await supabase
            .from("companies")
            .select("id, name")
            .eq("is_vendor", true)
            .ilike("name", `%${vendorName}%`)
            .limit(1);

          if (vendorRows && vendorRows.length > 0) {
            contractCompanyId = vendorRows[0].id;
          }
        }

        if (!confirmed) {
          const previewFields = {
            project_id: projectId,
            contract_number: finalContractNumber,
            title,
            status,
            contract_company_id: contractCompanyId,
            vendor_name_resolved: contractCompanyId ? vendorName : vendorName ? `${vendorName} (not found in project directory — will need to be linked manually)` : null,
            description: description ?? null,
            start_date: startDate ?? null,
            estimated_completion_date: estimatedCompletionDate ?? null,
            default_retainage_percent: defaultRetainagePercent ?? null,
            line_items: lineItems ?? [],
          };
          const widget = buildCommitmentDraftWidget({
            projectId,
            type,
            title,
            contractNumber: finalContractNumber,
            status,
            vendorName: vendorName ?? null,
            contractCompanyId,
            description: description ?? null,
            startDate: startDate ?? null,
            estimatedCompletionDate: estimatedCompletionDate ?? null,
            defaultRetainagePercent: defaultRetainagePercent ?? null,
            lineItems,
          });
          const notificationDecision =
            await recordCommitmentPreviewNotificationDecision({
              userId,
              projectId,
              title,
              type,
              eventKey: resolvePreviewEventKey("createCommitment", previewFields),
              preview: {
                toolName: "createCommitment",
                table,
                fields: previewFields,
                widget,
              },
            });

          return {
            action: "preview",
            message:
              `Here's the ${type === "subcontract" ? "subcontract" : "purchase order"} I'll create. ` +
              "Reply **confirm** to proceed or tell me what to change.",
            notificationDecision,
            widget,
            preview: {
              table,
              fields: previewFields,
            },
          };
        }

        const idempotencyKey = resolveIdempotencyKey("createCommitment", input);
        const replay = await getReplayResponse("createCommitment", idempotencyKey);
        if (replay) return replay;

        if (!contractCompanyId) {
          const failure = {
            success: false,
            error:
              vendorName
                ? `Cannot create the commitment because "${vendorName}" was not found in the vendor directory.`
                : "Cannot create the commitment without a vendor company.",
          };
          await recordWriteAudit({
            toolName: "createCommitment",
            idempotencyKey,
            projectId: access.projectId,
            input,
            status: "error",
            response: failure,
          });
          return failure;
        }

        const lineItemErrors = validateCommitmentLineItems(lineItems);
        if (lineItemErrors.length > 0) {
          const failure = {
            success: false,
            error: "Cannot create the commitment because one or more SOV lines are invalid.",
            details: lineItemErrors,
          };
          await recordWriteAudit({
            toolName: "createCommitment",
            idempotencyKey,
            projectId: access.projectId,
            input,
            status: "error",
            response: failure,
          });
          return failure;
        }

        type CommitmentLineItemBudgetCodeResolution = {
          projectBudgetCodeId: string | null;
          displayBudgetCode: string | null;
        };

        let budgetCodeResolutions: CommitmentLineItemBudgetCodeResolution[] = [];
        const normalizedLineItems = (lineItems ?? []).map((item) => ({
          ...item,
          budgetCode: item.budgetCode?.trim() || undefined,
          description: item.description.trim(),
          uom: item.uom?.trim() || undefined,
        }));
        if (normalizedLineItems.length > 0) {
          try {
            const budgetCodes = await fetchCommitmentSovProjectBudgetCodes(
              supabase,
              projectId,
              "ai/tools/createCommitment",
            );
            budgetCodeResolutions = normalizedLineItems.map((item, index) =>
              resolveCommitmentSovBudgetCodeFromLookup({
                budgetCodes,
                lineNumber: index + 1,
                where: "ai/tools/createCommitment",
                submittedBudgetCode: item.budgetCode ?? null,
              }),
            );
          } catch (error) {
            const failure = {
              success: false,
              error:
                error instanceof GuardrailError
                  ? error.message
                  : "Cannot create the commitment because one or more SOV budget codes could not be validated.",
            };
            await recordWriteAudit({
              toolName: "createCommitment",
              idempotencyKey,
              projectId: access.projectId,
              input,
              status: "error",
              response: failure,
            });
            return failure;
          }
        }

        // Build the insert payload
        const insertPayload: Record<string, unknown> = {
          project_id: projectId,
          contract_number: finalContractNumber,
          title,
          status,
          executed: false,
          contract_company_id: contractCompanyId,
          description: description ?? null,
          default_retainage_percent: defaultRetainagePercent ?? null,
          updated_at: new Date().toISOString(),
        };

        if (type === "subcontract") {
          insertPayload.start_date = startDate ?? null;
          insertPayload.estimated_completion_date = estimatedCompletionDate ?? null;
          insertPayload.is_private = true;
          insertPayload.allow_non_admin_view_sov_items = false;
          insertPayload.non_admin_user_ids = [];
          insertPayload.invoice_contact_ids = [];
        } else {
          // purchase_order uses delivery_date instead of estimated_completion_date
          insertPayload.delivery_date = estimatedCompletionDate ?? null;
          insertPayload.is_private = true;
          insertPayload.allow_non_admin_view_sov_items = false;
          insertPayload.non_admin_user_ids = [];
          insertPayload.invoice_contact_ids = [];
        }

        const { data, error } = await runtimeCommitmentWriteClient
          .from(table)
          .insert(insertPayload)
          .select("id, contract_number, title, status")
          .single();

        if (error) {
          const failure = { success: false, error: (error as { message: string }).message };
          await recordWriteAudit({
            toolName: "createCommitment",
            idempotencyKey,
            projectId: access.projectId,
            input,
            status: "error",
            response: failure,
          });
          return failure;
        }

        const label = type === "subcontract" ? "Subcontract" : "Purchase Order";
        const record = data as { id: string; contract_number: string; title: string; status: string };
        const sovInserts = buildCommitmentSovInserts({
          commitmentId: record.id,
          type,
          lineItems,
          budgetCodeResolutions,
        });

        type Tables = Database["public"]["Tables"];
        type SubcontractSovInsert = Tables["subcontract_sov_items"]["Insert"];
        type PurchaseOrderSovInsert = Tables["purchase_order_sov_items"]["Insert"];

        if (sovInserts.length > 0) {
          const sovResult =
            type === "subcontract"
              ? await supabase.from("subcontract_sov_items").insert(
                  sovInserts as SubcontractSovInsert[],
                )
              : await supabase.from("purchase_order_sov_items").insert(
                  sovInserts as PurchaseOrderSovInsert[],
                );

          if (sovResult.error) {
            const rollback =
              type === "subcontract"
                ? await supabase.from("subcontracts").delete().eq("id", record.id)
                : await supabase.from("purchase_orders").delete().eq("id", record.id);
            const failure = {
              success: false,
              error: `Commitment line items failed to save: ${sovResult.error.message}`,
              rollback: rollback.error
                ? `Base commitment rollback failed: ${rollback.error.message}`
                : "Base commitment rollback succeeded.",
            };
            await recordWriteAudit({
              toolName: "createCommitment",
              idempotencyKey,
              projectId: access.projectId,
              input,
              status: "error",
              response: failure,
            });
            return failure;
          }
        }

        const responseOut = {
          success: true,
          message:
            `${label} **${record.contract_number} — "${title}"** created successfully` +
            (sovInserts.length > 0
              ? ` with ${sovInserts.length} SOV line item${sovInserts.length === 1 ? "" : "s"}.`
              : "."),
          record: data,
          lineItemsCreated: sovInserts.length,
          nextSteps: [
            sovInserts.length > 0
              ? "Open the commitment detail page to review SOV line items"
              : "Open the Commitments page to add SOV line items and set the contract value",
            vendorName && !contractCompanyId
              ? `Link the vendor "${vendorName}" in the commitment detail page — they weren't found in the project directory`
              : null,
            "Upload the signed contract document when available",
            "Submit for approval when ready",
          ].filter(Boolean),
        };
        await recordWriteAudit({
          toolName: "createCommitment",
          idempotencyKey,
          projectId: access.projectId,
          input,
          status: "success",
          response: responseOut,
        });
        return responseOut;
      }),
    }),
  };
}
