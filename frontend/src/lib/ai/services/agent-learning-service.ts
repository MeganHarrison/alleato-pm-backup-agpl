import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { toSessionUuid } from "@/lib/ai/session-id";
import { getOpenAIModelId } from "@/lib/ai/provider-config";
import { getOpenAI } from "@/lib/ai/tools/tool-utils";
import { retrieveChunks } from "@/lib/ai/retrieval/retrieve-chunks";
import { createRagServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/types/database.types";

type AgentLearningSource = "thumbs_down" | "admin_feedback" | "eval_failure";
type AgentLearningStatus = "candidate" | "active" | "archived";
type UsageOutcome = "unknown" | "positive" | "negative";

export interface AgentLearning {
  id: string;
  title: string;
  source: AgentLearningSource;
  status: AgentLearningStatus;
  prevention_prompt: string;
  scope_tags: string[];
  tool_id: number | null;
  project_id: number | null;
  occurrences: number;
  confidence: number;
  similarity?: number;
}

export interface AgentLearningUsageSummary {
  totalUsed: number;
  learnings: Array<{
    id: string;
    title: string;
    source: AgentLearningSource;
    preventionPrompt: string;
  }>;
}

interface UpsertAgentLearningInput {
  title: string;
  source: AgentLearningSource;
  status?: AgentLearningStatus;
  problemSignature: string;
  symptoms: string;
  rootCause?: string | null;
  fixPattern?: string | null;
  preventionPrompt: string;
  scopeTags?: string[];
  pagePath?: string | null;
  toolId?: number | null;
  projectId?: number | null;
  confidence?: number;
  evidence?: Record<string, unknown>;
}

const MAX_CONTEXT_TOKENS = 400;
const AGENT_LEARNINGS_TABLE = "agent_learnings";
const AGENT_LEARNING_USAGES_TABLE = "agent_learning_usages";

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "have",
  "what",
  "when",
  "were",
  "been",
  "they",
  "them",
  "into",
  "onto",
  "your",
  "about",
  "there",
  "their",
  "would",
  "could",
  "should",
  "after",
  "before",
  "more",
  "than",
  "just",
  "over",
  "under",
  "does",
  "did",
  "done",
  "using",
  "used",
  "user",
  "users",
  "into",
  "then",
  "also",
  "same",
  "page",
  "tool",
  "issue",
  "agent",
  "response",
  "feedback",
]);

function createUntypedServiceClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing Supabase service credentials");
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function clamp01(value: number | undefined, fallback: number) {
  const v = value ?? fallback;
  return Math.min(1, Math.max(0, v));
}

function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9/\-_ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fingerprint(parts: Array<string | number | null | undefined>) {
  const normalized = parts
    .map((part) => normalizeText(String(part ?? "")))
    .filter(Boolean)
    .join("|");

  return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])];
}

function extractKeywords(text: string, limit = 8) {
  const words = normalizeText(text)
    .split(" ")
    .filter((word) => word.length >= 4 && !STOPWORDS.has(word));

  return [...new Set(words)].slice(0, limit);
}


async function _syncLearningChunkToAiDb(
  learningId: string,
  embedText: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    const vec = await embedLearning(embedText);
    if (!vec) return;
    const ragClient = createRagServiceClient();
    await ragClient.from("document_chunks").upsert(
      {
        chunk_id: `agent_learning_${learningId}`,
        document_id: learningId,
        chunk_index: 0,
        text: embedText,
        source_type: "agent_learning",
        embedding: JSON.stringify(vec),
        metadata: metadata as Json,
      },
      { onConflict: "chunk_id" },
    );
  } catch (e) {
    console.warn("[agent-learning-service] Failed to sync chunk to AI DB:", e instanceof Error ? e.message : e);
  }
}

