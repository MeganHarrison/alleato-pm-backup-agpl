import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { GuardrailError } from "@/lib/guardrails/errors";

export const sopBusinessAreaSchema = z.enum(["accounting", "finance"]);
export const sopStatusSchema = z.enum(["needed", "draft", "in_review", "published", "archived"]);
export const sopPriorityLabelSchema = z.enum(["critical", "high", "medium", "low"]);

export const createSopBacklogSchema = z.object({
  title: z.string().trim().min(1).max(240),
  business_area: sopBusinessAreaSchema,
  document_type: z.literal("sop").default("sop"),
  status: sopStatusSchema.default("needed"),
  priority: z.coerce.number().int().min(0).max(10000).default(100),
  priority_label: sopPriorityLabelSchema.nullish(),
  description: z.string().trim().max(4000).nullish(),
  owner: z.string().trim().max(180).nullish(),
  linked_document_metadata_id: z.string().trim().min(1).nullish(),
  project_id: z.coerce.number().int().positive().nullish(),
});

export const updateSopBacklogSchema = createSopBacklogSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one SOP backlog field must be provided.",
);

export type SopBacklogCreateInput = z.infer<typeof createSopBacklogSchema>;
export type SopBacklogUpdateInput = z.infer<typeof updateSopBacklogSchema>;
export type SopBacklogRow = Database["public"]["Tables"]["sop_backlog"]["Row"];

export type SopBacklogRecord = SopBacklogRow & {
  linked_document_title: string | null;
  linked_document_status: string;
  project_name: string | null;
  age_days: number;
  last_updated_days: number;
};

type Supabase = SupabaseClient<Database>;

function daysSince(value: string | null): number {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24)));
}

function normalizeNullableString(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
}

function normalizeSopCreatePayload(payload: SopBacklogCreateInput): SopBacklogCreateInput {
  return {
    ...payload,
    priority_label: payload.priority_label ?? null,
    description: normalizeNullableString(payload.description),
    owner: normalizeNullableString(payload.owner),
    linked_document_metadata_id: normalizeNullableString(payload.linked_document_metadata_id),
    project_id: payload.project_id ?? null,
  };
}

function normalizeSopUpdatePayload(payload: SopBacklogUpdateInput): SopBacklogUpdateInput {
  const normalized: SopBacklogUpdateInput = { ...payload };
  if ("priority_label" in normalized) normalized.priority_label = normalized.priority_label ?? null;
  if ("description" in normalized) normalized.description = normalizeNullableString(normalized.description);
  if ("owner" in normalized) normalized.owner = normalizeNullableString(normalized.owner);
  if ("linked_document_metadata_id" in normalized) {
    normalized.linked_document_metadata_id = normalizeNullableString(normalized.linked_document_metadata_id);
  }
  if ("project_id" in normalized) normalized.project_id = normalized.project_id ?? null;
  return normalized;
}

export async function listSopBacklog(supabase: Supabase): Promise<SopBacklogRecord[]> {
  const { data, error } = await supabase
    .from("sop_backlog")
    .select(`
      *,
      document_metadata:linked_document_metadata_id (
        title,
        status
      ),
      projects:project_id (
        name
      )
    `)
    .order("status", { ascending: true })
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "listSopBacklog",
      message: "Failed to load SOP backlog records.",
      details: { reason: error.message },
      cause: error,
    });
  }

  return (data ?? []).map((row) => {
    const linkedDocument = Array.isArray(row.document_metadata)
      ? row.document_metadata[0]
      : row.document_metadata;
    const project = Array.isArray(row.projects) ? row.projects[0] : row.projects;

    return {
      ...row,
      linked_document_title: linkedDocument?.title ?? null,
      linked_document_status: row.linked_document_metadata_id
        ? linkedDocument?.status ?? "linked"
        : "missing",
      project_name: project?.name ?? null,
      age_days: daysSince(row.created_at),
      last_updated_days: daysSince(row.updated_at),
    };
  });
}

export async function createSopBacklogRecord(
  supabase: Supabase,
  input: SopBacklogCreateInput,
  createdBy: string | null,
): Promise<SopBacklogRecord> {
  const payload = normalizeSopCreatePayload(input);
  const { data, error } = await supabase
    .from("sop_backlog")
    .insert({
      ...payload,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "createSopBacklogRecord",
      message: "Failed to create SOP backlog record.",
      details: { reason: error.message },
      cause: error,
    });
  }

  const records = await listSopBacklog(supabase);
  const created = records.find((record) => record.id === data.id);
  if (!created) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "createSopBacklogRecord",
      message: "Created SOP backlog record could not be reloaded.",
      details: { id: data.id },
    });
  }
  return created;
}

export async function updateSopBacklogRecord(
  supabase: Supabase,
  id: string,
  input: SopBacklogUpdateInput,
): Promise<SopBacklogRecord> {
  const payload = normalizeSopUpdatePayload(input);
  const { data, error } = await supabase
    .from("sop_backlog")
    .update(payload)
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "updateSopBacklogRecord",
      message: "Failed to update SOP backlog record.",
      details: { reason: error.message, id },
      cause: error,
    });
  }

  const records = await listSopBacklog(supabase);
  const updated = records.find((record) => record.id === data.id);
  if (!updated) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where: "updateSopBacklogRecord",
      message: "Updated SOP backlog record was not found.",
      details: { id },
      status: 404,
    });
  }
  return updated;
}
