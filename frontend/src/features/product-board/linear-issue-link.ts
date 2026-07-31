import type { BoardItemMeta } from "./use-board-item";

const ISSUE_ID_PATTERN = /\b[A-Z]+-\d+\b/i;

export interface LinearIssueLink {
  url: string;
  label: string;
  issueId: string | null;
}

export function parseLinearIssueUrl(value: string): LinearIssueLink | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.hostname !== "linear.app" && !url.hostname.endsWith(".linear.app")) {
      return null;
    }

    const issueId = url.pathname.match(ISSUE_ID_PATTERN)?.[0]?.toUpperCase() ?? null;
    return {
      url: url.toString(),
      label: issueId ?? "Linear issue",
      issueId,
    };
  } catch {
    return null;
  }
}

export function getLinearIssueLink(meta: BoardItemMeta | null | undefined): LinearIssueLink | null {
  if (!meta) return null;

  if (typeof meta.linear_issue_url === "string") {
    const explicit = parseLinearIssueUrl(meta.linear_issue_url);
    if (explicit) {
      const explicitId =
        typeof meta.linear_issue_id === "string" && meta.linear_issue_id.trim()
          ? meta.linear_issue_id.trim().toUpperCase()
          : null;

      return {
        ...explicit,
        issueId: explicitId ?? explicit.issueId,
        label: explicitId ?? explicit.label,
      };
    }
  }

  const linearLink = meta.links?.find((link) => parseLinearIssueUrl(link.url));
  if (!linearLink) return null;

  const parsed = parseLinearIssueUrl(linearLink.url);
  if (!parsed) return null;

  return {
    ...parsed,
    label: parsed.issueId ?? linearLink.label,
  };
}
