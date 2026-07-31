/**
 * Workspace Artifact Service
 *
 * CRUD + semantic search layer for the `workspace_artifacts` table.
 * Artifacts are work-in-progress documents (owner updates, risk reports,
 * meeting prep, analyses, briefings, notes) co-created between the user
 * and the AI assistant across sessions.
 *
 * Key design decisions:
 *   - Embedding failure is non-fatal: artifacts are saved without vectors
 *     and fall back to recency-ordered list queries instead of semantic search.
 *   - Embedding reuses embed() from ai-memory-service to ensure consistent
 *     model (text-embedding-3-large at 3072 dims) and AI Gateway routing.
 *   - All mutations are user-scoped (user_id filter on every write) as a
 *     belt-and-suspenders guard on top of RLS.
 */

import { embed } from "@/lib/ai/services/ai-memory-service";
import { getOpenAI } from "@/lib/ai/tools/tool-utils";
import { retrieveChunks } from "@/lib/ai/retrieval/retrieve-chunks";
import { createRagServiceClient, createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import type { Database, Json } from "@/types/database.types";
import {
  applyChangeEventWorkflowDraftEdits,
  type ChangeEventWorkflowDraftEdits,
  type ChangeEventWorkflowMetadata,
} from "@/lib/ai/change-event-workflow";

// Write artifact embedding to AI Database document_chunks.
// PM APP holds the record; AI DB holds the searchable vector.
async function _syncArtifactChunkToAiDb(
  artifactId: string,
  embedText: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    const vec = await embed(embedText);
    const ragClient = createRagServiceClient();
    await ragClient.from("document_chunks").upsert(
      {
        chunk_id: `workspace_artifact_${artifactId}`,
        document_id: artifactId,
        chunk_index: 0,
        text: embedText,
        source_type: "workspace_artifact",
        embedding: JSON.stringify(vec),
        metadata: metadata as Json,
      },
      { onConflict: "chunk_id" },
    );
  } catch (e) {
    console.warn("[workspace-artifact-service] Failed to sync chunk to AI DB:", e instanceof Error ? e.message : e);
  }
}

type WorkspaceArtifactInsert =
  Database["public"]["Tables"]["workspace_artifacts"]["Insert"];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ArtifactType =
  | "owner_update"
  | "risk_report"
  | "meeting_prep"
  | "analysis"
  | "briefing"
  | "note"
  | "change_event_draft";

export type ArtifactStatus = "draft" | "final" | "archived" | "promoted";

export type PromoteTarget = "ai_memories" | "progress_report" | "initiative";

