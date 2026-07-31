/**
 * Action Tools — The Write Layer
 *
 * This module owns the `createActionTools` factory. The actual tool definitions
 * live in domain-specific files under `./write/` — this file assembles them from
 * a shared `ActionToolInternals` bundle.
 */

import { z } from "zod";
import { createHash, randomUUID } from "crypto";
import type { CommitmentDraftWidgetPayload } from "@/lib/ai/assistant-widgets";
import type { Database } from "@/types/database.types";
import { createToolGuardrails } from "./guardrails";
import { type ToolTracePayload, withWriteTrace } from "./tool-utils";
import { createToolContext, type ToolContext } from "./tool-context";
import { wrapToolSetWithOutboundActionPolicy } from "./outbound-action-policy";
import {
  commitmentLineItemSchema,
  generatedTaskPrioritySchema,
  generatedTaskStatusSchema,
  projectCompanyTypeSchema,
} from "@/lib/ai/tool-descriptors";
import { notifyRfiReviewNeeded } from "@/services/notificationService";
import {
  recordAiNotificationDecision,
  type AiNotificationDecisionLedgerResult,
} from "@/lib/ai/notification-decision-ledger";
import type { ActionToolInternals } from "./write/action-tool-internals";
import { createChangeOrderWriteTools } from "./write/change-order-tools";
import { createRfiWriteTools } from "./write/rfi-tools";
import { createTaskWriteTools } from "./write/task-tools";
import { createCompanyContactWriteTools } from "./write/company-contact-tools";
import { createSubmittalWriteTools } from "./write/submittal-tools";
import { createCommitmentWriteTools } from "./write/commitment-tools";
import { createPrimeContractWriteTools } from "./write/prime-contract-tools";
import { createCommunicationWriteTools } from "./write/communication-tools";
import { createImplementationDispatchTools } from "./write/implementation-dispatch-tools";
import { createMiscWriteTools } from "./write/misc-write-tools";

export type ActionToolsOptions = {
  onTrace?: (trace: ToolTracePayload) => void;
  pinnedProjectId?: number;
  generatedTaskWriteMode?: "preview" | "direct";
  // Injected data seam; defaults to building a real context when omitted.
  ctx?: ToolContext;
};

export type CreateRFIPreviewInput = {
  projectId: number;
  subject: string;
  question: string;
  ballInCourt?: string;
  dueDate?: string;
  costImpact?: "yes" | "no" | "tbd";
  scheduleImpact?: "yes" | "no" | "tbd";
};

export function normalizeGeneratedTaskPriority(
  priority?: z.infer<typeof generatedTaskPrioritySchema> | null,
): "low" | "medium" | "high" | "urgent" {
  if (priority === "critical" || priority === "urgent") return "urgent";
  if (priority === "high") return "high";
  if (priority === "low") return "low";
  return "medium";
}

export function normalizeGeneratedTaskStatus(
  status?: z.infer<typeof generatedTaskStatusSchema> | null,
): "open" | "in_progress" | "blocked" | "done" | "cancelled" {
  if (status === "completed" || status === "done") return "done";
  if (status === "in_progress") return "in_progress";
  if (status === "blocked") return "blocked";
  if (status === "cancelled") return "cancelled";
  return "open";
}

type CommitmentDraftPreviewInput = {
  projectId: number;
  type: "subcontract" | "purchase_order";
  title: string;
  contractNumber: string;
  status: string;
  vendorName?: string | null;
  contractCompanyId?: string | null;
  description?: string | null;
  startDate?: string | null;
  estimatedCompletionDate?: string | null;
  defaultRetainagePercent?: number | null;
  lineItems?: CommitmentLineItemInput[];
};

type CommitmentLineItemInput = z.infer<typeof commitmentLineItemSchema>;
type Tables = Database["public"]["Tables"];
type SubcontractSovInsert = Tables["subcontract_sov_items"]["Insert"];
type PurchaseOrderSovInsert = Tables["purchase_order_sov_items"]["Insert"];
type CommitmentSovInsert = SubcontractSovInsert | PurchaseOrderSovInsert;
type CommitmentLineItemBudgetCodeResolution = {
  projectBudgetCodeId: string | null;
  displayBudgetCode: string | null;
};

