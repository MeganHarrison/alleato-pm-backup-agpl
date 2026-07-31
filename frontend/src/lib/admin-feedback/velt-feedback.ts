import { createGitHubIssue } from "@/lib/admin-feedback/github";
import { buildAdminFeedbackTitle } from "@/lib/admin-feedback/title";
import {
  matchFeedbackToTool,
  getToolById,
} from "@/lib/admin-feedback/tool-matcher";
import {
  resolveToolContext,
  contextToAgentPayload,
} from "@/lib/admin-feedback/context-resolver";
import { ingestAdminFeedbackLearning } from "@/lib/ai/services/agent-learning-service";
import { logger } from "@/lib/logger";
import { serviceDb } from "@/lib/supabase/service-db";
import type { Database } from "@/types/database.types";

type JsonValue =
  Database["public"]["Tables"]["admin_feedback_items"]["Row"]["metadata"];
type FeedbackInsert =
  Database["public"]["Tables"]["admin_feedback_items"]["Insert"];
type ExistingFeedbackRow = Pick<
  Database["public"]["Tables"]["admin_feedback_items"]["Row"],
  | "id"
  | "title"
  | "status"
  | "github_issue_number"
  | "github_issue_url"
  | "github_issue_state"
  | "tool_id"
  | "metadata"
>;

type AdminFeedbackRequestType = "bug" | "change_request" | "question";
type AdminFeedbackSeverity = "low" | "medium" | "high";

export type VeltMirrorAttachment = {
  attachmentId?: number | string | null;
  name?: string | null;
  url?: string | null;
  mimeType?: string | null;
  previewImages?: string[] | null;
  thumbnail?: string | null;
};

export type VeltMirrorUser = {
  userId?: string | null;
  name?: string | null;
  email?: string | null;
};

export type VeltMirrorInput = {
  annotationId: string;
  commentId: number | string;
  documentId: string;
  pageUrl: string;
  pageTitle?: string | null;
  commentText?: string | null;
  commentHtml?: string | null;
  createdAt?: string | number | null;
  lastUpdated?: string | number | null;
  attachments?: VeltMirrorAttachment[];
  author: VeltMirrorUser;
  taggedUsers?: VeltMirrorUser[];
  targetElementId?: string | null;
  targetElementPath?: string | null;
  taggedElementPath?: string | null;
  taggedElementRect?: unknown;
  annotationContext?: Record<string, unknown> | null;
  createIssue?: boolean;
  source: "batch_import" | "velt_comment_annotation" | "velt_comment_reply";
};

export type MirrorVeltCommentResult = {
  feedbackId: string;
  githubIssueUrl: string | null;
  githubIssueNumber: number | null;
  status: "created" | "existing" | "repaired";
  feedbackStatus: string;
  title: string;
};

function toJsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonValue(item));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, toJsonValue(item)]),
    );
  }

  return String(value);
}