export interface WorkspaceArtifact {
  id: string;
  user_id: string;
  project_id: number | null;
  artifact_type: ArtifactType;
  title: string;
  status: ArtifactStatus;
  version: number;
  content: Record<string, unknown>;
  context_snapshot: Record<string, unknown>;
  session_id: string | null;
  promoted_to: PromoteTarget | null;
  promoted_at: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  similarity?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns "just now", "Xm ago", "Xh ago", or "Xd ago" */
export function timeSince(isoString: string): string {
  const diffMs = Math.max(0, Date.now() - new Date(isoString).getTime());
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

/** Extracts a short preview string from artifact content */
export function extractPreview(content: Record<string, unknown>): string {
  const keys = ["summary", "body", "text", "notes", "description"] as const;
  for (const key of keys) {
    const val = content[key];
    if (typeof val === "string" && val.trim().length > 0) {
      return val.substring(0, 120);
    }
  }
  // Fallback: stringify any first string value found
  for (const val of Object.values(content)) {
    if (typeof val === "string" && val.trim().length > 0) {
      return val.substring(0, 120);
    }
  }
  return "";
}


// The SELECT columns used everywhere — omits the large embedding vector.
const SELECT_COLS =
  "id, user_id, project_id, artifact_type, title, status, version, content, context_snapshot, session_id, promoted_to, promoted_at, tags, created_at, updated_at";

// ---------------------------------------------------------------------------
// createArtifact
// ---------------------------------------------------------------------------

export interface CreateArtifactParams {
  userId: string;
  artifactType: ArtifactType;
  title: string;
  content: Record<string, unknown>;
  projectId?: number | null;
  contextSnapshot?: Record<string, unknown>;
  sessionId?: string | null;
  tags?: string[];
  status?: ArtifactStatus;
}

export async function createArtifact(
  params: CreateArtifactParams,
): Promise<{ id: string } | { error: string }> {
  const supabase = createServiceClient();

  // DO NOT write embedding to workspace_artifacts in PM APP.
  // HNSW index on this column causes OOM under concurrent inserts (same pattern
  // as document_metadata.summary_embedding and ai_memories.embedding crashes).
  const row: WorkspaceArtifactInsert = {
    user_id: params.userId,
    artifact_type: params.artifactType,
    title: params.title,
    content: params.content as Json,
    project_id: params.projectId ?? null,
    context_snapshot: (params.contextSnapshot ?? {}) as Json,
    session_id: params.sessionId ?? null,
    tags: params.tags ?? [],
    status: params.status ?? "draft",
  };

  const { data, error } = await serviceDb.from("workspace_artifacts")
    .insert(row)
    .select("id")
    .single();

  if (error) return { error: `Artifact create failed: ${error.message}` };

  const embedText = `${params.artifactType}: ${params.title}\n${JSON.stringify(params.content).substring(0, 4000)}`;
  void _syncArtifactChunkToAiDb(data.id, embedText, {
    user_id: params.userId,
    artifact_type: params.artifactType,
    project_id: params.projectId ?? null,
    status: params.status ?? "draft",
  });

  return { id: data.id };
}

// ---------------------------------------------------------------------------
// updateArtifact
// ---------------------------------------------------------------------------

export interface UpdateArtifactParams {
  title?: string;
  content?: Record<string, unknown>;
  status?: ArtifactStatus;
  contextSnapshot?: Record<string, unknown>;
  projectId?: number | null;
  sessionId?: string | null;
  tags?: string[];
}

export async function updateArtifact(
  id: string,
  userId: string,
  params: UpdateArtifactParams,
): Promise<{ id: string; version: number } | { error: string }> {
  const supabase = createServiceClient();

  // Fetch current record to get current version and type for re-embedding
  const { data: current, error: fetchError } = await serviceDb.from("workspace_artifacts")
    .select("version, artifact_type, title, content, project_id")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (fetchError || !current) {
    return { error: `Artifact fetch failed: ${fetchError?.message ?? "not found"}` };
  }

  if (typeof current.version !== "number") {
    return { error: "Artifact record has unexpected shape — version is not a number" };
  }

  const newVersion = current.version + 1;
  const updates: Record<string, unknown> = { version: newVersion };

  if (params.title !== undefined) updates.title = params.title;
  if (params.content !== undefined) updates.content = params.content;
  if (params.status !== undefined) updates.status = params.status;
  if (params.contextSnapshot !== undefined) updates.context_snapshot = params.contextSnapshot;
  if (params.projectId !== undefined) updates.project_id = params.projectId;
  if (params.sessionId !== undefined) updates.session_id = params.sessionId;
  if (params.tags !== undefined) updates.tags = params.tags;

  const { error: updateError } = await serviceDb.from("workspace_artifacts")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId);

  if (updateError) return { error: `Artifact update failed: ${updateError.message}` };

  // Re-sync embedding to AI DB if content or title changed.
  if (params.content !== undefined || params.title !== undefined) {
    const newTitle = (params.title ?? current.title) as string;
    const newContent = (params.content ?? current.content) as Record<string, unknown>;
    const embedText = `${current.artifact_type}: ${newTitle}\n${JSON.stringify(newContent).substring(0, 4000)}`;
    void _syncArtifactChunkToAiDb(id, embedText, {
      user_id: userId,
      artifact_type: current.artifact_type,
      project_id: params.projectId !== undefined ? params.projectId : current.project_id,
      status: params.status ?? null,
    });
  }

  return { id, version: newVersion };
}

// ---------------------------------------------------------------------------
// getArtifact
// ---------------------------------------------------------------------------

export async function getArtifact(
  id: string,
  userId: string,
): Promise<WorkspaceArtifact | null> {
  const supabase = createServiceClient();

  const { data, error } = await serviceDb.from("workspace_artifacts")
    .select(SELECT_COLS)
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error("[workspace-artifact-service] getArtifact failed:", error.message);
    return null;  // still return null (callers check for null), but log the error
  }
  if (!data) return null;
  return data as unknown as WorkspaceArtifact;
}

// ---------------------------------------------------------------------------
// listArtifacts
// ---------------------------------------------------------------------------

export interface ListArtifactsParams {
  userId: string;
  projectId?: number | null;
  artifactType?: ArtifactType;
  status?: ArtifactStatus;
  sessionId?: string | null;
  limit?: number;
}

