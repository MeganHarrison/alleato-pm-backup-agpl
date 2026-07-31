import type {
  AdminFeedbackRequestType,
  AdminFeedbackSeverity,
} from "./constants";
import {
  ADMIN_FEEDBACK_REQUEST_TYPE_GITHUB_LABELS,
  ADMIN_FEEDBACK_REQUEST_TYPE_LABELS,
} from "./constants";
import type { ToolContextBundle } from "./context-resolver";

type GitHubIssuePayload = {
  title: string;
  body: string;
  labels?: string[];
};

export type CreateGitHubIssueInput = {
  title: string;
  comment: string;
  pageUrl: string;
  pagePath: string;
  pageTitle: string | null;
  requestType: AdminFeedbackRequestType;
  severity: AdminFeedbackSeverity;
  targetId: string | null;
  targetSelector: string;
  targetTag: string | null;
  targetText: string | null;
  domPath: string | null;
  screenshotUrl: string | null;
  projectId: number | null;
  metadata: Record<string, unknown>;
  /** Resolved tool context bundle — included when a tool match exists */
  toolContext?: ToolContextBundle | null;
};

export type CreatedGitHubIssue = {
  number: number;
  url: string;
  state: string;
};

function getRepoConfig() {
  const owner = process.env.GITHUB_FEEDBACK_REPO_OWNER;
  const repo = process.env.GITHUB_FEEDBACK_REPO_NAME;
  const token = process.env.GITHUB_FEEDBACK_TOKEN;

  if (!owner || !repo || !token) {
    return null;
  }

  return { owner, repo, token };
}

export function buildAdminFeedbackGitHubLabels(requestType: AdminFeedbackRequestType) {
  const baseLabels = (process.env.GITHUB_FEEDBACK_LABELS ?? "admin-feedback")
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);

  return [
    ...baseLabels,
    ADMIN_FEEDBACK_REQUEST_TYPE_GITHUB_LABELS[requestType],
  ];
}

function buildIssueBody(input: CreateGitHubIssueInput) {
  const payload = {
    pageUrl: input.pageUrl,
    pagePath: input.pagePath,
    pageTitle: input.pageTitle,
    requestType: input.requestType,
    severity: input.severity,
    projectId: input.projectId,
    targetId: input.targetId,
    targetSelector: input.targetSelector,
    targetTag: input.targetTag,
    targetText: input.targetText,
    domPath: input.domPath,
    screenshotUrl: input.screenshotUrl,
    metadata: input.metadata,
    comment: input.comment,
  };

  const lines = [
    "## Feedback",
    input.comment,
    "",
    "## Location",
    `- URL: ${input.pageUrl}`,
    `- Path: ${input.pagePath}`,
    `- Page title: ${input.pageTitle ?? "Unknown"}`,
    `- Project ID: ${input.projectId ?? "N/A"}`,
    "",
    "## Target",
    `- Stable target ID: ${input.targetId ?? "Not provided"}`,
    `- Selector: \`${input.targetSelector}\``,
    `- Tag: ${input.targetTag ?? "Unknown"}`,
    `- Text: ${input.targetText ?? "None"}`,
    `- DOM path: \`${input.domPath ?? "Unknown"}\``,
    "",
    "## Request",
    `- Type: ${ADMIN_FEEDBACK_REQUEST_TYPE_LABELS[input.requestType]} (${input.requestType})`,
    `- Severity: ${input.severity}`,
  ];

  if (input.screenshotUrl) {
    lines.push("", `## Screenshot`, `![Feedback screenshot](${input.screenshotUrl})`);
  }

  // Append tool context for agents if a tool was matched
  if (input.toolContext) {
    const ctx = input.toolContext;
    lines.push(
      "",
      "## Agent Context",
      "",
      `**Matched Tool:** ${ctx.tool_name} (${ctx.tool_category})`,
    );

    if (ctx.tool_description) {
      lines.push(`**Description:** ${ctx.tool_description}`);
    }

    if (ctx.procore_url) {
      lines.push(`**Procore URL:** ${ctx.procore_url}`);
    }

    lines.push(
      `**PRP:** \`${ctx.prp_path}\``,
      `**Research Folder:** \`${ctx.research_folder}\``,
      `**Crawl Manifest:** \`${ctx.manifest_path}\``,
      `**Screenshots:** \`${ctx.screenshots_folder}\``,
      "",
      "### Resolution Steps",
      "",
      ...ctx.resolution_steps,
      "",
      "### If More Detail Is Needed",
      "",
      "Run the Procore deep crawl to capture the latest field-level data:",
      "```bash",
      ctx.crawl_command,
      "```",
    );
  }

  lines.push(
    "",
    "## Agent Payload",
    "```json",
    JSON.stringify(payload, null, 2),
    "```",
  );

  return lines.join("\n");
}

