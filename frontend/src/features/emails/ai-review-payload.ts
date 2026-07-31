/**
 * Pure payload logic for the AI Review "Confirm & Correct" panel.
 *
 * Extracted from `ai-review-panel.tsx` (a "use client" component) so the
 * decision → save-payload mapping can be unit-tested in isolation — no React,
 * no network. This is the exact logic a Codex review caught a real bug in
 * (a no-op save erasing prior project feedback), so it earns a test.
 */

export type ReviewAction = "reply" | "delegate" | "watch" | "ignore";
export type ReviewPriority = "urgent" | "high" | "normal" | "low";
export type DecisionStatus = "unreviewed" | "confirmed" | "corrected";
export type FieldVerdict = "correct" | "incorrect" | "unreviewed";
export type ReplyFeedback = "good" | "edit" | "regen" | "skip";
export type ReviewOutcome =
  | "draft_copied"
  | "draft_edited"
  | "skipped"
  | "delegated"
  | "watched"
  | "marked_no_action";

export function statusToVerdict(status: DecisionStatus): FieldVerdict {
  if (status === "confirmed") return "correct";
  if (status === "corrected") return "incorrect";
  return "unreviewed";
}

export function verdictToStatus(verdict: FieldVerdict | undefined): DecisionStatus {
  if (verdict === "correct") return "confirmed";
  if (verdict === "incorrect") return "corrected";
  return "unreviewed";
}

export function deriveReviewOutcome(
  action: ReviewAction,
  reply: ReplyFeedback | null,
  hasDraft: boolean,
): ReviewOutcome {
  if (reply === "good" && hasDraft) return "draft_copied";
  if (reply === "edit" && hasDraft) return "draft_edited";
  switch (action) {
    case "delegate":
      return "delegated";
    case "watch":
      return "watched";
    case "ignore":
      return "marked_no_action";
    default:
      return "skipped";
  }
}

export function replyVerdict(reply: ReplyFeedback | null): FieldVerdict {
  if (reply === "good" || reply === "edit") return "correct";
  if (reply === "skip") return "incorrect";
  return "unreviewed";
}

export interface DecisionStatusMap {
  action: DecisionStatus;
  priority: DecisionStatus;
  project: DecisionStatus;
  category: DecisionStatus;
}

export interface AssistantReviewPayloadInput {
  action: ReviewAction;
  priority: ReviewPriority;
  category: string;
  projectId: number | null;
  /** Per-decision status AFTER unreviewed rows have been promoted to confirmed. */
  finalStatus: DecisionStatusMap;
  replyFeedback: ReplyFeedback | null;
  draftBody: string;
}

/**
 * Build the assistant-review save payload shared by the POST (new review) and
 * PATCH (edit review) endpoints.
 *
 * The `projectAssignment` block is included ONLY when the project was actually
 * corrected. The save routes treat any provided block as authoritative, so
 * sending an "unreviewed" block on a no-op save would wipe a prior project
 * confirmation and its reason signals — omitting the key makes the routes fall
 * back to the stored feedback, while the project verdict in `fieldFeedback`
 * still records a fresh confirm/correct signal.
 */
export function buildAssistantReviewPayload(input: AssistantReviewPayloadInput) {
  const { action, priority, category, projectId, finalStatus, replyFeedback, draftBody } =
    input;

  const projectCorrected = finalStatus.project === "corrected";
  const trimmedDraft = draftBody.trim();
  const reviewOutcome = deriveReviewOutcome(
    action,
    replyFeedback,
    Boolean(trimmedDraft),
  );

  return {
    assistantAction: action,
    assistantPriority: priority,
    assistantCategory: category.trim() || null,
    reviewOutcome,
    reviewerNote: null as string | null,
    draftBody: trimmedDraft || null,
    ...(projectCorrected
      ? {
          projectAssignment: {
            status: "incorrect" as const,
            correctedProjectId: projectId,
            reasonSignals: ["existing_project_context" as const],
            reasonNote: null as string | null,
          },
        }
      : {}),
    fieldFeedback: {
      action: statusToVerdict(finalStatus.action),
      priority: statusToVerdict(finalStatus.priority),
      category: statusToVerdict(finalStatus.category),
      project: statusToVerdict(finalStatus.project),
      draft: replyVerdict(replyFeedback),
    },
  };
}
