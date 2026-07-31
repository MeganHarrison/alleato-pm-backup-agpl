import { tool } from "ai";
import {
  createChangeOrderDescription,
  createChangeOrderInputSchema,
  createChangeEventDescription,
  createChangeEventInputSchema,
} from "@/lib/ai/tool-descriptors";
import {
  buildChangeRequestPreviewFields,
  normalizeChangeRequestDraft,
} from "@/lib/ai/workflow-registry";
import {
  buildChangeRequestReviewCard,
} from "@/lib/ai/change-request-field-guide";
import {
  recordAiNotificationDecision,
} from "@/lib/ai/notification-decision-ledger";
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

async function recordChangeEventPreviewNotificationDecision({
  userId,
  projectId,
  title,
  eventKey,
  preview,
}: {
  userId: string;
  projectId: number;
  title: string;
  eventKey: string;
  preview: unknown;
}) {
  return recordAiNotificationDecision({
    recipientUserId: userId,
    eventType: "ai_change_event_awaiting_approval",
    severity: "normal",
    projectId,
    entityType: "change_events",
    eventKey,
    title: "AI change event draft ready",
    body: `Review, edit, or confirm the AI-created change event draft: ${title}`,
    preferenceHints: {
      suppressTeams: true,
    },
    isUserOnRelatedPage: true,
    preview,
  });
}

