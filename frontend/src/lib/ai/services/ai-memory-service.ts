/**
 * AI Memory Service
 *
 * Core read/write layer for the `ai_memories` table.
 *
 * Improvements over v1:
 *   - Deduplication: before insert, search for a near-duplicate (similarity > 0.88)
 *     and update it instead of creating a second copy.
 *   - Commitment bridge: commitment memories auto-create an ai_insights action item.
 *   - Team visibility: writeMemory accepts visibility param; team memories are
 *     injected for all users.
 *   - Token-capped injection: buildMemoryContextBlock caps at ~600 tokens,
 *     ranked by importance × recency.
 */

import OpenAI from "openai";
import {
  createServiceClient,
  createRagServiceClient,
} from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import type { Json } from "@/types/database.types";
import {
  getOpenAICompatibleClientConfig,
  getOpenAIModelId,
} from "@/lib/ai/provider-config";
import { resolveTargetIdsForProjects } from "@/lib/ai/insight-cards";
import {
  recordAiNotificationDecision,
  type AiNotificationDecisionLedgerResult,
} from "@/lib/ai/notification-decision-ledger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MemoryType =
  "fact" | "preference" | "lesson" | "commitment" | "context";
export type MemorySource =
  "conversation" | "extraction" | "meeting_ingest" | "manual";
export type MemoryVisibility = "private" | "team";

export interface AiMemory {
  id: string;
  type: MemoryType;
  content: string;
  confidence: number;
  importance: number;
  project_id: number | null;
  meeting_id: string | null;
  source: MemorySource;
  visibility?: MemoryVisibility;
  created_at: string;
  last_accessed_at?: string | null;
  access_count?: number | null;
  expires_at?: string | null;
  similarity?: number;
  ranking_score?: number;
  ranking_reason?: string;
}

const AI_MEMORY_CHUNKS_TABLE = "document_chunks";
const MEMORY_RECALL_LOOKBACK_DAYS = 183;
const MEMORY_RECALL_LOOKBACK_MS = MEMORY_RECALL_LOOKBACK_DAYS * 86_400_000;

function memoryMetadataString(
  metadata: Record<string, unknown>,
  key: string,
): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function memoryMetadataNumber(
  metadata: Record<string, unknown>,
  key: string,
): number | null {
  const value = metadata[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function memoryReferencePath(memoryId: string): string {
  return `/settings/memory?memoryId=${encodeURIComponent(memoryId)}`;
}

function memoryTitle(metadata: Record<string, unknown>): string {
  const type = memoryMetadataString(metadata, "type");
  return type ? `AI memory: ${type}` : "AI memory";
}

// ---------------------------------------------------------------------------
// Lazy OpenAI client
// ---------------------------------------------------------------------------

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const config = getOpenAICompatibleClientConfig("AI memory embeddings");
    _openai = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
  }
  return _openai;
}

export async function embed(text: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model: getOpenAIModelId("text-embedding-3-large"),
    dimensions: 3072,
    input: text.substring(0, 8000),
  });
  return response.data[0].embedding;
}