export async function listArtifacts(params: ListArtifactsParams): Promise<WorkspaceArtifact[]> {
  const supabase = createServiceClient();

  try {
    let query = serviceDb.from("workspace_artifacts")
      .select(SELECT_COLS)
      .eq("user_id", params.userId)
      .order("updated_at", { ascending: false });

    if (params.projectId !== undefined && params.projectId !== null) {
      query = query.eq("project_id", params.projectId);
    }
    if (params.artifactType !== undefined) {
      query = query.eq("artifact_type", params.artifactType);
    }
    if (params.status !== undefined) {
      query = query.eq("status", params.status);
    }
    if (params.sessionId !== undefined && params.sessionId !== null) {
      query = query.eq("session_id", params.sessionId);
    }
    if (params.limit !== undefined) {
      query = query.limit(params.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[workspace-artifact-service] listArtifacts error:", error.message);
      return [];
    }
    return (data ?? []) as unknown as WorkspaceArtifact[];
  } catch (e) {
    console.error(
      "[workspace-artifact-service] listArtifacts threw:",
      e instanceof Error ? e.message : e,
    );
    return [];
  }
}

export interface UpsertChangeEventDraftArtifactParams {
  userId: string;
  sessionId: string;
  workflow: ChangeEventWorkflowMetadata;
}

function buildChangeEventDraftArtifactPayload(workflow: ChangeEventWorkflowMetadata) {
  const draft = workflow.draft;
  const title = draft.title ?? "Change Event Draft";
  const content = {
    workflow,
    draft,
    readiness: workflow.readiness,
    expectedNativeTool: workflow.expectedNativeTool,
    writeOwner: workflow.writeOwner,
    updatedAt: workflow.updatedAt,
  };
  const contextSnapshot = {
    workflowKey: workflow.workflowKey,
    source: workflow.source,
    projectId: draft.projectId,
    projectName: draft.projectName,
    readyForPreview: draft.readyForPreview,
  };

  return { title, content, contextSnapshot };
}

function readChangeEventWorkflowContent(
  content: Record<string, unknown>,
): ChangeEventWorkflowMetadata | null {
  const workflow = content.workflow;
  if (!workflow || typeof workflow !== "object" || Array.isArray(workflow)) {
    return null;
  }
  return workflow as ChangeEventWorkflowMetadata;
}

export async function upsertChangeEventDraftArtifact(
  params: UpsertChangeEventDraftArtifactParams,
): Promise<{ id: string; version: number; action: "created" | "updated" } | { error: string }> {
  const supabase = createServiceClient();
  const draft = params.workflow.draft;
  const { title, content, contextSnapshot } =
    buildChangeEventDraftArtifactPayload(params.workflow);

  const { data: existing, error: existingError } = await serviceDb.from("workspace_artifacts")
    .select("id")
    .eq("user_id", params.userId)
    .eq("artifact_type", "change_event_draft")
    .eq("session_id", params.sessionId)
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return { error: `Change event draft artifact lookup failed: ${existingError.message}` };
  }

  if (existing?.id) {
    const updateResult = await updateArtifact(existing.id, params.userId, {
      title,
      content,
      contextSnapshot,
      projectId: draft.projectId,
      sessionId: params.sessionId,
      tags: ["change-event", "ai-workflow"],
    });

    if ("error" in updateResult) return updateResult;

    return {
      id: updateResult.id,
      version: updateResult.version,
      action: "updated",
    };
  }

  const createResult = await createArtifact({
    userId: params.userId,
    artifactType: "change_event_draft",
    title,
    content,
    projectId: draft.projectId,
    contextSnapshot,
    sessionId: params.sessionId,
    tags: ["change-event", "ai-workflow"],
    status: "draft",
  });

  if ("error" in createResult) return createResult;

  return { id: createResult.id, version: 1, action: "created" };
}

export async function loadLatestChangeEventDraftArtifact(params: {
  userId: string;
  sessionId: string;
}): Promise<WorkspaceArtifact | null> {
  const artifacts = await listArtifacts({
    userId: params.userId,
    artifactType: "change_event_draft",
    status: "draft",
    sessionId: params.sessionId,
    limit: 1,
  });

  return artifacts[0] ?? null;
}

export async function updateChangeEventDraftArtifactEdits(params: {
  userId: string;
  sessionId: string;
  edits: ChangeEventWorkflowDraftEdits;
}): Promise<
  | {
      id: string;
      version: number;
      workflow: ChangeEventWorkflowMetadata;
    }
  | { error: string }
> {
  const artifact = await loadLatestChangeEventDraftArtifact({
    userId: params.userId,
    sessionId: params.sessionId,
  });

  if (!artifact) {
    return {
      error: "No active Change Event draft artifact exists for this session.",
    };
  }

  const workflow = readChangeEventWorkflowContent(artifact.content);
  if (!workflow) {
    return {
      error:
        "Change Event draft artifact is missing workflow metadata and cannot be edited safely.",
    };
  }

  const updatedWorkflow = applyChangeEventWorkflowDraftEdits({
    workflow,
    edits: params.edits,
  });
  const { title, content, contextSnapshot } =
    buildChangeEventDraftArtifactPayload(updatedWorkflow);
  const result = await updateArtifact(artifact.id, params.userId, {
    title,
    content,
    contextSnapshot,
    projectId: updatedWorkflow.draft.projectId,
    sessionId: params.sessionId,
    tags: ["change-event", "ai-workflow"],
  });

  if ("error" in result) return result;

  return {
    id: result.id,
    version: result.version,
    workflow: updatedWorkflow,
  };
}