async function postIssue(
  config: NonNullable<ReturnType<typeof getRepoConfig>>,
  payload: GitHubIssuePayload,
) {
  const response = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/issues`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub issue creation failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return {
    number: data.number as number,
    url: data.html_url as string,
    state: data.state as string,
  };
}

async function addIssueComment(
  config: NonNullable<ReturnType<typeof getRepoConfig>>,
  issueNumber: number,
  body: string,
) {
  const response = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/issues/${issueNumber}/comments`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ body }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub issue comment failed: ${response.status} ${errorText}`);
  }
}

async function addLabels(
  config: NonNullable<ReturnType<typeof getRepoConfig>>,
  issueNumber: number,
  labels: string[],
) {
  // Add labels in a separate call so the "labeled" event fires distinctly,
  // which is required for GitHub Actions workflows that trigger on labeled events.
  const response = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/issues/${issueNumber}/labels`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ labels }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub issue labeling failed: ${response.status} ${errorText}`);
  }
}

export async function createGitHubIssue(input: CreateGitHubIssueInput) {
  const config = getRepoConfig();
  if (!config) {
    return null;
  }

  const labels = buildAdminFeedbackGitHubLabels(input.requestType);

  // Create issue WITHOUT labels first
  const payload: GitHubIssuePayload = {
    title: input.title,
    body: buildIssueBody(input),
  };

  let issue: { number: number; url: string; state: string };

  try {
    issue = await postIssue(config, payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("Validation Failed")) {
      throw error;
    }
    issue = await postIssue(config, payload);
  }

  // Then add labels separately so the "labeled" event triggers the Claude workflow
  try {
    await addLabels(config, issue.number, labels);
  } catch (error) {
    console.warn(JSON.stringify({
      event: "admin_feedback_github_labels_failed",
      timestamp: new Date().toISOString(),
      issueNumber: issue.number,
      labels,
      error: error instanceof Error ? error.message : String(error),
    }));
  }

  return issue;
}

export type CreatedRepoIssueWithLabels = {
  issue: CreatedGitHubIssue;
  labelsApplied: boolean;
  labelError: string | null;
};

/**
 * Generic issue creator for callers that build their own body (the
 * admin-feedback-shaped {@link createGitHubIssue} is unsuitable for them —
 * e.g. the AI assistant's implementation-dispatch tool, whose body must match
 * the Autofix issue-form headings). Labels are added in a separate call so the
 * `labeled` event fires distinctly and triggers the autofix workflow. A label
 * failure is returned, not swallowed: for autofix dispatch an unlabeled issue
 * means the lane never starts, and the caller must surface that loudly.
 */
export async function createRepoIssueWithLabels(payload: {
  title: string;
  body: string;
  labels: string[];
}): Promise<CreatedRepoIssueWithLabels | null> {
  const config = getRepoConfig();
  if (!config) {
    return null;
  }

  const issue = await postIssue(config, {
    title: payload.title,
    body: payload.body,
  });

  if (payload.labels.length === 0) {
    return { issue, labelsApplied: true, labelError: null };
  }

  try {
    await addLabels(config, issue.number, payload.labels);
    return { issue, labelsApplied: true, labelError: null };
  } catch (error) {
    return {
      issue,
      labelsApplied: false,
      labelError: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Adds labels to an existing issue. Used by the dispatch route to hand an
 * issue to the autofix pipeline (`codex:fix` / `claude:fix` labels trigger
 * the Autofix Issue workflow).
 */
export async function addGitHubIssueLabels(issueNumber: number, labels: string[]) {
  const config = getRepoConfig();
  if (!config) {
    return false;
  }

  await addLabels(config, issueNumber, labels);
  return true;
}

/** Re-open a closed issue (used when a client disputes a "resolved" fix). */
export async function reopenGitHubIssue(issueNumber: number): Promise<boolean> {
  const config = getRepoConfig();
  if (!config) return false;

  try {
    const response = await fetch(
      `https://api.github.com/repos/${config.owner}/${config.repo}/issues/${issueNumber}`,
      {
        method: "PATCH",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ state: "open" }),
      },
    );
    return response.ok;
  } catch {
    return false;
  }
}

