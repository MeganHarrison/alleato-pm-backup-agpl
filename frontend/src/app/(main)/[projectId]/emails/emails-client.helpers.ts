import type { ProjectEmail } from "@/hooks/use-emails";
import type { EmailImportanceFeedbackState } from "@/lib/ai/email-importance-feedback-types";

export const MAILBOX_REVIEW_REFETCH_INTERVAL_MS = 60 * 60 * 1000;
export const EMAIL_IMPORTANCE_DEFAULT_FILTER = "default" as const;

// Max email ids per importance-feedback request. That endpoint takes one
// `emailId` query param each, so a large mailbox (Brandon's has ~1000) would
// overflow the request URL/header size limit → HTTP 431, silently dropping the
// importance-training state for the whole inbox. 100 keeps each URL small.
export const IMPORTANCE_FEEDBACK_BATCH_SIZE = 100;

/**
 * Split email ids into request-sized batches so the importance-feedback GET URL
 * never overflows the header/URL size limit (which surfaces as HTTP 431) on
 * large mailboxes. Falls back to the default batch size for a non-positive size.
 */
export function chunkImportanceFeedbackEmailIds(
  emailIds: readonly string[],
  batchSize: number = IMPORTANCE_FEEDBACK_BATCH_SIZE,
): string[][] {
  const size =
    Number.isInteger(batchSize) && batchSize > 0
      ? batchSize
      : IMPORTANCE_FEEDBACK_BATCH_SIZE;
  const batches: string[][] = [];
  for (let index = 0; index < emailIds.length; index += size) {
    batches.push(emailIds.slice(index, index + size));
  }
  return batches;
}

export type EmailImportanceVisibilityFilter =
  | typeof EMAIL_IMPORTANCE_DEFAULT_FILTER
  | "all"
  | "important"
  | "not_important";

export function getEmailsRefreshInterval(
  isMailboxReviewMode: boolean,
): number | false {
  return isMailboxReviewMode ? MAILBOX_REVIEW_REFETCH_INTERVAL_MS : false;
}

export function reconcileSelectedEmail(
  emails: ProjectEmail[],
  selectedEmail: ProjectEmail | null,
): ProjectEmail | null {
  if (!selectedEmail) return null;
  return emails.find((email) => email.id === selectedEmail.id) ?? null;
}

export function normalizeEmailImportanceVisibilityFilter(
  value: string | null | undefined,
): EmailImportanceVisibilityFilter {
  return value === "all" || value === "important" || value === "not_important"
    ? value
    : EMAIL_IMPORTANCE_DEFAULT_FILTER;
}

export function matchesEmailImportanceVisibility(
  email: Pick<ProjectEmail, "id">,
  feedbackByEmailId: Record<string, EmailImportanceFeedbackState>,
  filter: EmailImportanceVisibilityFilter,
): boolean {
  const feedback = feedbackByEmailId[String(email.id)] ?? null;

  if (filter === "all") return true;
  if (filter === "important") return feedback?.signal === "important";
  if (filter === "not_important") {
    return feedback?.signal === "not_important";
  }

  return feedback?.signal !== "not_important";
}