function normalizeCommitmentLineItems(
  lineItems?: CommitmentLineItemInput[] | null,
): CommitmentLineItemInput[] {
  return (lineItems ?? []).map((item) => ({
    ...item,
    budgetCode: item.budgetCode?.trim() || undefined,
    description: item.description.trim(),
    uom: item.uom?.trim() || undefined,
  }));
}

export function validateCommitmentLineItems(
  lineItems?: CommitmentLineItemInput[] | null,
): string[] {
  const errors: string[] = [];
  normalizeCommitmentLineItems(lineItems).forEach((item, index) => {
    const label = `Line ${index + 1}`;
    if (!item.description) {
      errors.push(`${label}: description is required.`);
    }
    if (!Number.isFinite(item.amount) || item.amount < 0) {
      errors.push(`${label}: amount must be zero or greater.`);
    }
    if (item.quantity != null && (!Number.isFinite(item.quantity) || item.quantity < 0)) {
      errors.push(`${label}: quantity must be zero or greater.`);
    }
    if (item.unitCost != null && (!Number.isFinite(item.unitCost) || item.unitCost < 0)) {
      errors.push(`${label}: unit cost must be zero or greater.`);
    }
    if (item.retainagePercent != null && (!Number.isFinite(item.retainagePercent) || item.retainagePercent < 0)) {
      errors.push(`${label}: retainage percent must be zero or greater.`);
    }
  });
  return errors;
}

export function buildCommitmentSovInserts(params: {
  commitmentId: string;
  type: "subcontract" | "purchase_order";
  lineItems?: CommitmentLineItemInput[] | null;
  budgetCodeResolutions?: CommitmentLineItemBudgetCodeResolution[];
}): CommitmentSovInsert[] {
  const now = new Date().toISOString();
  return normalizeCommitmentLineItems(params.lineItems).map((item, index) => {
    const lineNumber = index + 1;
    const budgetCodeResolution = params.budgetCodeResolutions?.[index];
    const base = {
      line_number: lineNumber,
      budget_code: budgetCodeResolution?.displayBudgetCode ?? item.budgetCode ?? null,
      project_budget_code_id: budgetCodeResolution?.projectBudgetCodeId ?? null,
      description: item.description,
      amount: item.amount,
      billed_to_date: 0,
      quantity: item.quantity ?? null,
      unit_cost: item.unitCost ?? null,
      created_at: now,
      updated_at: now,
    };

    if (params.type === "subcontract") {
      return {
        ...base,
        subcontract_id: params.commitmentId,
        unit_of_measure: item.uom ?? null,
        retainage_percent: item.retainagePercent ?? null,
      } satisfies SubcontractSovInsert;
    }

    return {
      ...base,
      purchase_order_id: params.commitmentId,
      uom: item.uom ?? null,
    } satisfies PurchaseOrderSovInsert;
  });
}