export type FeedbackIssueWriteHealth =
  | { ok: true }
  | {
      ok: false;
      code:
        | "not_configured"
        | "invalid_credentials"
        | "insufficient_permissions"
        | "repo_not_found"
        | "unknown";
      status: number | null;
      details?: string;
    };

/**
 * Verifies the configured feedback token can actually CREATE issues, WITHOUT
 * creating one. It POSTs an intentionally-invalid payload (empty title):
 * GitHub authorizes the token BEFORE validating the body, so
 *   - 422 (Unprocessable) → token HAS Issues:write; the body was rejected. Healthy.
 *   - 403 (Forbidden)     → token is valid but lacks Issues:write. THIS is the
 *                            failure that silently broke the feedback pipeline
 *                            when the fine-grained PAT's permission was dropped.
 *   - 401                 → bad/expired credentials.
 *   - 404                 → repo/owner misconfigured.
 * No issue is ever created (empty title always fails validation); as a defensive
 * measure, if GitHub ever returns 2xx we close the created issue immediately.
 */
export async function probeFeedbackIssueWritePermission(): Promise<FeedbackIssueWriteHealth> {
  const config = getRepoConfig();
  if (!config) {
    return { ok: false, code: "not_configured", status: null };
  }

  const response = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/issues`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      // Empty title is always rejected with 422 by a write-capable token.
      body: JSON.stringify({ title: "" }),
    },
  );

  // 422 = write allowed, payload rejected as designed → healthy.
  if (response.status === 422) {
    return { ok: true };
  }

  // Extremely unlikely (empty title should never succeed), but never leave a
  // stray probe issue behind if GitHub's validation ever changes.
  if (response.ok) {
    const created = await response.json().catch(() => null);
    const number = created?.number as number | undefined;
    if (number) {
      await fetch(
        `https://api.github.com/repos/${config.owner}/${config.repo}/issues/${number}`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${config.token}`,
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
          body: JSON.stringify({ state: "closed" }),
        },
      ).catch(() => {});
    }
    return { ok: true };
  }

  const details = (await response.text().catch(() => "")).slice(0, 300);

  if (response.status === 401) {
    return { ok: false, code: "invalid_credentials", status: 401, details };
  }
  if (response.status === 403) {
    return { ok: false, code: "insufficient_permissions", status: 403, details };
  }
  if (response.status === 404) {
    return { ok: false, code: "repo_not_found", status: 404, details };
  }
  return { ok: false, code: "unknown", status: response.status, details };
}

export async function addGitHubIssueComment(issueNumber: number, body: string) {
  const config = getRepoConfig();
  if (!config) {
    return false;
  }

  await addIssueComment(config, issueNumber, body);
  return true;
}

export type LinkedPullRequestStatus = {
  number: number;
  url: string;
  state: "open" | "closed";
  merged: boolean;
};

