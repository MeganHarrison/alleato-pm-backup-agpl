/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { serviceDb } from "@/lib/supabase/service-db";
import type { Database, Json } from "@/types/database.types";
import type { PlaneDraftArtifact } from "./plane-drafts-model";

const SELECT_COLUMNS =
  "id, user_id, project_id, artifact_type, title, status, version, content, context_snapshot, session_id, promoted_to, promoted_at, tags, created_at, updated_at";

export class PlaneDraftsRepositoryError extends Error {
  constructor(
    readonly kind: "database" | "not_found" | "conflict",
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "PlaneDraftsRepositoryError";
  }
}

function asDraft(row: unknown): PlaneDraftArtifact {
  return row as PlaneDraftArtifact;
}

export async function listPlaneDrafts(projectId: number, userId: string) {
  const { data, error } = await serviceDb
    .from("workspace_artifacts")
    .select(SELECT_COLUMNS)
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(100);

  if (error) {
    throw new PlaneDraftsRepositoryError("database", "Draft storage is unavailable.", error.code);
  }
  return (data ?? []).map(asDraft);
}

export async function getPlaneDraft(projectId: number, userId: string, id: string) {
  const { data, error } = await serviceDb
    .from("workspace_artifacts")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("status", "draft")
    .maybeSingle();

  if (error) {
    throw new PlaneDraftsRepositoryError("database", "Draft storage is unavailable.", error.code);
  }
  if (!data) {
    throw new PlaneDraftsRepositoryError("not_found", "The draft was not found in this project.");
  }
  return asDraft(data);
}

export async function insertPlaneDraft(input: {
  projectId: number;
  userId: string;
  title: string;
  content: Record<string, unknown>;
  artifactType?: PlaneDraftArtifact["artifact_type"];
  contextSnapshot?: Record<string, unknown>;
  tags?: string[];
}) {
  const { data, error } = await serviceDb
    .from("workspace_artifacts")
    .insert({
      project_id: input.projectId,
      user_id: input.userId,
      title: input.title,
      content: input.content as Json,
      artifact_type: input.artifactType ?? "note",
      context_snapshot: (input.contextSnapshot ?? {}) as Json,
      tags: input.tags ?? [],
      status: "draft",
    })
    .select(SELECT_COLUMNS)
    .single();

  if (error || !data) {
    throw new PlaneDraftsRepositoryError("database", "The draft could not be created.", error?.code);
  }
  return asDraft(data);
}

export async function updatePlaneDraft(input: {
  projectId: number;
  userId: string;
  id: string;
  expectedVersion: number;
  updates: {
    title?: string;
    content?: Record<string, unknown>;
    status?: "final" | "archived";
  };
}) {
  const updates: Database["public"]["Tables"]["workspace_artifacts"]["Update"] = {
    ...input.updates,
    ...(input.updates.content ? { content: input.updates.content as Json } : {}),
    version: input.expectedVersion + 1,
  };
  const { data, error } = await serviceDb
    .from("workspace_artifacts")
    .update(updates)
    .eq("id", input.id)
    .eq("project_id", input.projectId)
    .eq("user_id", input.userId)
    .eq("status", "draft")
    .eq("version", input.expectedVersion)
    .select(SELECT_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new PlaneDraftsRepositoryError("database", "The draft could not be updated.", error?.code);
  }
  if (!data) {
    throw new PlaneDraftsRepositoryError(
      "conflict",
      "This draft changed after you opened it. Reload the latest version and try again.",
    );
  }
  return asDraft(data);
}

export async function deletePlaneDraft(projectId: number, userId: string, id: string) {
  await getPlaneDraft(projectId, userId, id);
  const { error } = await serviceDb
    .from("workspace_artifacts")
    .delete()
    .eq("id", id)
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("status", "draft");
  if (error) {
    throw new PlaneDraftsRepositoryError("database", "The draft could not be deleted.", error.code);
  }
}