export function buildCommitmentDraftWidget(
  input: CommitmentDraftPreviewInput,
): CommitmentDraftWidgetPayload {
  const vendorResolved = Boolean(input.contractCompanyId);
  const commitmentLabel = input.type === "subcontract" ? "Subcontract" : "Purchase order";
  const lineItems = normalizeCommitmentLineItems(input.lineItems);
  const lineItemErrors = validateCommitmentLineItems(lineItems);
  const totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const validation: CommitmentDraftWidgetPayload["validation"] = [
    {
      label: "Project",
      status: Number.isFinite(input.projectId) ? "pass" : "fail",
      message: Number.isFinite(input.projectId) ? `Project ${input.projectId}` : "Missing project.",
    },
    {
      label: "Vendor",
      status: vendorResolved ? "pass" : "fail",
      message: vendorResolved
        ? "Vendor is linked to a company record."
        : input.vendorName
          ? `No matching vendor company was found for "${input.vendorName}".`
          : "Vendor is required before creating a commitment.",
    },
    {
      label: "Contract number",
      status: input.contractNumber ? "pass" : "warning",
      message: input.contractNumber || "Contract number will need to be assigned.",
    },
    {
      label: "SOV lines",
      status: lineItemErrors.length > 0 ? "fail" : lineItems.length > 0 ? "pass" : "warning",
      message:
        lineItemErrors[0] ??
        (lineItems.length > 0
          ? `${lineItems.length} line item${lineItems.length === 1 ? "" : "s"} totaling ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(totalAmount)}.`
          : "No SOV lines provided; the commitment will be created without a contract value."),
    },
  ];

  return {
    type: "commitment_draft",
    id: "commitment-draft-preview",
    title: `${commitmentLabel} draft`,
    commitmentType: input.type,
    projectId: input.projectId,
    contractNumber: input.contractNumber,
    vendorName: input.vendorName ?? null,
    vendorResolved,
    fields: [
      { label: "Title", value: input.title, editable: true },
      { label: "Vendor", value: input.vendorName ?? "", editable: true },
      { label: "Status", value: input.status, editable: true },
      { label: "Scope", value: input.description ?? "", editable: true, multiline: true },
      { label: "Start date", value: input.startDate ?? "", editable: true },
      {
        label: input.type === "purchase_order" ? "Delivery date" : "Estimated completion",
        value: input.estimatedCompletionDate ?? "",
        editable: true,
      },
      {
        label: "Retainage %",
        value: input.defaultRetainagePercent == null ? "" : String(input.defaultRetainagePercent),
        editable: true,
      },
    ],
    validation,
    lineItems: lineItems.map((item, index) => ({
      id: `line-${index + 1}`,
      costCode: item.budgetCode ?? null,
      description: item.description,
      amount: item.amount,
      quantity: item.quantity ?? null,
      unitCost: item.unitCost ?? null,
      uom: item.uom ?? null,
    })),
    totalAmount,
    confirmPrompt:
      "Create this commitment with createCommitment. Use confirmed: false for any revised preview, and confirmed: true only after I explicitly confirm.",
  };
}

function resolvePreviewEventKey(
  toolName: string,
  input: Record<string, unknown>,
): string {
  return createHash("sha256")
    .update(`${toolName}:preview:${JSON.stringify(input)}`)
    .digest("hex");
}

export async function previewCreateRFI(
  userId: string,
  options: ActionToolsOptions,
  input: CreateRFIPreviewInput,
): Promise<unknown> {
  const guardrails = createToolGuardrails(userId, {
    pinnedProjectId: options.pinnedProjectId,
  });
  const access = await guardrails.enforceProjectAccess(input.projectId);
  const traceInput = {
    ...input,
    confirmed: false,
  };

  if (!access.ok) {
    const output = { success: false, error: access.error };
    options.onTrace?.({
      tool: "createRFI",
      input: traceInput,
      output,
      timestamp: new Date().toISOString(),
    });
    return output;
  }

  const fields = {
    project_id: input.projectId,
    subject: input.subject,
    question: input.question,
    ball_in_court: input.ballInCourt,
    due_date: input.dueDate,
    cost_impact: input.costImpact ?? "tbd",
    schedule_impact: input.scheduleImpact ?? "tbd",
    status: "open",
    is_private: false,
  };

  await notifyRfiReviewNeeded(userId, {
    projectId: input.projectId,
    subject: input.subject,
    question: input.question,
    ballInCourt: input.ballInCourt,
    dueDate: input.dueDate,
    costImpact: input.costImpact ?? "tbd",
    scheduleImpact: input.scheduleImpact ?? "tbd",
    eventKey: resolvePreviewEventKey("createRFI", fields),
  });

  const output = {
    action: "preview",
    message: "Here's the RFI I'll create. Reply **confirm** to proceed.",
    preview: {
      table: "rfis",
      fields,
    },
  };

  options.onTrace?.({
    tool: "createRFI",
    input: traceInput,
    output,
    timestamp: new Date().toISOString(),
  });
  return output;
}

type RuntimeReplayAuditRow = {
  response_payload?: unknown;
};

type RuntimeContractNumberRow = {
  contract_number?: string;
};

type RuntimeInsertedRecord = {
  id: string;
  contract_number: string;
  title: string;
  status: string;
};

type RuntimeAuditClient = {
  from: (tableName: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => {
          eq: (column: string, value: string) => {
            eq: (column: string, value: string) => {
              order: (
                column: string,
                options: { ascending: boolean },
              ) => {
                limit: (count: number) => {
                  maybeSingle: () => Promise<{
                    data: RuntimeReplayAuditRow | null;
                    error: unknown;
                  }>;
                };
              };
            };
          };
        };
      };
    };
    insert: (payload: Record<string, unknown>) => Promise<{ error: unknown }>;
  };
};

