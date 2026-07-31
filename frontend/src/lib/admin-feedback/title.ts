import {
  ADMIN_FEEDBACK_REQUEST_TYPE_LABELS,
  type AdminFeedbackRequestType,
} from "./constants";

function compactText(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}...`;
}

function typeLabel(requestType: string) {
  if (requestType in ADMIN_FEEDBACK_REQUEST_TYPE_LABELS) {
    return ADMIN_FEEDBACK_REQUEST_TYPE_LABELS[requestType as AdminFeedbackRequestType];
  }

  return requestType.charAt(0).toUpperCase() + requestType.slice(1);
}

export function buildAdminFeedbackTitle({
  providedTitle,
  requestType,
  comment,
  targetText,
  pageTitle,
}: {
  providedTitle?: string | null;
  requestType: string;
  comment: string;
  targetText?: string | null;
  pageTitle?: string | null;
}) {
  const explicitTitle = compactText(providedTitle);
  if (explicitTitle) {
    return truncate(explicitTitle, 200);
  }

  const commentSummary = compactText(comment);
  if (commentSummary) {
    return truncate(commentSummary, 160);
  }

  const fallback = compactText(targetText) || compactText(pageTitle) || "page element";
  return truncate(`${typeLabel(requestType)}: ${fallback}`, 160);
}

export function displayAdminFeedbackTitle({
  storedTitle,
  requestType,
  comment,
  targetText,
  pageTitle,
}: {
  storedTitle: string;
  requestType: string;
  comment: string;
  targetText?: string | null;
  pageTitle?: string | null;
}) {
  const normalizedStoredTitle = compactText(storedTitle);
  const legacyTargetTitle = `${typeLabel(requestType)}: ${compactText(targetText)}`;

  if (
    normalizedStoredTitle &&
    legacyTargetTitle.trim() !== `${typeLabel(requestType)}:` &&
    legacyTargetTitle.startsWith(normalizedStoredTitle)
  ) {
    return buildAdminFeedbackTitle({
      requestType,
      comment,
      targetText,
      pageTitle,
    });
  }

  return normalizedStoredTitle || buildAdminFeedbackTitle({
    requestType,
    comment,
    targetText,
    pageTitle,
  });
}

/**
 * When no explicit title was submitted, the display title falls back to a
 * truncated copy of the comment — showing both in a list row just repeats
 * the same text twice. True when the comment adds nothing the title doesn't
 * already show.
 */
export function isCommentRedundantWithTitle(
  displayTitle: string,
  comment: string | null | undefined,
): boolean {
  const normalizedComment = compactText(comment);
  if (!normalizedComment) return true;

  const normalizedTitle = compactText(displayTitle).replace(/\.\.\.$/, "");
  return normalizedComment.startsWith(normalizedTitle);
}