async function isPullRequestMerged(
  config: NonNullable<ReturnType<typeof getRepoConfig>>,
  pullNumber: number,
): Promise<boolean> {
  const response = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/pulls/${pullNumber}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${config.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (!response.ok) {
    return false;
  }

  const data = await response.json();
  return Boolean(data.merged);
}

/**
 * Finds pull requests that reference the given issue number (via a
 * "Closes #N" style closing keyword or a plain mention) so the feedback
 * inbox can reflect PR-created / merged state without a live webhook.
 *
 * NOTE: prefer {@link buildFeedbackPullRequestIndex} for bulk reconciliation.
 * This per-issue variant issues one GitHub *search* call per issue, which
 * exhausts the 30-req/min Search API limit when run across the whole inbox
 * (the failure that silently froze every feedback item at `submitted`).
 * Retained for single-item lookups only.
 */
export async function findLinkedPullRequests(
  issueNumber: number,
): Promise<LinkedPullRequestStatus[] | null> {
  const config = getRepoConfig();
  if (!config) {
    return null;
  }

  const query = `repo:${config.owner}/${config.repo} type:pr "#${issueNumber}"`;
  const response = await fetch(
    `https://api.github.com/search/issues?q=${encodeURIComponent(query)}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${config.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`GitHub PR search failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const items: unknown[] = Array.isArray(data.items) ? data.items : [];

  const results: LinkedPullRequestStatus[] = [];
  for (const raw of items) {
    const item = raw as {
      pull_request?: unknown;
      number: number;
      html_url: string;
      state: string;
      title?: string;
      body?: string | null;
    };
    if (!item.pull_request) continue;
    // GitHub's quoted search on `#N` is fuzzy (it ignores `#`, matches unrelated
    // PRs, or `#57` matching `#571`) and includes bare mentions. Keep only PRs
    // that actually CLOSE this issue via a closing keyword.
    if (!extractClosingIssueNumbers(`${item.title ?? ""}\n${item.body ?? ""}`).includes(issueNumber)) {
      continue;
    }

    if (item.state === "closed") {
      const merged = await isPullRequestMerged(config, item.number);
      results.push({ number: item.number, url: item.html_url, state: "closed", merged });
    } else {
      results.push({ number: item.number, url: item.html_url, state: "open", merged: false });
    }
  }

  return results;
}

/**
 * True when `text` contains an exact, word-boundary reference to `#issueNumber`
 * (so `#57` does NOT match `#571`). Used to filter GitHub's fuzzy PR search.
 */
export function referencesIssue(text: string, issueNumber: number): boolean {
  return new RegExp(`#${issueNumber}(?!\\d)`).test(text);
}

/** All distinct issue numbers referenced by `#N` tokens in a PR title/body. */
export function extractReferencedIssueNumbers(text: string): number[] {
  const found = new Set<number>();
  for (const match of text.matchAll(/#(\d+)(?!\d)/g)) {
    const n = Number.parseInt(match[1], 10);
    if (Number.isFinite(n) && n > 0) found.add(n);
  }
  return [...found];
}

// A PR "fixes" an item only when it uses a GitHub closing keyword before the
// reference. A bare mention (e.g. an autofix infra PR that says "similar to
// #570 …") must NOT link, or unrelated PRs would falsely resolve items.
const CLOSING_REF = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)(?!\d)/gi;

/**
 * Issue numbers this text CLOSES via a GitHub closing keyword
 * (`Closes/Fixes/Resolves #N`). This is the reliable "this PR fixes issue N"
 * signal — bare `#N` mentions are deliberately excluded.
 */
export function extractClosingIssueNumbers(text: string): number[] {
  const found = new Set<number>();
  for (const match of text.matchAll(CLOSING_REF)) {
    const n = Number.parseInt(match[1], 10);
    if (Number.isFinite(n) && n > 0) found.add(n);
  }
  return [...found];
}

export type FeedbackPullRequestIndex = Map<
  number,
  { mergedPr?: LinkedPullRequestStatus; openPr?: LinkedPullRequestStatus }
>;

/**
 * Builds an issue-number → linked-PR index in a bounded number of REST calls
 * (a few list pages), instead of one Search API call per issue. This is the
 * bulk primitive the reconciliation cron uses so it never trips the Search
 * rate limit. Every open PR and the most-recently-updated closed PRs are
 * scanned; each PR's title+body is parsed for exact `#N` references.
 */
export async function buildFeedbackPullRequestIndex(
  maxClosedPages = 3,
): Promise<FeedbackPullRequestIndex | null> {
  const config = getRepoConfig();
  if (!config) {
    return null;
  }

  const index: FeedbackPullRequestIndex = new Map();

  const listPulls = async (state: "open" | "closed", pages: number) => {
    const out: Array<{
      number: number;
      html_url: string;
      state: string;
      title: string;
      body: string | null;
      merged_at: string | null;
    }> = [];
    for (let page = 1; page <= pages; page++) {
      const response = await fetch(
        `https://api.github.com/repos/${config.owner}/${config.repo}/pulls?state=${state}&sort=updated&direction=desc&per_page=100&page=${page}`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${config.token}`,
            "X-GitHub-Api-Version": "2022-11-28",
          },
        },
      );
      if (!response.ok) {
        throw new Error(
          `GitHub PR list failed (${state} p${page}): ${response.status} ${await response.text()}`,
        );
      }
      const batch = (await response.json()) as typeof out;
      if (!Array.isArray(batch) || batch.length === 0) break;
      out.push(...batch);
      if (batch.length < 100) break;
    }
    return out;
  };

  const record = (
    issueNumber: number,
    pr: LinkedPullRequestStatus,
  ) => {
    const entry = index.get(issueNumber) ?? {};
    if (pr.merged) {
      // Keep the first (most recent) merged PR seen.
      entry.mergedPr = entry.mergedPr ?? pr;
    } else if (pr.state === "open") {
      entry.openPr = entry.openPr ?? pr;
    }
    index.set(issueNumber, entry);
  };

  const openPulls = await listPulls("open", 2);
  const closedPulls = await listPulls("closed", maxClosedPages);

  for (const pr of [...openPulls, ...closedPulls]) {
    // Only a closing keyword ("Closes #N") links a PR to a feedback item —
    // bare mentions in prose would false-positive against unrelated PRs.
    const refs = extractClosingIssueNumbers(`${pr.title}\n${pr.body ?? ""}`);
    if (refs.length === 0) continue;
    const status: LinkedPullRequestStatus = {
      number: pr.number,
      url: pr.html_url,
      state: pr.state === "open" ? "open" : "closed",
      merged: Boolean(pr.merged_at),
    };
    for (const issueNumber of refs) {
      record(issueNumber, status);
    }
  }

  return index;
}

export type GitHubIssueExistence = "exists" | "deleted" | "unknown";

/**
 * Reports whether a feedback item's linked GitHub issue still exists. Deleted
 * issues (HTTP 410) — a recurring cause of permanently-stuck inbox items —
 * are reported distinctly so the sync can surface the broken link instead of
 * leaving the item frozen at `submitted` forever.
 */
export async function checkGitHubIssueExistence(
  issueNumber: number,
): Promise<GitHubIssueExistence> {
  const config = getRepoConfig();
  if (!config) {
    return "unknown";
  }

  const response = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/issues/${issueNumber}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${config.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (response.ok) return "exists";
  if (response.status === 410 || response.status === 404) return "deleted";
  return "unknown";
}

export type RepoIssueSnapshot = {
  existence: GitHubIssueExistence;
  state: "open" | "closed" | null;
  labels: string[];
};

/**
 * Richer sibling of {@link checkGitHubIssueExistence} for callers that also
 * need the issue's open/closed state and labels (e.g. the assistant's
 * `getImplementationStatus` read tool, which must detect the
 * `autofix:needs-human` escalation label). One REST GET per issue — the plain
 * core rate limit, NOT the 30-req/min Search API this file warns about.
 */
export async function getRepoIssueSnapshot(
  issueNumber: number,
): Promise<RepoIssueSnapshot> {
  const config = getRepoConfig();
  if (!config) {
    return { existence: "unknown", state: null, labels: [] };
  }

  const response = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/issues/${issueNumber}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${config.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (response.status === 410 || response.status === 404) {
    return { existence: "deleted", state: null, labels: [] };
  }
  if (!response.ok) {
    return { existence: "unknown", state: null, labels: [] };
  }

  const data = await response.json();
  const labels = Array.isArray(data.labels)
    ? data.labels
        .map((label: unknown) =>
          typeof label === "string"
            ? label
            : ((label as { name?: unknown } | null)?.name ?? null),
        )
        .filter((name: unknown): name is string => typeof name === "string")
    : [];

  return {
    existence: "exists",
    state: data.state === "open" ? "open" : "closed",
    labels,
  };
}

const VERCEL_PREVIEW_URL_PATTERN = /https:\/\/[a-z0-9][a-z0-9.-]*\.vercel\.app\b/i;

/**
 * Finds the Vercel preview URL for a pull request by scanning its comments
 * (the Vercel bot posts the deployment link there). Returns null when GitHub
 * is unconfigured, the request fails, or no vercel.app link exists — callers
 * should present "preview unavailable" rather than guessing a URL.
 */
export async function findPullRequestPreviewUrl(
  prNumber: number,
): Promise<string | null> {
  const config = getRepoConfig();
  if (!config) return null;

  const response = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/issues/${prNumber}/comments?per_page=30`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${config.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  if (!response.ok) return null;

  const comments = await response.json();
  if (!Array.isArray(comments)) return null;

  for (const comment of comments) {
    const body = (comment as { body?: unknown } | null)?.body;
    const match = typeof body === "string" ? body.match(VERCEL_PREVIEW_URL_PATTERN) : null;
    if (match) return match[0];
  }
  return null;
}
