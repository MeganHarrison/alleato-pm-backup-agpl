import type { SubmittalWorkflowResponseStatus } from "../workflow-response-service";

interface AIReviewResponseCommentResult {
  summary: string | null;
  recommendation: string | null;
  checks: Array<{
    status:
      | "pass"
      | "fail"
      | "warning"
      | "missing_information"
      | "unable_to_determine"
      | "needs_human_review";
    title: string;
    finding: string;
    reviewerDisposition: "pending" | "accepted" | "dismissed" | "edited";
  }>;
}

export interface ParsedAIReviewResponseComment {
  summary: string | null;
  recommendation: string | null;
  findings: string[];
}

export function recommendedAIReviewWorkflowResponseStatus(
  result: AIReviewResponseCommentResult,
): SubmittalWorkflowResponseStatus {
  const unresolvedFailures = result.checks.some(
    (check) =>
      check.status === "fail" && check.reviewerDisposition !== "dismissed",
  );
  if (unresolvedFailures) return "Revise and Resubmit";

  const unresolvedWarnings = result.checks.some(
    (check) =>
      [
        "warning",
        "missing_information",
        "unable_to_determine",
        "needs_human_review",
      ].includes(check.status) &&
      !["accepted", "dismissed"].includes(check.reviewerDisposition),
  );
  if (unresolvedWarnings) return "Approved as Noted";

  return "Approved";
}

export function buildAIReviewResponseComment(
  result: AIReviewResponseCommentResult,
): string {
  const actionableChecks = result.checks.filter(
    (check) =>
      check.status !== "pass" && check.reviewerDisposition !== "dismissed",
  );
  const findingLines = actionableChecks
    .slice(0, 5)
    .map((check) => `- ${check.title}: ${check.finding}`);

  return [
    "AI review response context:",
    result.summary ? `Summary: ${result.summary}` : null,
    result.recommendation ? `Recommendation: ${result.recommendation}` : null,
    findingLines.length > 0 ? ["Findings:", ...findingLines].join("\n") : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function parseAIReviewResponseComment(
  comment: string | null | undefined,
): ParsedAIReviewResponseComment | null {
  if (!comment?.startsWith("AI review response context:")) return null;

  const summary = comment.match(/^Summary:\s*(.+)$/m)?.[1]?.trim() ?? null;
  const recommendation =
    comment.match(/^Recommendation:\s*(.+)$/m)?.[1]?.trim() ?? null;
  const findings = comment
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);
  const inlineContext = comment
    .slice("AI review response context:".length)
    .trim();

  return {
    summary:
      summary ??
      (recommendation || findings.length > 0 || !inlineContext
        ? null
        : inlineContext),
    recommendation,
    findings,
  };
}
