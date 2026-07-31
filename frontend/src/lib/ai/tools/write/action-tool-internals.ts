/**
 * ActionToolInternals — the shared closure bundle passed to every domain
 * tool-factory extracted from `action-tools.ts`.
 *
 * This is a pure type + re-export module. It defines the shape of the
 * "internals bag" that `createActionTools` assembles once and threads to
 * each domain factory, so every tool has access to the same helpers without
 * importing them independently.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { Database } from "@/types/database.types";
import type { ToolContext } from "../tool-context";
import type { ToolGuardrails } from "../guardrails";
import type { projectCompanyTypeSchema } from "@/lib/ai/tool-descriptors";

// Re-export types that domain files need from tool-utils and action-tools
export type { ToolTracePayload } from "../tool-utils";
export { withWriteTrace } from "../tool-utils";
export type { ActionToolsOptions } from "../action-tools";

// ---------------------------------------------------------------------------
// Runtime client types (mirrors the shapes cast in createActionTools)
// ---------------------------------------------------------------------------

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

export type RuntimeAuditClient = {
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
    update: (payload: Record<string, unknown>) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => {
          eq: (column: string, value: string) => {
            eq: (column: string, value: string) => {
              select: (columns: string) => {
                maybeSingle: () => Promise<{
                  data: { id: string } | null;
                  error: unknown;
                }>;
              };
            };
          };
        };
      };
    };
  };
};

export type RuntimeCommitmentReadClient = {
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

export type RuntimeCommitmentWriteClient = {
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

// ---------------------------------------------------------------------------
// The internals bag
// ---------------------------------------------------------------------------

export interface ActionToolInternals {
  userId: string;
  options: {
    onTrace?: (trace: { tool: string; input: Record<string, unknown>; output?: unknown; error?: string; timestamp: string }) => void;
    pinnedProjectId?: number;
    generatedTaskWriteMode?: "preview" | "direct";
  };
  ctx: ToolContext;
  supabase: SupabaseClient<Database>;
  guardrails: ToolGuardrails;
  runtimeAuditClient: RuntimeAuditClient;
  runtimeCommitmentReadClient: RuntimeCommitmentReadClient;
  runtimeCommitmentWriteClient: RuntimeCommitmentWriteClient;

  resolveIdempotencyKey: (toolName: string, input: Record<string, unknown>) => string;
  getReplayResponse: (toolName: string, idempotencyKey: string) => Promise<unknown | null>;
  recordWriteAudit: (params: {
    toolName: string;
    idempotencyKey: string;
    projectId: number | null;
    input: Record<string, unknown>;
    status: "pending" | "success" | "error";
    response: unknown;
  }) => Promise<void>;
  finalizeWriteAudit: (params: {
    toolName: string;
    idempotencyKey: string;
    response: unknown;
  }) => Promise<void>;
  failWriteAudit: (params: {
    toolName: string;
    idempotencyKey: string;
    projectId: number | null;
    input: Record<string, unknown>;
    response: unknown;
  }) => Promise<void>;
  enforceProjectWriteAccess: (
    projectId?: number,
  ) => Promise<{ ok: true; projectId: number | null } | { ok: false; error: string }>;
  resolveScheduleTaskAssignee: (
    assignee?: string,
  ) => Promise<{ assignee: string | null; assigneePersonId: string | null }>;
  resolveGeneratedTaskAssignee: (
    assignee?: string,
  ) => Promise<{
    assigneeName: string | null;
    assigneeEmail: string | null;
    assigneePersonId: string | null;
  }>;
  loadGeneratedTaskForWrite: (taskId: string) => Promise<{
    id: string;
    title: string | null;
    description: string;
    status: string;
    priority: string | null;
    due_date: string | null;
    project_id: number | null;
    assignee_name: string | null;
    assignee_email: string | null;
    metadata_id: string | null;
  } | null>;
  normalizeDirectoryText: (value?: string | null) => string | null;
  findCompanyByName: (name: string) => Promise<{
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    website: string | null;
    contact_phone: string | null;
    is_vendor: boolean | null;
  } | null>;
  ensureProjectCompanyAssociation: (params: {
    projectId: number;
    companyId: string;
    companyType?: z.infer<typeof projectCompanyTypeSchema>;
    emailAddress?: string | null;
  }) => Promise<{
    assignment: {
      id: string;
      project_id: number;
      company_id: string;
      status: string | null;
      company_type: string | null;
      email_address: string | null;
      primary_contact_id: string | null;
    };
    action: "assigned" | "reactivated" | "already_assigned";
  }>;
  findPersonByEmail: (email?: string | null) => Promise<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    company_id: string | null;
    person_type: string | null;
    status: string | null;
  } | null>;
}