// Write a memory's embedding to AI Database document_chunks (fqcvmfqldlewvbsuxdvz).
// PM APP holds the text record; AI DB holds the searchable vector.
async function syncMemoryChunkToAiDb(
  memoryId: string,
  content: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const vec = await embed(content);
  const ragClient = createRagServiceClient();
  const projectId = memoryMetadataNumber(metadata, "project_id");
  const source = memoryMetadataString(metadata, "source") ?? "ai_memory";
  const meetingId = memoryMetadataString(metadata, "meeting_id");
  const referencePath = memoryReferencePath(memoryId);

  const { error: metadataError } = await ragClient
    .from("rag_document_metadata")
    .upsert(
      {
        id: memoryId,
        app_document_id: memoryId,
        project_id: projectId,
        source: "ai_memory",
        source_system: "ai_memory",
        source_item_id: memoryId,
        title: memoryTitle(metadata),
        type: "ai_memory",
        category: "AI Memory",
        source_web_url: referencePath,
        url: referencePath,
        content,
        content_length: content.length,
        parsing_status: "complete",
        embedding_status: "embedded",
        processing_metadata: {
          memory_id: memoryId,
          source,
          meeting_id: meetingId,
        } as Json,
        source_metadata: metadata as Json,
        last_content_loaded_at: new Date().toISOString(),
        last_indexed_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  if (metadataError) {
    throw new Error(`Memory metadata sync failed: ${metadataError.message}`);
  }

  const { error } = await ragClient.from(AI_MEMORY_CHUNKS_TABLE).upsert(
    {
      chunk_id: `ai_memory_${memoryId}`,
      document_id: memoryId,
      chunk_index: 0,
      text: content,
      source_type: "ai_memory",
      embedding: JSON.stringify(vec),
      metadata: metadata as Json,
    },
    { onConflict: "chunk_id" },
  );
  if (error) {
    throw new Error(`Memory vector sync failed: ${error.message}`);
  }
}

async function deleteMemoryChunkFromAiDb(memoryId: string): Promise<void> {
  const ragClient = createRagServiceClient();
  const { error } = await ragClient
    .from(AI_MEMORY_CHUNKS_TABLE)
    .delete()
    .eq("chunk_id", `ai_memory_${memoryId}`);
  if (error) {
    throw new Error(`Memory vector delete failed: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Write (with deduplication)
// ---------------------------------------------------------------------------

export interface WriteMemoryParams {
  userId: string;
  type: MemoryType;
  content: string;
  projectId?: number | null;
  meetingId?: string | null;
  confidence?: number;
  importance?: number;
  source?: MemorySource;
  visibility?: MemoryVisibility;
  expiresAt?: Date | null;
}

export type WriteMemoryResult =
  | {
      id: string;
      action: "created" | "updated";
      notificationDecision?: AiNotificationDecisionLedgerResult;
    }
  | { error: string };

async function recordMemoryNotificationDecision({
  memoryId,
  action,
  params,
  projectId,
}: {
  memoryId: string;
  action: "created" | "updated";
  params: WriteMemoryParams;
  projectId: number | null;
}): Promise<AiNotificationDecisionLedgerResult> {
  return recordAiNotificationDecision({
    recipientUserId: params.userId,
    eventType: "ai_memory_updated",
    severity: "low",
    projectId,
    entityType: "ai_memories",
    entityId: memoryId,
    eventKey: `ai_memory:${memoryId}:${action}`,
    title: action === "created" ? "AI memory saved" : "AI memory updated",
    body: params.content,
  });
}

/**
 * Write a memory. Before inserting, checks for a near-duplicate (>0.88 similarity
 * of the same type) and updates it instead. Commitment memories automatically
 * create a corresponding ai_insights action item.
 *
 * Returns: { id, action: "created" | "updated" } or { error }
 */
export async function writeMemory(
  params: WriteMemoryParams,
): Promise<WriteMemoryResult> {
  const supabase = createServiceClient();

  try {
    // DO NOT write embedding to ai_memories in PM APP.
    // The HNSW index on ai_memories.embedding (m=32, ef_construction=200) causes
    // OOM crash loops under concurrent inserts. Embeddings for memory search belong
    // in the AI Database (fqcvmfqldlewvbsuxdvz) via document_chunks.
    //
    // Deduplication falls back to exact content match (no vector RPC).
    const { data: dupRows, error: duplicateError } = await serviceDb.from("ai_memories")
      .select("id, importance")
      .eq("user_id", params.userId)
      .eq("type", params.type)
      .eq("content", params.content.trim())
      .limit(1);

    if (duplicateError) {
      return {
        error: `Duplicate memory check failed: ${duplicateError.message}`,
      };
    }

    if (dupRows && dupRows.length > 0) {
      const dup = dupRows[0] as { id: string; importance: number };
      const { error: updateError } = await serviceDb.from("ai_memories")
        .update({
          content: params.content,
          confidence: params.confidence ?? 0.9,
          importance: Math.max(dup.importance, params.importance ?? 0.5),
          last_accessed_at: new Date().toISOString(),
        })
        .eq("id", dup.id);

      if (updateError) return { error: updateError.message };
      await syncMemoryChunkToAiDb(dup.id, params.content, {
        user_id: params.userId,
        type: params.type,
        project_id: params.projectId ?? null,
        meeting_id: params.meetingId ?? null,
        source: params.source ?? "conversation",
        visibility: params.visibility ?? "private",
      });
      const notificationDecision = await recordMemoryNotificationDecision({
        memoryId: dup.id,
        action: "updated",
        params,
        projectId: params.projectId ?? null,
      });
      return { id: dup.id, action: "updated", notificationDecision };
    }

    // --- Fresh insert ---
    let expiresAt = params.expiresAt;
    if (expiresAt === undefined && params.type === "context") {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      expiresAt = d;
    }

    // Guard: verify project_id exists before inserting to prevent FK violations.
    // If the AI passed a project ID that doesn't exist, save the memory without
    // a project link rather than failing the entire write.
    let safeProjectId: number | null = params.projectId ?? null;
    if (safeProjectId !== null) {
      const { data: projectRow } = await serviceDb.from("projects")
        .select("id")
        .eq("id", safeProjectId)
        .maybeSingle();
      if (!projectRow) {
        console.warn(
          `[ai-memory-service] project_id ${safeProjectId} not found — saving memory without project link`,
        );
        safeProjectId = null;
      }
    }

    const { data, error } = await serviceDb.from("ai_memories")
      .insert({
        user_id: params.userId,
        type: params.type,
        content: params.content,
        project_id: safeProjectId,
        meeting_id: params.meetingId ?? null,
        confidence: params.confidence ?? 0.9,
        importance: params.importance ?? 0.5,
        source: params.source ?? "conversation",
        visibility: params.visibility ?? "private",
        expires_at: expiresAt?.toISOString() ?? null,
      })
      .select("id")
      .single();

    if (error) return { error: `Memory save failed: ${error.message}` };
    const memoryId = data.id;

    // Sync embedding to AI Database so the memory is searchable immediately.
    try {
      await syncMemoryChunkToAiDb(memoryId, params.content, {
        user_id: params.userId,
        type: params.type,
        project_id: safeProjectId,
        meeting_id: params.meetingId ?? null,
        source: params.source ?? "conversation",
        visibility: params.visibility ?? "private",
      });
    } catch (syncError) {
      await serviceDb.from("ai_memories")
        .update({ is_active: false })
        .eq("id", memoryId);
      return {
        error:
          syncError instanceof Error
            ? syncError.message
            : "Memory vector sync failed",
      };
    }

    // --- Commitment bridge ---
    // Commitment memories automatically surface as action items in ai_insights
    if (params.type === "commitment" && params.projectId) {
      await bridgeCommitmentToInsight({
        content: params.content,
        projectId: params.projectId,
        meetingId: params.meetingId ?? undefined,
        memoryId,
      });
    }

    const notificationDecision = await recordMemoryNotificationDecision({
      memoryId,
      action: "created",
      params,
      projectId: safeProjectId,
    });

    return { id: memoryId, action: "created", notificationDecision };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ---------------------------------------------------------------------------
// Commitment → insight_cards bridge (Pipeline B)
// ---------------------------------------------------------------------------

async function bridgeCommitmentToInsight(params: {
  content: string;
  projectId: number;
  meetingId?: string;
  memoryId: string;
}): Promise<void> {
  const supabase = createServiceClient();

  // Resolve project_id → intelligence_targets.id. Without an active target we
  // cannot write a card; skip silently rather than failing the memory write.
  const targetMap = await resolveTargetIdsForProjects(supabase, [
    params.projectId,
  ]);
  const targetId = targetMap.get(params.projectId);
  if (!targetId) {
    return;
  }

  const titleStub = params.content.substring(0, 80);

  // Avoid duplicate action items: check if a task card already exists with
  // similar title text for this target.
  const { data: existing, error: existingError } = await serviceDb.from("insight_cards")
    .select("id")
    .eq("primary_target_id", targetId)
    .eq("card_type", "task")
    .ilike("title", `${titleStub}%`)
    .limit(1);

  if (existingError) {
    throw new Error(
      `Failed to check commitment insight duplicate: ${existingError.message}`,
    );
  }

  if (existing && existing.length > 0) return;

  const nowIso = new Date().toISOString();

  const { error: insertError } = await serviceDb.from("insight_cards").insert({
    primary_target_id: targetId,
    card_type: "task",
    title: params.content.substring(0, 255),
    summary:
      `Commitment captured by AI assistant: ${params.content}\n\n` +
      `Source: memory ID ${params.memoryId}`,
    confidence: "medium",
    current_status: "open",
    attribution_status: "auto_assigned",
    first_seen_at: nowIso,
    last_seen_at: nowIso,
    source_count: 1,
    compiler_version: "ai_memory_commitment_bridge_v1",
    metadata: {
      memory_id: params.memoryId,
      meeting_id: params.meetingId ?? null,
      legacy_insight_type: "action_item",
    },
  });

  if (insertError) {
    throw new Error(
      `Failed to create commitment insight from memory: ${insertError.message}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Read: semantic search (user-scoped)
// ---------------------------------------------------------------------------

export async function searchMemories(params: {
  userId: string;
  query: string;
  type?: MemoryType;
  projectId?: number;
  matchCount?: number;
  matchThreshold?: number;
}): Promise<AiMemory[]> {
  const supabase = createServiceClient();

  try {
    const chunks = await searchMemoryChunks({
      query: params.query,
      projectId: params.projectId,
      matchCount: params.matchCount ?? 8,
      matchThreshold: params.matchThreshold ?? 0.45,
      failureLabel: "AI memory search",
    });
    if (!chunks || chunks.length === 0) return [];

    // Hydrate full memory records from PM APP using document_id = memory.id
    const memoryIds = (
      chunks as Array<{ document_id: string; similarity: number }>
    ).map((c) => c.document_id);
    const similarityMap = new Map(
      (chunks as Array<{ document_id: string; similarity: number }>).map(
        (c) => [c.document_id, c.similarity],
      ),
    );

    const recallCutoff = new Date(
      Date.now() - MEMORY_RECALL_LOOKBACK_MS,
    ).toISOString();
    let q = serviceDb.from("ai_memories")
      .select(
        "id, type, content, confidence, importance, project_id, meeting_id, source, visibility, created_at",
      )
      .in("id", memoryIds)
      .eq("is_active", true)
      .gte("created_at", recallCutoff)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .or(`user_id.eq.${params.userId},visibility.eq.team`);
    if (params.type) q = q.eq("type", params.type);
    if (params.projectId !== undefined) {
      q = q.or(`project_id.is.null,project_id.eq.${params.projectId}`);
    }

    const { data: memories, error: memError } = await q;
    if (memError)
      throw new Error(`Memory hydration failed: ${memError.message}`);
    if (!memories) return [];

    const results = rankMemoriesForRecall(
      memories.map((m) => ({
        ...m,
        similarity: similarityMap.get(m.id) ?? 0,
      })) as AiMemory[],
      { projectId: params.projectId },
    );

    if (results.length > 0) {
      void supabase
        .rpc("touch_ai_memories", { memory_ids: results.map((m) => m.id) })
        .then(({ error: touchError }) => {
          if (touchError)
            console.error("[ai-memory-service] touch failed:", touchError);
        });
    }

    return results;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown memory search error";
    throw new Error(message);
  }
}

// ---------------------------------------------------------------------------
// Read: team-visible memories
// ---------------------------------------------------------------------------

async function searchTeamMemories(params: {
  query: string;
  projectId?: number;
  matchCount?: number;
}): Promise<AiMemory[]> {
  const supabase = createServiceClient();

  try {
    const chunks = await searchMemoryChunks({
      query: params.query,
      projectId: params.projectId,
      matchCount: params.matchCount ?? 4,
      matchThreshold: 0.5,
      failureLabel: "Team memory search",
    });
    if (!chunks || chunks.length === 0) return [];

    const memoryIds = chunks.map((chunk) => chunk.document_id);
    const similarityMap = new Map(
      chunks.map((chunk) => [chunk.document_id, chunk.similarity]),
    );

    const recallCutoff = new Date(
      Date.now() - MEMORY_RECALL_LOOKBACK_MS,
    ).toISOString();
    let query = serviceDb.from("ai_memories")
      .select(
        "id, type, content, confidence, importance, project_id, meeting_id, source, visibility, created_at",
      )
      .in("id", memoryIds)
      .eq("visibility", "team")
      .eq("is_active", true)
      .gte("created_at", recallCutoff)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
    if (params.projectId !== undefined) {
      query = query.or(`project_id.is.null,project_id.eq.${params.projectId}`);
    }
    const { data, error } = await query;
    if (error) {
      throw new Error(`Team memory search failed: ${error.message}`);
    }
    if (!data) return [];
    return rankMemoriesForRecall(
      data.map((m) => ({
        ...m,
        similarity: similarityMap.get(m.id) ?? 0,
      })) as AiMemory[],
      { projectId: params.projectId },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown team memory search error";
    throw new Error(message);
  }
}

async function searchMemoryChunks(params: {
  query: string;
  projectId?: number;
  matchCount: number;
  matchThreshold: number;
  failureLabel: string;
}): Promise<Array<{ document_id: string; similarity: number }>> {
  const embeddingVec = await embed(params.query);
  const ragClient = createRagServiceClient();

  const { data, error } = await ragClient.rpc("search_document_chunks", {
    query_embedding: JSON.stringify(embeddingVec),
    filter_source_types: ["ai_memory"],
    filter_project_id: params.projectId ?? undefined,
    match_count: params.matchCount,
    match_threshold: params.matchThreshold,
  });

  if (error) {
    throw new Error(`${params.failureLabel} failed: ${error.message}`);
  }
  return (data ?? []) as Array<{ document_id: string; similarity: number }>;
}

// ---------------------------------------------------------------------------
// Read: preferences (always inject — no semantic search needed)
// ---------------------------------------------------------------------------

export async function getUserPreferences(userId: string): Promise<AiMemory[]> {
  const supabase = createServiceClient();

  const { data, error } = await serviceDb.from("ai_memories")
    .select(
      "id, type, content, confidence, importance, project_id, meeting_id, source, visibility, created_at",
    )
    .eq("user_id", userId)
    .eq("type", "preference")
    .eq("is_active", true)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("importance", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`User preference memory lookup failed: ${error.message}`);
  }
  if (!data) return [];
  return data as AiMemory[];
}

// ---------------------------------------------------------------------------
// Read: CRUD for admin UI
// ---------------------------------------------------------------------------

export async function getUserMemories(
  userId: string,
  opts?: { type?: MemoryType; limit?: number; offset?: number },
): Promise<{ memories: AiMemory[]; total: number }> {
  const supabase = createServiceClient();

  let query = serviceDb.from("ai_memories")
    .select(
      "id, type, content, confidence, importance, project_id, meeting_id, source, visibility, created_at, last_accessed_at, access_count, expires_at",
      { count: "exact" },
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (opts?.type) query = query.eq("type", opts.type);

  const { data, count, error } = await query.range(
    opts?.offset ?? 0,
    (opts?.offset ?? 0) + (opts?.limit ?? 50) - 1,
  );

  if (error || !data) return { memories: [], total: 0 };
  return { memories: data as unknown as AiMemory[], total: count ?? 0 };
}

export async function deleteMemory(
  userId: string,
  memoryId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient();

  const { error } = await serviceDb.from("ai_memories")
    .update({ is_active: false })
    .eq("id", memoryId)
    .eq("user_id", userId); // RLS belt-and-suspenders

  if (error) return { success: false, error: error.message };
  try {
    await deleteMemoryChunkFromAiDb(memoryId);
  } catch (chunkError) {
    return {
      success: false,
      error:
        chunkError instanceof Error
          ? chunkError.message
          : "Memory vector delete failed",
    };
  }
  return { success: true };
}

export async function updateMemoryContent(
  userId: string,
  memoryId: string,
  content?: string,
  importance?: number,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient();
  const trimmedContent = content?.trim();
  if (!trimmedContent && importance === undefined) {
    return { success: false, error: "content or importance is required" };
  }

  const { data, error } = await serviceDb.from("ai_memories")
    .update({
      ...(trimmedContent ? { content: trimmedContent } : {}),
      ...(importance !== undefined ? { importance } : {}),
    })
    .eq("id", memoryId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .select("id, type, content, project_id, meeting_id, visibility")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "Memory not found or inactive" };
  if (trimmedContent) {
    try {
      await syncMemoryChunkToAiDb(data.id, data.content, {
        user_id: userId,
        type: data.type,
        project_id: data.project_id,
        meeting_id: data.meeting_id,
        source: "manual",
        visibility: data.visibility ?? "private",
      });
    } catch (chunkError) {
      return {
        success: false,
        error:
          chunkError instanceof Error
            ? chunkError.message
            : "Memory vector sync failed",
      };
    }
  }
  return { success: true };
}

// ---------------------------------------------------------------------------
// Inject: token-capped context block for system prompt
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<MemoryType, string> = {
  preference: "Your Preferences",
  context: "Recent Context",
  commitment: "Open Commitments",
  fact: "Key Facts",
  lesson: "Patterns & Lessons",
};

const INJECTION_ORDER: MemoryType[] = [
  "preference",
  "context",
  "commitment",
  "fact",
  "lesson",
];

const MAX_INJECT_TOKENS = 600; // ~2,400 chars

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function recencyFactor(createdAt: string): number {
  const ageDays = (Date.now() - new Date(createdAt).getTime()) / 86_400_000;
  return 1 / (ageDays / 7 + 1); // 0-day = 1.0, 7-day = 0.5, 30-day = 0.18
}

function freshnessScore(createdAt: string): number {
  const ageMs = Math.max(0, Date.now() - new Date(createdAt).getTime());
  return Math.max(0, 1 - ageMs / MEMORY_RECALL_LOOKBACK_MS);
}

export function scoreMemoryForRecall(
  memory: AiMemory,
  options: { projectId?: number } = {},
): { score: number; reason: string } {
  const freshness = freshnessScore(memory.created_at);
  const projectMatch =
    options.projectId !== undefined && memory.project_id === options.projectId
      ? 1
      : 0;
  const globalProjectContext = memory.project_id === null ? 0.25 : 0;
  const similarity = memory.similarity ?? 0;
  const importance = memory.importance ?? 0;
  const score =
    freshness * 10 +
    projectMatch * 2 +
    globalProjectContext +
    similarity +
    importance * 0.5;
  return {
    score,
    reason: [
      `freshness=${freshness.toFixed(2)}`,
      projectMatch
        ? "project=selected"
        : memory.project_id === null
          ? "project=global"
          : "project=other",
      `similarity=${similarity.toFixed(2)}`,
      `importance=${importance.toFixed(2)}`,
    ].join("; "),
  };
}

export function rankMemoriesForRecall(
  memories: AiMemory[],
  options: { projectId?: number } = {},
): AiMemory[] {
  return memories
    .map((memory) => {
      const ranking = scoreMemoryForRecall(memory, options);
      return {
        ...memory,
        ranking_score: ranking.score,
        ranking_reason: ranking.reason,
      };
    })
    .sort((a, b) => (b.ranking_score ?? 0) - (a.ranking_score ?? 0));
}

/**
 * Build the memory context block to prepend to the system prompt.
 * - Caps at MAX_INJECT_TOKENS to avoid context bloat
 * - Ranks by importance × recency
 * - Preferences are always first; never truncated
 */
export function buildMemoryContextBlock(
  preferences: AiMemory[],
  relevantMemories: AiMemory[],
  teamMemories: AiMemory[] = [],
): string | null {
  const payload = buildMemoryContextPayload(
    preferences,
    relevantMemories,
    teamMemories,
  );
  return payload.block;
}

export function buildMemoryContextPayload(
  preferences: AiMemory[],
  relevantMemories: AiMemory[],
  teamMemories: AiMemory[] = [],
  options: { projectId?: number } = {},
): { block: string | null; selected: AiMemory[] } {
  // Deduplicate by id
  const seen = new Set<string>();
  const all: AiMemory[] = [];
  for (const m of [...preferences, ...relevantMemories, ...teamMemories]) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      all.push(m);
    }
  }

  if (all.length === 0) return { block: null, selected: [] };

  const prefs = all
    .filter((m) => m.type === "preference")
    .sort(
      (a, b) =>
        b.importance * recencyFactor(b.created_at) -
        a.importance * recencyFactor(a.created_at),
    );
  const others = rankMemoriesForRecall(
    all.filter((m) => m.type !== "preference"),
    options,
  );

  // Token-cap: always include all preferences, then fill others until budget
  const selected: AiMemory[] = [...prefs];
  let tokens = estimateTokens(prefs.map((m) => m.content).join("\n"));
  for (const m of others) {
    const t = estimateTokens(m.content);
    if (tokens + t > MAX_INJECT_TOKENS) break;
    selected.push(m);
    tokens += t;
  }

  if (selected.length === 0) return { block: null, selected: [] };

  const byType = new Map<MemoryType, AiMemory[]>();
  for (const m of selected) {
    if (!byType.has(m.type)) byType.set(m.type, []);
    byType.get(m.type)!.push(m);
  }

  const lines: string[] = [
    "## What I Know About You And Your Projects",
    "",
    "Use this context to personalize every response. These are durable memories from past sessions.",
    "",
  ];

  for (const type of INJECTION_ORDER) {
    const items = byType.get(type);
    if (!items?.length) continue;
    lines.push(`### ${TYPE_LABELS[type]}`);
    for (const m of items) {
      lines.push(`- ${m.content}`);
    }
    lines.push("");
  }

  return {
    block: lines.join("\n"),
    selected,
  };
}

// ---------------------------------------------------------------------------
// Session fetch: preferences + semantic + team (parallel)
// ---------------------------------------------------------------------------

export async function getMemoriesForSession(params: {
  userId: string;
  firstMessage: string;
  projectId?: number;
}): Promise<{
  preferences: AiMemory[];
  relevant: AiMemory[];
  team: AiMemory[];
  errors: string[];
}> {
  const [preferencesResult, relevantResult, teamResult] =
    await Promise.allSettled([
      getUserPreferences(params.userId),
      searchMemories({
        userId: params.userId,
        query: params.firstMessage,
        projectId: params.projectId,
        matchCount: 6,
        matchThreshold: 0.5,
      }),
      searchTeamMemories({
        query: params.firstMessage,
        projectId: params.projectId,
        matchCount: 4,
      }),
    ]);

  const errors: string[] = [];
  const unwrap = (
    label: string,
    result: PromiseSettledResult<AiMemory[]>,
  ): AiMemory[] => {
    if (result.status === "fulfilled") return result.value;
    const message =
      result.reason instanceof Error
        ? result.reason.message
        : String(result.reason);
    errors.push(`${label}: ${message}`);
    return [];
  };

  const preferences = unwrap("preferences", preferencesResult);
  const relevant = unwrap("relevant memories", relevantResult);
  const team = unwrap("team memories", teamResult);

  return { preferences, relevant, team, errors };
}
