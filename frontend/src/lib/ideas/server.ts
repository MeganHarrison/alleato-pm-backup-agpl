import "server-only";

import { z } from "zod";

import { serviceDb } from "@/lib/supabase/service-db";
import type { Json, TablesInsert, TablesUpdate } from "@/types/database.types";
import {
  IDEA_PRIORITIES,
  IDEA_ROUTE_TYPES,
  IDEA_SOURCES,
  IDEA_STATUSES,
  type CreateIdeaInput,
  type IdeaItem,
  type UpdateIdeaInput,
} from "./types";

const metadataSchema = z.record(z.string(), z.unknown()).optional();

export const createIdeaSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  body: z.string().trim().min(1).max(5000),
  projectId: z.number().int().positive().nullable().optional(),
  status: z.enum(IDEA_STATUSES).optional(),
  priority: z.enum(IDEA_PRIORITIES).optional(),
  routeType: z.enum(IDEA_ROUTE_TYPES).optional(),
  routeTarget: z.string().trim().max(240).nullable().optional(),
  aiSummary: z.string().trim().max(1000).nullable().optional(),
  aiNextAction: z.string().trim().max(1000).nullable().optional(),
  linkedLinearIssueId: z.string().trim().max(80).nullable().optional(),
  linkedLinearIssueUrl: z.string().url().nullable().optional(),
  source: z.enum(IDEA_SOURCES).optional(),
  sourceContext: z.string().trim().max(4000).nullable().optional(),
  sourceUrl: z.string().url().nullable().optional(),
  metadata: metadataSchema,
});

export const updateIdeaSchema = createIdeaSchema.partial().extend({
  body: z.string().trim().min(1).max(5000).optional(),
});

function titleFromBody(body: string): string {
  const normalized = body.trim().replace(/\s+/g, " ");
  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
}

function toJson(value: Record<string, unknown> | undefined): Json {
  return (value ?? {}) as Json;
}

function normalizeCreateInput(input: CreateIdeaInput, userId: string | null): TablesInsert<"idea_items"> {
  return {
    created_by: userId,
    project_id: input.projectId ?? null,
    title: input.title?.trim() || titleFromBody(input.body),
    body: input.body.trim(),
    status: input.status ?? "captured",
    priority: input.priority ?? "medium",
    route_type: input.routeType ?? "unrouted",
    route_target: input.routeTarget?.trim() || null,
    ai_summary: input.aiSummary?.trim() || null,
    ai_next_action: input.aiNextAction?.trim() || null,
    linked_linear_issue_id: input.linkedLinearIssueId?.trim() || null,
    linked_linear_issue_url: input.linkedLinearIssueUrl?.trim() || null,
    source: input.source ?? "manual",
    source_context: input.sourceContext?.trim() || null,
    source_url: input.sourceUrl?.trim() || null,
    metadata: toJson(input.metadata),
  };
}

function normalizeUpdateInput(input: UpdateIdeaInput): TablesUpdate<"idea_items"> {
  const update = {
    project_id: input.projectId,
    title: input.title?.trim(),
    body: input.body?.trim(),
    status: input.status,
    priority: input.priority,
    route_type: input.routeType,
    route_target: input.routeTarget === undefined ? undefined : input.routeTarget?.trim() || null,
    ai_summary: input.aiSummary === undefined ? undefined : input.aiSummary?.trim() || null,
    ai_next_action: input.aiNextAction === undefined ? undefined : input.aiNextAction?.trim() || null,
    linked_linear_issue_id:
      input.linkedLinearIssueId === undefined ? undefined : input.linkedLinearIssueId?.trim() || null,
    linked_linear_issue_url:
      input.linkedLinearIssueUrl === undefined ? undefined : input.linkedLinearIssueUrl?.trim() || null,
    source: input.source,
    source_context: input.sourceContext === undefined ? undefined : input.sourceContext?.trim() || null,
    source_url: input.sourceUrl === undefined ? undefined : input.sourceUrl?.trim() || null,
    metadata: input.metadata === undefined ? undefined : toJson(input.metadata),
  };

  Object.keys(update).forEach((key) => {
    if (update[key as keyof typeof update] === undefined) {
      delete update[key as keyof typeof update];
    }
  });

  return update;
}

export async function listIdeas(limit = 200): Promise<IdeaItem[]> {
  const { data, error } = await serviceDb
    .from("idea_items")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list ideas: ${error.message}`);
  }

  return (data ?? []) as IdeaItem[];
}

export async function createIdea(input: CreateIdeaInput, userId: string | null): Promise<IdeaItem> {
  const payload = normalizeCreateInput(input, userId);
  const { data, error } = await serviceDb
    .from("idea_items")
    .insert(payload)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to capture idea: ${error?.message ?? "no row returned"}`);
  }

  return data as IdeaItem;
}

export async function updateIdea(
  ideaId: string,
  input: UpdateIdeaInput,
): Promise<IdeaItem> {
  const update = normalizeUpdateInput(input);
  if (Object.keys(update).length === 0) {
    throw new Error("No idea fields were provided to update.");
  }

  const { data, error } = await serviceDb
    .from("idea_items")
    .update(update)
    .eq("id", ideaId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to update idea: ${error?.message ?? "no row returned"}`);
  }

  return data as IdeaItem;
}
