import type { UIMessage } from "ai";

export const DURABLE_START_LEASE_MS = 30_000;

type ApprovalResponse = {
  id: string;
  approved: boolean;
};

function approvalResponse(
  part: UIMessage["parts"][number],
): ApprovalResponse | null {
  if (!("state" in part) || part.state !== "approval-responded") return null;
  if (!("approval" in part) || !part.approval) return null;

  const approval = part.approval as { id?: unknown; approved?: unknown };
  if (
    typeof approval.id !== "string" ||
    typeof approval.approved !== "boolean"
  ) {
    return null;
  }
  return { id: approval.id, approved: approval.approved };
}

/**
 * Returns a stable idempotency key for each transport submission.
 *
 * User submissions use the user message ID. Approval continuations keep the
 * assistant message ID but add the cumulative approval response set, so a
 * network replay deduplicates while a second governed approval starts a new
 * durable continuation.
 */
export function getDurableSubmissionId(
  message: UIMessage | undefined,
): string | undefined {
  if (!message || message.role === "user") return message?.id;

  const approvals = message.parts
    .map(approvalResponse)
    .filter((approval): approval is ApprovalResponse => approval !== null)
    .map(
      (approval) =>
        `${approval.id}:${approval.approved ? "approved" : "denied"}`,
    )
    .sort();

  return approvals.length > 0
    ? `${message.id}:approvals:${approvals.join(",")}`
    : message.id;
}

export function getDurableReconnectDisposition(
  status: string,
): "stream" | "complete" | "failed" {
  if (status === "completed") return "complete";
  if (status === "failed") return "failed";
  return "stream";
}

export function isDurableStartLeaseExpired(
  updatedAt: string,
  now = Date.now(),
): boolean {
  const updatedAtMs = Date.parse(updatedAt);
  return (
    Number.isFinite(updatedAtMs) && now - updatedAtMs >= DURABLE_START_LEASE_MS
  );
}