// ---------------------------------------------------------------------------
// searchArtifacts
// ---------------------------------------------------------------------------

export interface SearchArtifactsParams {
  userId: string;
  query: string;
  projectId?: number | null;
  status?: ArtifactStatus;
  matchCount?: number;
  matchThreshold?: number;
}

export async function searchArtifacts(params: SearchArtifactsParams): Promise<WorkspaceArtifact[]> {
  const supabase = createServiceClient();

  let embeddingVec: number[];
  try {
    embeddingVec = await embed(params.query);
  } catch (e) {
    console.warn("[workspace-artifact-service] Embed failed — falling back to list:", e instanceof Error ? e.message : e);
    return listArtifacts({ userId: params.userId, projectId: params.projectId ?? undefined, status: params.status, limit: params.matchCount ?? 10 });
  }

  try {
    const chunks = await retrieveChunks({
      query: params.query,
      openai: getOpenAI(),
      ragClient: createRagServiceClient(),
      projectId: params.projectId ?? undefined,
      sourceTypes: ["workspace_artifact"],
      matchCount: params.matchCount ?? 10,
      matchThreshold: params.matchThreshold ?? 0.45,
      errorLabel: "Workspace artifact search",
    });

    if (!chunks || chunks.length === 0) return [];

    const artifactIds = (chunks as Array<{ document_id: string; similarity: number }>).map((c) => c.document_id);
    const similarityMap = new Map(
      (chunks as Array<{ document_id: string; similarity: number }>).map((c) => [c.document_id, c.similarity]),
    );

    let q = serviceDb.from("workspace_artifacts")
      .select(SELECT_COLS)
      .in("id", artifactIds)
      .eq("user_id", params.userId);
    if (params.status) q = q.eq("status", params.status);

    const { data: artifacts, error: artError } = await q;
    if (artError) throw new Error(artError.message);

    return ((artifacts ?? []) as WorkspaceArtifact[])
      .map((a) => ({ ...a, similarity: similarityMap.get(a.id) ?? 0 }))
      .sort((a, b) => ((b as WorkspaceArtifact & { similarity: number }).similarity) - ((a as WorkspaceArtifact & { similarity: number }).similarity));
  } catch (e) {
    console.error("[workspace-artifact-service] searchArtifacts failed — falling back to list:", e instanceof Error ? e.message : e);
    return listArtifacts({ userId: params.userId, projectId: params.projectId ?? undefined, status: params.status, limit: params.matchCount ?? 10 });
  }
}

// ---------------------------------------------------------------------------
// promoteArtifact
// ---------------------------------------------------------------------------

export async function promoteArtifact(
  id: string,
  userId: string,
  target: PromoteTarget,
): Promise<{ ok: true } | { error: string }> {
  const supabase = createServiceClient();

  const { error } = await serviceDb.from("workspace_artifacts")
    .update({
      status: "promoted",
      promoted_to: target,
      promoted_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { error: `Artifact promote failed: ${error.message}` };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// archiveArtifact
// ---------------------------------------------------------------------------

export async function archiveArtifact(
  id: string,
  userId: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = createServiceClient();

  const { error } = await serviceDb.from("workspace_artifacts")
    .update({ status: "archived" })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { error: `Artifact archive failed: ${error.message}` };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// buildWorkspaceContextBlock
// ---------------------------------------------------------------------------

/**
 * Builds a Markdown block listing active (draft|final) workspace artifacts
 * for injection into the AI system prompt. Returns empty string if none.
 */
export function buildWorkspaceContextBlock(artifacts: WorkspaceArtifact[]): string {
  const active = artifacts.filter(
    (a) => a.status === "draft" || a.status === "final",
  );

  if (active.length === 0) return "";

  const lines: string[] = [
    "## Active Workspace Drafts",
    "",
    `The user has ${active.length} work-in-progress artifact(s):`,
    "",
  ];

  const MAX_CHARS = 2_400;
  let remaining = MAX_CHARS;
  for (const a of active) {
    if (remaining <= 0) break;
    const preview = extractPreview(a.content);
    const entry =
      `- **${a.title}** (${a.artifact_type}, ${a.status}, v${a.version}, last edited ${timeSince(a.updated_at)})\n` +
      `  ID: \`${a.id}\`\n` +
      (preview ? `  Preview: ${preview}\n` : "");
    lines.push(entry);
    remaining -= entry.length;
  }

  lines.push(
    "Use `getDraftArtifact` to load the full content of any of these before working on it. Use `saveWorkspaceArtifact` to update drafts as you build them together.",
  );

  return lines.join("\n");
}