function cleanCommentText(
  input: Pick<VeltMirrorInput, "commentText" | "commentHtml">,
) {
  const raw = input.commentText ?? input.commentHtml ?? "";
  return raw
    .replace(/<[^>]*>/g, " ")
    .replace(/\{\{[^}]+\}\}/g, " ")
    .replace(/\b[\w-]+\.(?:png|jpg|jpeg|webp|gif)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseProjectId(documentId: string): number | null {
  const match = documentId.match(/^\/(\d+)(?:\/|$)/);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function classifyRequestType(text: string): AdminFeedbackRequestType {
  const lower = text.toLowerCase();

  if (
    /(what is|what are|where is|where are|why is|why are|who is|who are|\?$)/.test(
      lower,
    ) &&
    !/(should|should be able|failed|won't|wont|not working|isn't|doesn't|aren't|wouldn't)/.test(
      lower,
    )
  ) {
    return "question";
  }

  if (
    /(failed|won't|wont|wouldn't|not working|isn't|doesn't|aren't showing|routes me|wrong|not under|not lining up|can't|cannot)/.test(
      lower,
    )
  ) {
    return "bug";
  }

  return "change_request";
}

function classifySeverity(
  requestType: AdminFeedbackRequestType,
  text: string,
): AdminFeedbackSeverity {
  const lower = text.toLowerCase();

  if (
    /(failed|won't let|wont let|not working|routes me|wrong|doesn't make any sense|qr code|export function failed|can't|cannot)/.test(
      lower,
    )
  ) {
    return "high";
  }

  if (requestType === "question") {
    return "low";
  }

  return "medium";
}

function firstImageUrl(attachments: VeltMirrorAttachment[] | undefined) {
  for (const attachment of attachments ?? []) {
    const mimeType = (attachment.mimeType ?? "").toLowerCase();
    if (mimeType.startsWith("image/") && attachment.url) {
      return attachment.url;
    }
    if (attachment.previewImages?.[0]) {
      return attachment.previewImages[0];
    }
    if (attachment.thumbnail) {
      return attachment.thumbnail;
    }
  }

  return null;
}

function selectTargetSelector(input: VeltMirrorInput) {
  if (input.targetElementId?.trim()) {
    return `#${input.targetElementId.trim()}`;
  }
  if (input.targetElementPath?.trim()) {
    return input.targetElementPath.trim();
  }
  if (input.taggedElementPath?.trim()) {
    return input.taggedElementPath.trim();
  }
  return `velt-annotation:${input.annotationId}`;
}

async function findExistingFeedback(
  input: VeltMirrorInput,
): Promise<ExistingFeedbackRow | null> {
  const commentId = String(input.commentId);

  const byComment = await serviceDb
    .from("admin_feedback_items")
    .select(
      "id, title, status, github_issue_number, github_issue_url, github_issue_state, tool_id, metadata",
    )
    .contains("metadata", {
      sourceSystem: "velt",
      veltCommentId: commentId,
    })
    .maybeSingle();

  if (byComment.data) {
    return byComment.data;
  }

  const byAnnotation = await serviceDb
    .from("admin_feedback_items")
    .select(
      "id, title, status, github_issue_number, github_issue_url, github_issue_state, tool_id, metadata",
    )
    .contains("metadata", {
      sourceSystem: "velt",
      veltAnnotationId: input.annotationId,
      rawCommentText: cleanCommentText(input),
    })
    .maybeSingle();

  return byAnnotation.data ?? null;
}

async function repairGitHubIssue(
  row: ExistingFeedbackRow,
  input: VeltMirrorInput,
  title: string,
  comment: string,
  requestType: AdminFeedbackRequestType,
  severity: AdminFeedbackSeverity,
  metadata: Record<string, unknown>,
) {
  const matchedTool =
    row.tool_id != null
      ? await getToolById(row.tool_id)
      : await matchFeedbackToTool(
          title,
          comment,
          input.documentId,
          input.pageUrl,
        );
  const toolContext = matchedTool ? resolveToolContext(matchedTool) : null;
  const screenshotUrl = firstImageUrl(input.attachments);

  try {
    const githubIssue = await createGitHubIssue({
      title,
      comment,
      pageUrl: input.pageUrl,
      pagePath: input.documentId,
      pageTitle: input.pageTitle ?? null,
      requestType,
      severity,
      targetId: input.annotationId,
      targetSelector: selectTargetSelector(input),
      targetTag: "velt-comment",
      targetText: comment,
      domPath: input.taggedElementPath ?? input.targetElementPath ?? null,
      screenshotUrl,
      projectId: parseProjectId(input.documentId),
      metadata,
      toolContext,
    });

    if (!githubIssue) {
      return null;
    }

    await serviceDb
      .from("admin_feedback_items")
      .update({
        github_issue_number: githubIssue.number,
        github_issue_url: githubIssue.url,
        github_issue_state: githubIssue.state,
        status: "submitted",
      })
      .eq("id", row.id);

    return githubIssue;
  } catch (error) {
    logger.warn({
      msg: "[VeltFeedback] GitHub issue repair failed",
      feedbackId: row.id,
      error: error instanceof Error ? error.message : String(error),
    });

    await serviceDb
      .from("admin_feedback_items")
      .update({ status: "github_failed" })
      .eq("id", row.id);

    return null;
  }
}

export async function mirrorVeltCommentToFeedback(
  input: VeltMirrorInput,
): Promise<MirrorVeltCommentResult> {
  const cleanedComment = cleanCommentText(input);
  const requestType = classifyRequestType(cleanedComment);
  const severity = classifySeverity(requestType, cleanedComment);
  const projectId = parseProjectId(input.documentId);
  const targetSelector = selectTargetSelector(input);
  const screenshotUrl = firstImageUrl(input.attachments);
  const title = buildAdminFeedbackTitle({
    requestType,
    comment: cleanedComment,
    targetText: cleanedComment,
    pageTitle: input.pageTitle ?? null,
  });

  const metadata = {
    sourceSystem: "velt",
    source: input.source,
    veltCommentId: String(input.commentId),
    veltAnnotationId: input.annotationId,
    veltCommentUrl: input.pageUrl,
    submitterName: input.author.name ?? null,
    submitterEmail: input.author.email ?? null,
    taggedUsers: (input.taggedUsers ?? []).map((user) => ({
      userId: user.userId ?? null,
      name: user.name ?? null,
      email: user.email ?? null,
    })),
    rawCommentText: cleanedComment,
    targetElementId: input.targetElementId ?? null,
    targetElementPath: input.targetElementPath ?? null,
    taggedElementPath: input.taggedElementPath ?? null,
    attachments: (input.attachments ?? []).map((attachment) => ({
      attachmentId: attachment.attachmentId ?? null,
      name: attachment.name ?? null,
      url: attachment.url ?? null,
      mimeType: attachment.mimeType ?? null,
    })),
    annotationContext: input.annotationContext ?? null,
    createIssueRequested: input.createIssue === true,
    createdAt: input.createdAt ?? null,
    lastUpdated: input.lastUpdated ?? null,
  };

  const existing = await findExistingFeedback(input);
  if (existing?.github_issue_url || existing?.github_issue_number) {
    return {
      feedbackId: existing.id,
      githubIssueUrl: existing.github_issue_url,
      githubIssueNumber: existing.github_issue_number,
      status: "existing",
      feedbackStatus: existing.status,
      title: existing.title,
    };
  }

  if (existing && input.createIssue !== true) {
    return {
      feedbackId: existing.id,
      githubIssueUrl: null,
      githubIssueNumber: null,
      status: "existing",
      feedbackStatus: existing.status,
      title: existing.title,
    };
  }

  if (existing) {
    const githubIssue = await repairGitHubIssue(
      existing,
      input,
      title,
      cleanedComment,
      requestType,
      severity,
      metadata,
    );

    return {
      feedbackId: existing.id,
      githubIssueUrl: githubIssue?.url ?? null,
      githubIssueNumber: githubIssue?.number ?? null,
      status: "repaired",
      feedbackStatus: githubIssue ? "submitted" : "github_failed",
      title: existing.title,
    };
  }

  const matchedTool = await matchFeedbackToTool(
    title,
    cleanedComment,
    input.documentId,
    input.pageUrl,
  );
  const toolContext = matchedTool ? resolveToolContext(matchedTool) : null;
  const agentContext = toolContext
    ? toJsonValue(contextToAgentPayload(toolContext))
    : null;

  const insertPayload: FeedbackInsert = {
    created_by: input.author.userId ?? "unknown",
    project_id: projectId,
    page_url: input.pageUrl,
    page_path: input.documentId,
    page_title: input.pageTitle ?? null,
    target_id: input.annotationId,
    target_selector: targetSelector,
    target_text: cleanedComment || input.pageTitle || "Velt comment",
    target_tag: "velt-comment",
    dom_path: input.taggedElementPath ?? input.targetElementPath ?? null,
    target_rect:
      (input.taggedElementRect as FeedbackInsert["target_rect"]) ?? null,
    title,
    comment: cleanedComment || "Velt comment",
    request_type: requestType,
    severity,
    status: "open",
    screenshot_url: screenshotUrl,
    screenshot_path: null,
    metadata: toJsonValue(metadata),
    ...(matchedTool ? { tool_id: matchedTool.id } : {}),
    ...(agentContext ? { agent_context: agentContext } : {}),
  };

  const { data: inserted, error: insertError } = await serviceDb
    .from("admin_feedback_items")
    .insert(insertPayload)
    .select("id, title, status")
    .single();

  if (insertError || !inserted) {
    throw new Error(
      insertError?.message ?? "Failed to insert Velt feedback item",
    );
  }

  try {
    await ingestAdminFeedbackLearning({
      feedbackItemId: inserted.id,
      title,
      comment: cleanedComment,
      pagePath: input.documentId,
      toolId: matchedTool?.id ?? null,
      projectId,
      status: "candidate",
    });
  } catch (learningError) {
    logger.error({
      msg: "[VeltFeedback] Candidate learning ingestion failed",
      data: learningError,
      feedbackId: inserted.id,
    });
  }

  let githubIssue: Awaited<ReturnType<typeof createGitHubIssue>> = null;
  if (input.createIssue === true) {
    try {
      githubIssue = await createGitHubIssue({
        title,
        comment: cleanedComment,
        pageUrl: input.pageUrl,
        pagePath: input.documentId,
        pageTitle: input.pageTitle ?? null,
        requestType,
        severity,
        targetId: input.annotationId,
        targetSelector,
        targetTag: "velt-comment",
        targetText: cleanedComment || null,
        domPath: input.taggedElementPath ?? input.targetElementPath ?? null,
        screenshotUrl,
        projectId,
        metadata,
        toolContext,
      });
    } catch (error) {
      logger.warn({
        msg: "[VeltFeedback] GitHub issue creation failed",
        feedbackId: inserted.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (githubIssue) {
    await serviceDb
      .from("admin_feedback_items")
      .update({
        github_issue_number: githubIssue.number,
        github_issue_url: githubIssue.url,
        github_issue_state: githubIssue.state,
        status: "submitted",
      })
      .eq("id", inserted.id);
  } else if (input.createIssue === true) {
    await serviceDb
      .from("admin_feedback_items")
      .update({ status: "github_failed" })
      .eq("id", inserted.id);
  }

  return {
    feedbackId: inserted.id,
    githubIssueUrl: githubIssue?.url ?? null,
    githubIssueNumber: githubIssue?.number ?? null,
    status: "created",
    feedbackStatus: githubIssue
      ? "submitted"
      : input.createIssue === true
        ? "github_failed"
        : inserted.status,
    title: inserted.title,
  };
}