type RuntimeCommitmentReadClient = {
  from: (tableName: string) => {
    select: (columns: string) => {
      eq: (column: string, value: number) => {
        order: (
          column: string,
          options: { ascending: boolean },
        ) => {
          limit: (
            count: number,
          ) => Promise<{ data: RuntimeContractNumberRow[] | null; error: unknown }>;
        };
      };
    };
  };
};

type RuntimeCommitmentWriteClient = {
  from: (tableName: string) => {
    insert: (payload: Record<string, unknown>) => {
      select: (columns: string) => {
        single: () => Promise<{
          data: RuntimeInsertedRecord | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
};


export function createActionTools(
  userId: string,
  options: ActionToolsOptions = {},
) {
  const ctx = options.ctx ?? createToolContext({ userId, pinnedProjectId: options.pinnedProjectId });
  const supabase = ctx.db;
  const writeAuditTable = "ai_tool_write_audits";
  const runtimeAuditClient = supabase as unknown as RuntimeAuditClient;
  const runtimeCommitmentReadClient =
    supabase as unknown as RuntimeCommitmentReadClient;
  const runtimeCommitmentWriteClient =
    supabase as unknown as RuntimeCommitmentWriteClient;
  const guardrails = ctx.guardrails;

  function resolveIdempotencyKey(
    toolName: string,
    input: Record<string, unknown>,
  ): string {
    const explicit = typeof input.idempotencyKey === "string" ? input.idempotencyKey.trim() : "";
    if (explicit) return explicit;

    const clone = { ...input };
    delete clone.idempotencyKey;
    return createHash("sha256")
      .update(`${toolName}:${JSON.stringify(clone)}`)
      .digest("hex");
  }

  async function getReplayResponse(
    toolName: string,
    idempotencyKey: string,
  ): Promise<unknown | null> {
    const { data, error } = await runtimeAuditClient
      .from(writeAuditTable)
      .select("response_payload,status")
      .eq("user_id", userId)
      .eq("tool_name", toolName)
      .eq("idempotency_key", idempotencyKey)
      .in("status", ["pending", "success"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return null;
    return data?.response_payload ?? null;
  }

  async function recordWriteAudit(params: {
    toolName: string;
    idempotencyKey: string;
    projectId: number | null;
    input: Record<string, unknown>;
    status: "pending" | "success" | "error";
    response: unknown;
  }): Promise<void> {
    const { error } = await runtimeAuditClient.from(writeAuditTable).insert({
      user_id: userId,
      tool_name: params.toolName,
      idempotency_key: params.idempotencyKey,
      project_id: params.projectId,
      request_payload: params.input,
      response_payload: params.response,
      status: params.status,
    });
    if (error) {
      const message = error instanceof Error ? error.message : String((error as { message?: string }).message ?? error);
      throw new Error(`Failed to record AI tool write audit for ${params.toolName}: ${message}`);
    }
  }

  async function finalizeWriteAudit(params: {
    toolName: string;
    idempotencyKey: string;
    response: unknown;
  }): Promise<void> {
    const { data, error } = await runtimeAuditClient
      .from(writeAuditTable)
      .update({ response_payload: params.response, status: "success" })
      .eq("user_id", userId)
      .eq("tool_name", params.toolName)
      .eq("idempotency_key", params.idempotencyKey)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (error || !data) {
      const message = error
        ? error instanceof Error
          ? error.message
          : String((error as { message?: string }).message ?? error)
        : "the reserved audit row was not found";
      throw new Error(
        `Failed to finalize AI tool write audit for ${params.toolName}: ${message}`,
      );
    }
  }

  async function failWriteAudit(params: {
    toolName: string;
    idempotencyKey: string;
    projectId: number | null;
    input: Record<string, unknown>;
    response: unknown;
  }): Promise<void> {
    const { data, error } = await runtimeAuditClient
      .from(writeAuditTable)
      .update({ response_payload: params.response, status: "error" })
      .eq("user_id", userId)
      .eq("tool_name", params.toolName)
      .eq("idempotency_key", params.idempotencyKey)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (error) {
      const message = error instanceof Error ? error.message : String((error as { message?: string }).message ?? error);
      throw new Error(`Failed to fail AI tool write audit for ${params.toolName}: ${message}`);
    }

    if (data) return;

    await recordWriteAudit({
      toolName: params.toolName,
      idempotencyKey: params.idempotencyKey,
      projectId: params.projectId,
      input: params.input,
      status: "error",
      response: params.response,
    });
  }

  async function enforceProjectWriteAccess(
    projectId?: number,
  ): Promise<{ ok: true; projectId: number | null } | { ok: false; error: string }> {
    const effectiveProjectId =
      typeof projectId === "number" && Number.isFinite(projectId)
        ? projectId
        : await guardrails.applyPinnedProject(undefined);

    if (effectiveProjectId == null) {
      return { ok: true, projectId: null };
    }

    const access = await guardrails.enforceProjectAccess(effectiveProjectId);
    if (!access.ok) {
      return { ok: false, error: access.error };
    }

    return { ok: true, projectId: effectiveProjectId };
  }

  async function resolveScheduleTaskAssignee(
    assignee?: string,
  ): Promise<{ assignee: string | null; assigneePersonId: string | null }> {
    const trimmed = assignee?.trim() || null;
    if (!trimmed) return { assignee: null, assigneePersonId: null };

    const normalized = trimmed.toLowerCase();
    const { data, error } = await supabase
      .from("people")
      .select("id,first_name,last_name,email")
      .limit(2000);

    if (error) {
      throw new Error(`Failed to resolve schedule task assignee: ${error.message}`);
    }

    const matches = (data ?? []).filter((person) => {
      const fullName = [person.first_name, person.last_name]
        .filter(Boolean)
        .join(" ")
        .trim()
        .toLowerCase();
      const email = person.email?.trim().toLowerCase() ?? "";
      const firstName = person.first_name?.trim().toLowerCase() ?? "";
      const lastName = person.last_name?.trim().toLowerCase() ?? "";

      return (
        email === normalized ||
        fullName === normalized ||
        (normalized.length >= 3 && (firstName === normalized || lastName === normalized))
      );
    });

    return {
      assignee: trimmed,
      assigneePersonId: matches.length === 1 ? matches[0].id : null,
    };
  }

  async function resolveGeneratedTaskAssignee(
    assignee?: string,
  ): Promise<{
    assigneeName: string | null;
    assigneeEmail: string | null;
    assigneePersonId: string | null;
  }> {
    const trimmed = assignee?.trim() || null;
    if (!trimmed) {
      return { assigneeName: null, assigneeEmail: null, assigneePersonId: null };
    }

    const normalized = trimmed.toLowerCase();
    const { data, error } = await supabase
      .from("people")
      .select("id,first_name,last_name,email")
      .limit(2000);

    if (error) {
      throw new Error(`Failed to resolve task assignee: ${error.message}`);
    }

    const matches = (data ?? []).filter((person) => {
      const fullName = [person.first_name, person.last_name]
        .filter(Boolean)
        .join(" ")
        .trim()
        .toLowerCase();
      const email = person.email?.trim().toLowerCase() ?? "";
      const firstName = person.first_name?.trim().toLowerCase() ?? "";
      const lastName = person.last_name?.trim().toLowerCase() ?? "";

      return (
        email === normalized ||
        fullName === normalized ||
        (normalized.length >= 3 && (firstName === normalized || lastName === normalized))
      );
    });

    const person = matches.length === 1 ? matches[0] : null;
    return {
      assigneeName: person
        ? [person.first_name, person.last_name].filter(Boolean).join(" ").trim() || trimmed
        : trimmed,
      assigneeEmail: person?.email ?? (trimmed.includes("@") ? trimmed : null),
      assigneePersonId: person?.id ?? null,
    };
  }

  async function loadGeneratedTaskForWrite(taskId: string) {
    const { data, error } = await supabase
      .from("tasks")
      .select("id,title,description,status,priority,due_date,project_id,assignee_name,assignee_email,metadata_id")
      .eq("id", taskId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load task ${taskId}: ${error.message}`);
    }
    if (!data) {
      return null;
    }
    return data;
  }

  function normalizeDirectoryText(value?: string | null): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  async function findCompanyByName(name: string) {
    const normalized = name.trim();
    const { data, error } = await supabase
      .from("companies")
      .select("id,name,address,city,state,website,contact_phone,is_vendor")
      .ilike("name", normalized)
      .limit(2);

    if (error) {
      throw new Error(`Failed to resolve company "${name}": ${error.message}`);
    }

    return data?.length === 1 ? data[0] : null;
  }

  async function ensureProjectCompanyAssociation(params: {
    projectId: number;
    companyId: string;
    companyType?: z.infer<typeof projectCompanyTypeSchema>;
    emailAddress?: string | null;
  }) {
    const { data: existing, error: existingError } = await supabase
      .from("project_companies")
      .select("id,project_id,company_id,status,company_type,email_address,primary_contact_id")
      .eq("project_id", params.projectId)
      .eq("company_id", params.companyId)
      .maybeSingle();

    if (existingError) {
      throw new Error(`Failed to check project company assignment: ${existingError.message}`);
    }

    if (existing) {
      if (existing.status !== "ACTIVE") {
        const { data: reactivated, error: reactivateError } = await supabase
          .from("project_companies")
          .update({
            status: "ACTIVE",
            company_type: params.companyType ?? existing.company_type ?? "VENDOR",
            email_address: params.emailAddress ?? existing.email_address,
          })
          .eq("id", existing.id)
          .select("id,project_id,company_id,status,company_type,email_address,primary_contact_id")
          .single();

        if (reactivateError) {
          throw new Error(`Failed to reactivate project company assignment: ${reactivateError.message}`);
        }
        return { assignment: reactivated, action: "reactivated" as const };
      }

      return { assignment: existing, action: "already_assigned" as const };
    }

    const { data: assignment, error } = await supabase
      .from("project_companies")
      .insert({
        project_id: params.projectId,
        company_id: params.companyId,
        company_type: params.companyType ?? "VENDOR",
        email_address: params.emailAddress ?? null,
        status: "ACTIVE",
      })
      .select("id,project_id,company_id,status,company_type,email_address,primary_contact_id")
      .single();

    if (error) {
      throw new Error(`Failed to assign company to project: ${error.message}`);
    }

    return { assignment, action: "assigned" as const };
  }

  async function findPersonByEmail(email?: string | null) {
    const normalizedEmail = normalizeDirectoryText(email)?.toLowerCase();
    if (!normalizedEmail) return null;

    const { data, error } = await supabase
      .from("people")
      .select("id,first_name,last_name,email,company_id,person_type,status")
      .ilike("email", normalizedEmail)
      .limit(2);

    if (error) {
      throw new Error(`Failed to resolve contact by email: ${error.message}`);
    }

    return data?.length === 1 ? data[0] : null;
  }

  // -------------------------------------------------------------------------
  // Build the internals bundle and delegate to domain factories
  // -------------------------------------------------------------------------

  const internals: ActionToolInternals = {
    userId,
    options,
    ctx,
    supabase,
    guardrails,
    runtimeAuditClient,
    runtimeCommitmentReadClient,
    runtimeCommitmentWriteClient,
    resolveIdempotencyKey,
    getReplayResponse,
    recordWriteAudit,
    finalizeWriteAudit,
    enforceProjectWriteAccess,
    resolveScheduleTaskAssignee,
    resolveGeneratedTaskAssignee,
    loadGeneratedTaskForWrite,
    normalizeDirectoryText,
    findCompanyByName,
    ensureProjectCompanyAssociation,
    findPersonByEmail,
  };

  const tools = {
    ...createChangeOrderWriteTools(internals),
    ...createMiscWriteTools(internals),
    ...createRfiWriteTools(internals),
    ...createTaskWriteTools(internals),
    ...createCompanyContactWriteTools(internals),
    ...createSubmittalWriteTools(internals),
    ...createCommitmentWriteTools(internals),
    ...createPrimeContractWriteTools(internals),
    ...createCommunicationWriteTools(internals),
    ...createImplementationDispatchTools(internals),
  };

  return wrapToolSetWithOutboundActionPolicy(tools, {
    onTrace: options.onTrace,
  });
} // end createActionTools
