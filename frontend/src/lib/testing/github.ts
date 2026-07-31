import { fetchWithGuardrails, WRITE_POLICY } from "@/lib/fetch-with-guardrails";

type GitHubIssuePayload = {
  title: string;
  body: string;
};

export type CreatedGitHubIssue = {
  number: number;
  url: string;
  state: string;
};

export type CreateTestFailureIssueInput = {
  testNumber: string;
  testName: string;
  category: string;
  subcategory: string | null;
  notes: string | null;
  severity: string | null;
  startUrl: string | null;
  expectedResult: string | null;
  steps: string | null;
  runId: string;
  runSlug: string | null;
  toolName: string | null;
  /** Propagated from the API route's x-request-id for distributed tracing. */
  requestId?: string;
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

function buildIssueBody(input: CreateTestFailureIssueInput): string {
  const lines: string[] = [
    "## Test Failure",
    "",
    `**Test:** \`${input.testNumber}\` — ${input.testName}`,
    `**Category:** ${input.category}${input.subcategory ? ` › ${input.subcategory}` : ""}`,
  ];

  if (input.severity) {
    lines.push(`**Severity:** ${input.severity}`);
  }

  if (input.toolName) {
    lines.push(`**Tool:** ${input.toolName}`);
  }

  lines.push(`**Run:** \`${input.runSlug ?? input.runId}\``);

  if (input.notes) {
    lines.push("", "## What Went Wrong", input.notes);
  }

  if (input.expectedResult) {
    lines.push("", "## Expected Result", input.expectedResult);
  }

  if (input.steps) {
    lines.push("", "## Steps to Reproduce", input.steps);
  }

  if (input.startUrl) {
    lines.push("", `## Start URL`, input.startUrl);
  }

  return lines.join("\n");
}

const GITHUB_HEADERS = (token: string) => ({
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  "X-GitHub-Api-Version": "2022-11-28",
});

async function postIssue(
  config: NonNullable<ReturnType<typeof getRepoConfig>>,
  payload: GitHubIssuePayload,
  requestId: string,
): Promise<CreatedGitHubIssue> {
  const response = await fetchWithGuardrails(
    `https://api.github.com/repos/${config.owner}/${config.repo}/issues`,
    {
      ...WRITE_POLICY,
      method: "POST",
      headers: GITHUB_HEADERS(config.token),
      body: JSON.stringify(payload),
      requestId,
      where: "lib/testing/github#postIssue",
      dependency: "github-api",
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

async function addLabels(
  config: NonNullable<ReturnType<typeof getRepoConfig>>,
  issueNumber: number,
  labels: string[],
  requestId: string,
) {
  await fetchWithGuardrails(
    `https://api.github.com/repos/${config.owner}/${config.repo}/issues/${issueNumber}/labels`,
    {
      ...WRITE_POLICY,
      method: "POST",
      headers: GITHUB_HEADERS(config.token),
      body: JSON.stringify({ labels }),
      requestId,
      where: "lib/testing/github#addLabels",
      dependency: "github-api",
    },
  );
}

async function addComment(
  config: NonNullable<ReturnType<typeof getRepoConfig>>,
  issueNumber: number,
  body: string,
  requestId: string,
) {
  // Posting "@claude" as a comment triggers the Claude Code Action to triage the failure.
  await fetchWithGuardrails(
    `https://api.github.com/repos/${config.owner}/${config.repo}/issues/${issueNumber}/comments`,
    {
      ...WRITE_POLICY,
      method: "POST",
      headers: GITHUB_HEADERS(config.token),
      body: JSON.stringify({ body }),
      requestId,
      where: "lib/testing/github#addComment",
      dependency: "github-api",
    },
  );
}

export async function createTestFailureGitHubIssue(
  input: CreateTestFailureIssueInput,
): Promise<CreatedGitHubIssue | null> {
  const config = getRepoConfig();
  if (!config) return null;

  const requestId = input.requestId ?? crypto.randomUUID();

  const severityPrefix = input.severity ? `[${input.severity.toUpperCase()}] ` : "";
  const title = `${severityPrefix}Test failure: ${input.testNumber} — ${input.testName}`;

  const issue = await postIssue(config, {
    title,
    body: buildIssueBody(input),
  }, requestId);

  const baseLabels = (process.env.GITHUB_FEEDBACK_LABELS ?? "admin-feedback")
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean);

  const labels = [...baseLabels, "test-failure"];
  if (input.severity) labels.push(`severity:${input.severity}`);

  try {
    await addLabels(config, issue.number, labels, requestId);
  } catch (err) {
    console.warn("[github] addLabels failed (non-fatal):", err);
  }

  try {
    await addComment(config, issue.number, "@claude", requestId);
  } catch (err) {
    console.warn("[github] addComment failed (non-fatal):", err);
  }

  return issue;
}