async function embedLearning(text: string) {
  try {
    const response = await getOpenAI().embeddings.create({
      model: getOpenAIModelId("text-embedding-3-large"),
      dimensions: 3072,
      input: text,
    });

    return response.data[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

function chooseNextStatus(params: {
  existingStatus?: AgentLearningStatus | null;
  requestedStatus: AgentLearningStatus;
  source: AgentLearningSource;
  nextOccurrences: number;
}) {
  if (params.requestedStatus === "active") {
    return "active";
  }

  if (params.existingStatus === "active") {
    return "active";
  }

  if (params.source === "thumbs_down" && params.nextOccurrences >= 2) {
    return "active";
  }

  return params.existingStatus ?? params.requestedStatus;
}

function buildLearningContextPayload(learnings: AgentLearning[]) {
  if (learnings.length === 0) {
    return { block: null, selected: [] as AgentLearning[] };
  }

  const selected: AgentLearning[] = [];
  let usedTokens = 0;

  for (const learning of learnings) {
    const chunk = `${learning.title}\n${learning.prevention_prompt}`;
    const chunkTokens = estimateTokens(chunk);
    if (selected.length > 0 && usedTokens + chunkTokens > MAX_CONTEXT_TOKENS) {
      break;
    }

    selected.push(learning);
    usedTokens += chunkTokens;
  }

  if (selected.length === 0) {
    return { block: null, selected: [] as AgentLearning[] };
  }

  const lines = [
    "## Known Failure Patterns To Avoid",
    "",
    "These are verified or repeated issues from prior failures, feedback, and evals. Use them as constraints for this response.",
    "",
    ...selected.map(
      (learning, index) =>
        `${index + 1}. ${learning.title}: ${learning.prevention_prompt}`,
    ),
  ];

  return {
    block: lines.join("\n"),
    selected,
  };
}

async function fetchLatestAssistantSignal(sessionId: string) {
  const supabase = createUntypedServiceClient();
  const { data } = await supabase
    .from("chat_history")
    .select("id, content, metadata, created_at")
    .eq("session_id", toSessionUuid(sessionId))
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as
    | {
        id: string;
        content: string;
        metadata?: {
          tool_trace?: Array<{ toolName?: string; tool_name?: string }>;
          response_quality?: {
            score?: number;
            reasons?: string[];
          };
        } | null;
      }
    | null;
}

export async function upsertAgentLearning(input: UpsertAgentLearningInput) {
  const supabase = createUntypedServiceClient();
  const learningKey = fingerprint([
    input.source,
    input.pagePath,
    input.toolId,
    input.projectId,
    input.problemSignature,
  ]);

  const { data: existing, error: existingError } = await supabase
    .from(AGENT_LEARNINGS_TABLE)
    .select("id, occurrences, confidence, status, evidence")
    .eq("learning_key", learningKey)
    .maybeSingle();

  if (existingError) {
    // Surface this — a missing table or RLS misconfig here means EVERY
    // learning extraction silently fails (which is the bug we just fixed).
    console.error(
      "[agent-learning-service] Failed to read agent_learnings:",
      existingError.message,
      { learningKey, source: input.source },
    );
    return null;
  }

  const nextOccurrences = ((existing?.occurrences as number | undefined) ?? 0) + 1;
  const requestedStatus = input.status ?? "candidate";
  const nextStatus = chooseNextStatus({
    existingStatus: (existing?.status as AgentLearningStatus | undefined) ?? null,
    requestedStatus,
    source: input.source,
    nextOccurrences,
  });
  const nextConfidence = Math.max(
    clamp01(existing?.confidence as number | undefined, 0),
    clamp01(input.confidence, input.source === "eval_failure" ? 0.7 : 0.5),
  );
  const evidence = Array.isArray(existing?.evidence)
    ? [...existing.evidence, input.evidence ?? {}].slice(-10)
    : [input.evidence ?? {}];
  // DO NOT write embedding to agent_learnings in PM APP.
  // HNSW index (m=32, ef_construction=200) causes OOM under concurrent upserts.
  const payload = {
    learning_key: learningKey,
    title: input.title,
    source: input.source,
    status: nextStatus,
    problem_signature: input.problemSignature,
    symptoms: input.symptoms,
    root_cause: input.rootCause ?? null,
    fix_pattern: input.fixPattern ?? null,
    prevention_prompt: input.preventionPrompt,
    scope_tags: uniqueStrings(input.scopeTags ?? []),
    page_path: input.pagePath ?? null,
    tool_id: input.toolId ?? null,
    project_id: input.projectId ?? null,
    occurrences: nextOccurrences,
    confidence: nextConfidence,
    evidence,
    last_seen_at: new Date().toISOString(),
    ...(nextStatus === "active" ? { activated_at: new Date().toISOString() } : {}),
  };

  const { data, error } = await supabase
    .from(AGENT_LEARNINGS_TABLE)
    .upsert(payload, { onConflict: "learning_key" })
    .select(
      "id, title, source, status, prevention_prompt, scope_tags, tool_id, project_id, occurrences, confidence",
    )
    .single();

  if (error) {
    console.error(
      "[agent-learning-service] Failed to upsert agent_learnings:",
      error.message,
      { learningKey, source: input.source, title: input.title },
    );
    return null;
  }

  const learning = data as AgentLearning;
  const embedText = `${input.title}\n${input.symptoms}\n${input.preventionPrompt}`;
  void _syncLearningChunkToAiDb(learning.id, embedText, {
    source: input.source,
    status: nextStatus,
    project_id: input.projectId ?? null,
    tool_id: input.toolId ?? null,
  });

  return learning;
}

export async function getRelevantAgentLearnings(params: {
  messageText: string;
  projectId?: number;
  limit?: number;
}) {
  const supabase = createUntypedServiceClient();
  const matchCount = params.limit ?? 4;

  try {
    const chunks = await retrieveChunks({
      query: params.messageText.slice(0, 8000),
      openai: getOpenAI(),
      ragClient: createRagServiceClient(),
      projectId: params.projectId ?? undefined,
      sourceTypes: ["agent_learning"],
      matchCount,
      matchThreshold: 0.45,
      errorLabel: "Agent learning search",
    });

    if (Array.isArray(chunks) && chunks.length > 0) {
      const learningIds = (chunks as Array<{ document_id: string; similarity: number }>).map((c) => c.document_id);
        const similarityMap = new Map(
          (chunks as Array<{ document_id: string; similarity: number }>).map((c) => [c.document_id, c.similarity]),
        );

        const { data: learnings } = await supabase
          .from(AGENT_LEARNINGS_TABLE)
          .select("id, title, source, status, prevention_prompt, scope_tags, tool_id, project_id, occurrences, confidence")
          .in("id", learningIds)
          .eq("status", "active");

        if (learnings && learnings.length > 0) {
          return (learnings as AgentLearning[])
            .map((l) => ({ ...l, similarity: similarityMap.get(l.id) ?? 0 }))
            .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
        }
      }
    } catch (e) {
      console.warn("[agent-learning-service] AI DB search failed — falling back to keyword search:", e instanceof Error ? e.message : e);
    }

  const keywords = extractKeywords(params.messageText, 6);
  let query = supabase
    .from(AGENT_LEARNINGS_TABLE)
    .select(
      "id, title, source, status, prevention_prompt, scope_tags, tool_id, project_id, occurrences, confidence",
    )
    .eq("status", "active")
    .order("last_seen_at", { ascending: false })
    .limit(matchCount);

  if (params.projectId) {
    query = query.or(`project_id.is.null,project_id.eq.${params.projectId}`);
  }

  if (keywords.length > 0) {
    query = query.overlaps("scope_tags", keywords);
  }

  const { data } = await query;
  return (data ?? []) as AgentLearning[];
}

export function buildAgentLearningContextBlock(learnings: AgentLearning[]) {
  return buildLearningContextPayload(learnings);
}

/**
 * Deterministic surface-scoped learning fetch for non-chat generators (executive
 * daily brief, progress reports) that produce content outside the assistant's
 * embedding-driven retrieval path. Unlike `getRelevantAgentLearnings` (which does
 * an embedding search NOT filtered by surface, so it would pull unrelated chat
 * learnings into a brief), this filters strictly on an exact `scope_tags` match —
 * so a `daily_brief` generator only ever sees `daily_brief` learnings. Highest
 * confidence first; project-scoped learnings plus globals when a project is given.
 */
export async function getSurfaceScopedLearnings(params: {
  surface: string;
  projectId?: number | null;
  limit?: number;
}): Promise<AgentLearning[]> {
  const supabase = createUntypedServiceClient();
  let query = supabase
    .from(AGENT_LEARNINGS_TABLE)
    .select(
      "id, title, source, status, prevention_prompt, scope_tags, tool_id, project_id, occurrences, confidence",
    )
    .eq("status", "active")
    .contains("scope_tags", [params.surface])
    .order("confidence", { ascending: false })
    .limit(params.limit ?? 3);

  if (params.projectId != null) {
    query = query.or(`project_id.is.null,project_id.eq.${params.projectId}`);
  } else {
    query = query.is("project_id", null);
  }

  const { data, error } = await query;
  if (error) {
    console.warn(
      "[agent-learning-service] getSurfaceScopedLearnings failed:",
      error.message,
    );
    return [];
  }
  return (data ?? []) as AgentLearning[];
}

export async function recordAgentLearningUsages(params: {
  sessionId: string;
  userId: string;
  messageText: string;
  responseQualityScore?: number;
  learnings: Array<Pick<AgentLearning, "id" | "title" | "source">>;
}) {
  if (params.learnings.length === 0) {
    return;
  }

  const supabase = createUntypedServiceClient();
  const messageExcerpt = params.messageText.slice(0, 500);

  await Promise.allSettled(
    params.learnings.map((learning) =>
      supabase.from(AGENT_LEARNING_USAGES_TABLE).upsert(
        {
          learning_id: learning.id,
          session_id: toSessionUuid(params.sessionId),
          user_id: params.userId,
          outcome: "unknown",
          response_quality_score: params.responseQualityScore ?? null,
          message_excerpt: messageExcerpt,
          metadata: {
            learningTitle: learning.title,
            learningSource: learning.source,
          },
        },
        { onConflict: "learning_id,session_id" },
      ),
    ),
  );
}

export async function updateLearningUsageOutcomeForSession(
  sessionId: string,
  outcome: UsageOutcome,
) {
  const supabase = createUntypedServiceClient();
  await supabase
    .from(AGENT_LEARNING_USAGES_TABLE)
    .update({ outcome })
    .eq("session_id", toSessionUuid(sessionId))
    .eq("outcome", "unknown");
}

/**
 * Categorical reason → targeted prevention prompt addition. When the user
 * tells us *why* a response was bad, encode that into the learning so the
 * model sees a specific instruction, not just "be better".
 */
const REASON_PREVENTION_HINTS: Record<string, string> = {
  incorrect_facts:
    "Verify each factual claim against the retrieved sources before stating it. Do not assert numbers, names, or dates that aren't grounded in evidence.",
  outdated_info:
    "Check the timestamp of any data you cite. If the most recent source is older than what the user is asking about, say so explicitly.",
  hallucinated:
    "If a fact is not in the retrieved context, do not invent it. Say you don't have that information and offer what you do have.",
  incomplete:
    "Cover all parts of the user's question. If you can only answer part of it, list what's still missing.",
  irrelevant:
    "Re-read the user's question and answer THAT question specifically. Do not drift into related topics they didn't ask about.",
  wrong_tool:
    "Pick the tool that matches the user's intent (emails vs meetings vs tasks vs budget). When unsure, prefer the more specific tool over a generic search.",
  unhelpful:
    "Give the actual answer, not a meta-description of what you could do. If you don't have enough context, ask one specific clarifying question.",
  duplicate_risk:
    "Do not list overlapping risks as separate items. Merge duplicates and keep the clearest wording once.",
  not_a_risk:
    "Only label something as a risk when it describes a plausible project exposure, blocker, delay, cost issue, or coordination failure. Do not turn neutral discussion points into risks.",
  wrong_priority:
    "Prioritize risks by actual project impact and immediacy. Avoid inflating minor notes into top-line risks.",
  well_scoped:
    "Keep each risk specific, concrete, and bounded to one real project issue.",
  actionable:
    "Phrase risks so a PM can immediately understand what could go wrong and what needs follow-up.",
  real_risk:
    "Prefer risks grounded in explicit evidence from the meeting, not speculative or generic concerns.",
  other: "Re-read the user feedback note and avoid this failure pattern.",
};

export async function ingestThumbsFeedbackLearning(params: {
  sessionId: string;
  feedback: "up" | "down";
  messageContent?: string;
  /**
   * Which AI surface produced the content. Becomes a scope tag so the
   * learning is retrieved on the same surface next time.
   */
  surface?: string;
  reasonCategory?: string | null;
  reason?: string | null;
  projectId?: number | null;
}) {
  await updateLearningUsageOutcomeForSession(
    params.sessionId,
    params.feedback === "up" ? "positive" : "negative",
  );

  if (params.feedback !== "down") {
    return null;
  }

  const assistantSignal = await fetchLatestAssistantSignal(params.sessionId);
  const toolTrace = assistantSignal?.metadata?.tool_trace ?? [];
  const toolNames = uniqueStrings(
    toolTrace.flatMap((item) => [item.toolName, item.tool_name]),
  );
  const reasons = assistantSignal?.metadata?.response_quality?.reasons ?? [];
  const excerpt = (params.messageContent || assistantSignal?.content || "").slice(0, 280);

  const surface = params.surface ?? "ai_assistant";
  const reasonCategory = params.reasonCategory ?? null;
  const reasonNote = params.reason?.trim() || null;

  const scopeTags = uniqueStrings([
    "thumbs_down",
    surface,
    ...(reasonCategory ? [reasonCategory] : []),
    ...toolNames,
    ...extractKeywords(excerpt),
    ...reasons.flatMap((reason) => extractKeywords(reason, 3)),
  ]);

  const categoricalHint =
    reasonCategory && REASON_PREVENTION_HINTS[reasonCategory]
      ? REASON_PREVENTION_HINTS[reasonCategory]
      : null;

  const preventionParts = uniqueStrings([
    categoricalHint,
    reasonNote ? `User note: ${reasonNote}` : null,
    toolNames.length > 0
      ? `Re-check tool outputs from ${toolNames.join(", ")} before finalizing the answer.`
      : "Call the relevant live tools before answering instead of relying on assumptions.",
    reasons.some((reason) => reason.includes("no source citations"))
      ? "Include grounded source references when the answer depends on retrieved evidence."
      : null,
    "If the data is incomplete, say so explicitly instead of guessing.",
  ]);

  // If the user gave us a specific reason category, trust the signal and
  // activate the learning immediately rather than waiting for a 2nd occurrence.
  // Anonymous "just thumbs-down, no reason" stays as a candidate.
  const status: AgentLearningStatus = reasonCategory ? "active" : "candidate";
  const confidence = reasonCategory ? 0.7 : 0.45;

  const titleSuffix = reasonCategory
    ? ` — ${reasonCategory.replace(/_/g, " ")}`
    : "";

  return upsertAgentLearning({
    title:
      toolNames.length > 0
        ? `Thumbs-down on ${toolNames.join(", ")} responses${titleSuffix}`
        : `Thumbs-down on ${surface} responses${titleSuffix}`,
    source: "thumbs_down",
    status,
    problemSignature: `${surface} ${reasonCategory ?? "uncategorized"} ${toolNames.join(" ")} ${excerpt}`.trim() || "thumbs down response",
    symptoms: [
      excerpt ? `Rejected answer excerpt: ${excerpt}` : null,
      reasonCategory ? `Reason category: ${reasonCategory}` : null,
      reasonNote ? `User note: ${reasonNote}` : null,
      reasons.length > 0 ? `Response quality signals: ${reasons.join("; ")}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    preventionPrompt: preventionParts.join(" "),
    scopeTags,
    projectId: params.projectId ?? null,
    confidence,
    evidence: {
      sessionId: params.sessionId,
      surface,
      reasonCategory,
      reason: reasonNote,
      assistantExcerpt: excerpt,
      toolNames,
      responseQuality: assistantSignal?.metadata?.response_quality ?? null,
    },
  });
}

export async function ingestAdminFeedbackLearning(params: {
  feedbackItemId: string;
  title: string;
  comment: string;
  pagePath?: string | null;
  toolId?: number | null;
  projectId?: number | null;
  status?: AgentLearningStatus;
  resolutionSummary?: string | null;
}) {
  const scopeTags = uniqueStrings([
    "admin_feedback",
    ...(params.pagePath ? params.pagePath.split("/").filter(Boolean) : []),
    ...extractKeywords(`${params.title} ${params.comment}`),
  ]);

  const preventionPrompt = params.resolutionSummary
    ? `Known verified issue for ${params.pagePath || "this workflow"}: ${params.title}. Apply this fix pattern: ${params.resolutionSummary}`
    : `When working in ${params.pagePath || "this workflow"}, verify this known issue does not recur: ${params.title}. ${params.comment.slice(0, 240)}`;

  return upsertAgentLearning({
    title: params.title,
    source: "admin_feedback",
    status: params.status ?? "candidate",
    problemSignature: `${params.pagePath ?? ""} ${params.title} ${params.comment}`,
    symptoms: params.comment,
    fixPattern: params.resolutionSummary ?? null,
    preventionPrompt,
    scopeTags,
    pagePath: params.pagePath ?? null,
    toolId: params.toolId ?? null,
    projectId: params.projectId ?? null,
    confidence: params.resolutionSummary ? 0.8 : 0.6,
    evidence: {
      feedbackItemId: params.feedbackItemId,
      pagePath: params.pagePath ?? null,
      resolutionSummary: params.resolutionSummary ?? null,
    },
  });
}

/**
 * Per-category prevention guidance for AI submittal-review corrections. Each line
 * tells the reviewer how to avoid repeating the mistake the human just corrected.
 */
const SUBMITTAL_REVIEW_PREVENTION_HINTS: Record<string, string> = {
  missed_requirement:
    "Enumerate each spec requirement and confirm explicit coverage in the submittal before concluding it is satisfied; do not assume a requirement is met without locating it.",
  wrong_document_match:
    "Confirm the submittal is being compared against the correct drawing and spec section before reporting a match or conflict.",
  bad_interpretation:
    "Read the cited spec/drawing text literally; do not infer requirements beyond what the document states.",
  hallucinated_issue:
    "Only report a conflict or deficiency that is supported by specific cited text. If you cannot cite the source, do not raise the finding.",
  too_vague:
    "State the exact spec section, sheet number, and value involved in each finding instead of a general observation.",
  needs_expert_review:
    "Flag low-confidence findings for expert review explicitly rather than asserting a definitive status.",
};

export interface SubmittalReviewCorrectionInput {
  reviewType: string;
  aiFinding: string;
  aiStatus: string;
  feedbackCategory: string;
  specSection?: string | null;
  requirementType?: string | null;
  correctedStatus?: string | null;
  correctedReason?: string | null;
  sourceOfTruthRef?: string | null;
  projectId?: number | null;
  feedbackId?: string | null;
}

/**
 * Pure builder: maps a human correction of an AI document-review finding into the
 * shape of an agent learning. Returns null for positive signals (`correct`,
 * `useful_low_priority`) that need no prevention prompt. Kept IO-free so it is
 * unit-testable without OpenAI/Supabase.
 */
export function buildSubmittalReviewCorrectionLearning(
  params: SubmittalReviewCorrectionInput,
): UpsertAgentLearningInput | null {
  if (
    params.feedbackCategory === "correct" ||
    params.feedbackCategory === "useful_low_priority"
  ) {
    return null;
  }

  const categoryHint =
    SUBMITTAL_REVIEW_PREVENTION_HINTS[params.feedbackCategory] ?? null;
  const findingExcerpt = params.aiFinding.slice(0, 280);

  const scopeTags = uniqueStrings([
    "submittal_review",
    "document_review",
    params.reviewType,
    params.feedbackCategory,
    ...(params.requirementType ? [params.requirementType] : []),
    ...(params.specSection ? extractKeywords(params.specSection, 4) : []),
    ...extractKeywords(findingExcerpt),
  ]);

  const preventionPrompt = uniqueStrings([
    categoryHint,
    params.correctedReason ? `Verified correction: ${params.correctedReason}` : null,
    params.correctedStatus
      ? `The correct status here is "${params.correctedStatus}", not "${params.aiStatus}".`
      : null,
    params.sourceOfTruthRef ? `Source of truth: ${params.sourceOfTruthRef}.` : null,
    params.specSection
      ? `Applies when reviewing spec section ${params.specSection}.`
      : null,
  ]).join(" ");

  const titleSection = params.specSection ? ` (${params.specSection})` : "";

  return {
    title:
      `Submittal review correction — ${params.feedbackCategory.replace(/_/g, " ")}${titleSection}`.slice(
        0,
        160,
      ),
    source: "eval_failure",
    // A human correction with an explicit category is a high-signal eval failure;
    // activate immediately rather than waiting for a second occurrence.
    status: "active",
    problemSignature:
      `${params.reviewType} ${params.feedbackCategory} ${params.specSection ?? ""} ${params.aiStatus} ${findingExcerpt}`.trim(),
    symptoms: [
      `AI finding (${params.aiStatus}): ${findingExcerpt}`,
      `Correction category: ${params.feedbackCategory}`,
      params.correctedReason ? `Why it was wrong: ${params.correctedReason}` : null,
      params.sourceOfTruthRef ? `Source of truth: ${params.sourceOfTruthRef}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    fixPattern: params.correctedReason ?? null,
    preventionPrompt:
      preventionPrompt ||
      categoryHint ||
      "Re-verify this finding against the cited source before reporting it.",
    scopeTags,
    projectId: params.projectId ?? null,
    confidence: 0.75,
    evidence: {
      feedbackId: params.feedbackId ?? null,
      reviewType: params.reviewType,
      feedbackCategory: params.feedbackCategory,
      specSection: params.specSection ?? null,
      requirementType: params.requirementType ?? null,
      aiStatus: params.aiStatus,
      correctedStatus: params.correctedStatus ?? null,
      sourceOfTruthRef: params.sourceOfTruthRef ?? null,
    },
  };
}

/**
 * Turns a human correction of an AI document-review finding (logged via the
 * `logFeedback` tool into `ai_review_feedback`) into a durable agent learning.
 * Scope-tagged to `submittal_review` so `getRelevantAgentLearnings` injects it
 * into the assistant prompt the next time a similar review runs — closing the
 * loop that previously dead-ended at the `ai_review_feedback` table.
 */
export async function ingestSubmittalReviewCorrectionLearning(
  params: SubmittalReviewCorrectionInput,
) {
  const learning = buildSubmittalReviewCorrectionLearning(params);
  if (!learning) {
    return null;
  }
  return upsertAgentLearning(learning);
}

export function summarizeAgentLearningUsage(learnings: AgentLearning[]): AgentLearningUsageSummary {
  return {
    totalUsed: learnings.length,
    learnings: learnings.map((learning) => ({
      id: learning.id,
      title: learning.title,
      source: learning.source,
      preventionPrompt: learning.prevention_prompt,
    })),
  };
}
