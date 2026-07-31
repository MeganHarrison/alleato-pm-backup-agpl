/**
 * Shared types for feedback on AI-generated *responses* (chat answers, insight
 * narratives, daily digests, anywhere the AI generated some text/content the
 * user is reviewing).
 *
 * Task-specific feedback lives in `task-feedback-types.ts` — its categories
 * are about what's wrong with a *task* (not actionable, wrong assignee, etc).
 * This file is for what's wrong with an AI *response*.
 */

export const AI_RESPONSE_FEEDBACK_REASON_CATEGORIES = [
  "incorrect_facts",
  "outdated_info",
  "hallucinated",
  "incomplete",
  "irrelevant",
  "wrong_tool",
  "unhelpful",
  "other",
] as const;

export type AiResponseFeedbackReasonCategory =
  (typeof AI_RESPONSE_FEEDBACK_REASON_CATEGORIES)[number];

export const AI_RESPONSE_FEEDBACK_REASON_LABELS: Record<
  AiResponseFeedbackReasonCategory,
  string
> = {
  incorrect_facts: "Wrong facts or numbers",
  outdated_info: "Outdated information",
  hallucinated: "Made things up",
  incomplete: "Missing important details",
  irrelevant: "Didn't answer my question",
  wrong_tool: "Used the wrong tool / source",
  unhelpful: "Generic, no real answer",
  other: "Other",
};

/**
 * The "surface" a piece of AI content came from. Used as the `surface` field
 * on `ai_feedback_events` and as a scope tag on `agent_learnings` so the
 * learning loop knows which retrieval path / prompt the issue came from.
 */
export type AiResponseSurface =
  | "ai_assistant" // main chat
  | "compact_chat" // sidebar / widget
  | "daily_digest"
  | "intelligence_packet"
  | "insight_card"
  | "meeting_summary"
  | "executive_brief"
  | "email_summary"
  | "other_response";

export interface AiResponseFeedbackSubject {
  /** Required: which AI surface produced this content. */
  surface: AiResponseSurface;
  /** The subject's stable id if it has one (e.g. message id, insight id). */
  subjectId?: string | null;
  /** Concrete chat/UI message id when different from the subject id. */
  messageId?: string | null;
  /** Langfuse trace id for attaching user feedback to the exact trace. */
  traceId?: string | null;
  /** Subject type tag (e.g. "assistant_message", "insight_card"). */
  subjectType: string;
  /** Optional project context for project-scoped learnings. */
  projectId?: number | null;
  /** Optional session id (chat session, etc). */
  sessionId?: string | null;
  /**
   * Snapshot of the content being rated. Helps backfill learnings later
   * even if the source row is deleted.
   */
  contentSnapshot: {
    text: string;
    model?: string | null;
    generatedAt?: string | null;
    toolNames?: string[];
    sources?: string[];
  };
}