export function createChangeOrderWriteTools(internals: ActionToolInternals) {
  const {
    userId,
    options,
    supabase,
    resolveIdempotencyKey,
    getReplayResponse,
    recordWriteAudit,
    enforceProjectWriteAccess,
  } = internals;

  return {
    createChangeOrder: tool({
      description: createChangeOrderDescription,
      inputSchema: createChangeOrderInputSchema,
      execute: withWriteTrace("createChangeOrder", options, async (input) => {
        const { projectId, contractId, title, totalAmount, status, confirmed } = input;
        const access = await enforceProjectWriteAccess(projectId);
        if (!access.ok) return { success: false, error: access.error };

        // Preview mode — return what would be created without writing
        if (!confirmed) {
          return {
            action: "preview",
            message:
              "Here's what I'll create. Reply **confirm** to proceed or tell me what to change.",
            preview: {
              table: "prime_contract_change_orders",
              fields: {
                project_id: projectId,
                contract_id: contractId ?? null,
                title,
                total_amount: totalAmount ?? 0,
                status,
              },
            },
          };
        }

        const idempotencyKey = resolveIdempotencyKey("createChangeOrder", input);
        const replay = await getReplayResponse("createChangeOrder", idempotencyKey);
        if (replay) return replay;

        // Write mode — user confirmed
        const { data, error } = await supabase
          .from("prime_contract_change_orders")
          .insert({
            project_id: projectId,
            contract_id: contractId ?? null,
            title,
            total_amount: totalAmount ?? 0,
            status,
          })
          .select("id, title, total_amount, status")
          .single();

        if (error) {
          const failure = { success: false, error: error.message };
          await recordWriteAudit({
            toolName: "createChangeOrder",
            idempotencyKey,
            projectId: access.projectId,
            input,
            status: "error",
            response: failure,
          });
          return failure;
        }

        const response = {
          success: true,
          message: `Change order **"${title}"** created successfully.`,
          record: data,
          nextSteps: [
            "Attach supporting documents in the Change Orders section",
            "Update the amount once scope is finalized",
            "Submit for approval when ready",
          ],
        };
        await recordWriteAudit({
          toolName: "createChangeOrder",
          idempotencyKey,
          projectId: access.projectId,
          input,
          status: "success",
          response,
        });
        return response;
      }),
    }),

    createChangeEvent: tool({
      description: createChangeEventDescription,
      inputSchema: createChangeEventInputSchema,
      execute: withWriteTrace("createChangeEvent", options, async (input) => {
        const normalized = normalizeChangeRequestDraft(input);
        if (!normalized.ok) {
          return {
            success: false,
            error: normalized.error,
            missingFields: normalized.missingFields ?? [],
          };
        }

        const { draft } = normalized;
        const { confirmed } = input;
        const access = await enforceProjectWriteAccess(draft.projectId);
        if (!access.ok) return { success: false, error: access.error };
        const fields = buildChangeRequestPreviewFields(draft);

        if (!confirmed) {
          const eventKey = resolvePreviewEventKey("createChangeEvent", fields as unknown as Record<string, unknown>);
          const preview = {
            toolName: "createChangeEvent",
            table: "change_events",
            fields,
            reviewCard: buildChangeRequestReviewCard(fields),
          };
          const notificationDecision =
            await recordChangeEventPreviewNotificationDecision({
              userId,
              projectId: draft.projectId,
              title: draft.title,
              eventKey,
              preview,
            });

          return {
            action: "preview",
            message: "Here's the change request I'll create. Reply **confirm** to proceed.",
            preview,
            notificationDecision,
          };
        }

        const idempotencyKey = resolveIdempotencyKey("createChangeEvent", input);
        const replay = await getReplayResponse("createChangeEvent", idempotencyKey);
        if (replay) return replay;

        const { data: existing, error: numberError } = await supabase
          .from("change_events")
          .select("number, status, deleted_at")
          .eq("project_id", draft.projectId);

        if (numberError) {
          const failure = {
            success: false,
            error: `Unable to generate the next change request number: ${numberError.message}`,
          };
          await recordWriteAudit({
            toolName: "createChangeEvent",
            idempotencyKey,
            projectId: access.projectId,
            input,
            status: "error",
            response: failure,
          });
          return failure;
        }

        const maxNumber = (existing ?? []).reduce((max, row) => {
          const value = typeof row.number === "string" ? row.number : "";
          const parsed = Number.parseInt(value.replace(/\D/g, ""), 10);
          return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
        }, 0);
        const nextNumber = String(maxNumber + 1).padStart(3, "0");

        const { data, error } = await supabase
          .from("change_events")
          .insert({
            project_id: draft.projectId,
            title: draft.title,
            description: draft.description,
            scope: draft.scope,
            type: draft.type,
            status: draft.status,
            reason: draft.reason,
            origin: draft.origin,
            origin_id: draft.originId,
            number: nextNumber,
            expecting_revenue: draft.expectingRevenue,
            line_item_revenue_source: draft.lineItemRevenueSource,
            prime_contract_id: draft.primeContractId,
            updated_at: new Date().toISOString(),
          })
          .select("id, project_id, title, number, status")
          .single();

        if (error) {
          const failure = { success: false, error: error.message };
          await recordWriteAudit({
            toolName: "createChangeEvent",
            idempotencyKey,
            projectId: access.projectId,
            input,
            status: "error",
            response: failure,
          });
          return failure;
        }

        // Grounded closing insight — reuse the rows already fetched for numbering
        // (no extra round-trip). Count change events still open on this project,
        // including the one we just created.
        const CLOSED_CE_STATUSES = new Set([
          "Approved",
          "Rejected",
          "Closed",
          "Converted",
          "Void",
        ]);
        const otherOpenCount = (existing ?? []).filter((row) => {
          if (row.deleted_at) return false;
          const status = typeof row.status === "string" ? row.status : "";
          return !CLOSED_CE_STATUSES.has(status);
        }).length;
        const newIsOpen = !CLOSED_CE_STATUSES.has(draft.status);
        const openCount = otherOpenCount + (newIsOpen ? 1 : 0);
        const insight =
          openCount > 1
            ? ` That's **${openCount} open change events** on this project now — worth a scan if you're tracking exposure.`
            : openCount === 1
              ? " It's the only change event open on this project right now."
              : "";

        const response = {
          success: true,
          message: `Change request **${data.number} — "${draft.title}"** logged.${insight} Want to add attachments or open the full form to set line items?`,
          record: data,
        };
        await recordWriteAudit({
          toolName: "createChangeEvent",
          idempotencyKey,
          projectId: access.projectId,
          input,
          status: "success",
          response,
        });
        return response;
      }),
    }),
  };
}
