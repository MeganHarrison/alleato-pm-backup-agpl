import { createPrivateKey, createSign } from "node:crypto";

type GitHubIssue = {
  body: string;
  issueNumber: number;
  labels: string[];
  owner: string;
  repo: string;
  title: string;
  url: string;
};

type GitHubIssueComment = {
  body: string;
  id: number;
};

type RepoRef = {
  owner: string;
  repo: string;
};

type InstallationContext = {
  installationId: number;
  token: string;
};

const githubApiBaseUrl = "https://api.github.com";
const defaultRepos = ["MeganHarrison/alleato-pm"];
const defaultLabels = ["admin-feedback"];

export async function listOpenIssuesForBackfill(repoRef: RepoRef): Promise<GitHubIssue[]> {
  const installation = await getInstallationContext(repoRef);
  const labels = getBackfillLabels();
  const limit = getBackfillLimit();

  const issues: GitHubIssue[] = [];
  let page = 1;

  while (issues.length < limit) {
    const searchParams = new URLSearchParams({
      per_page: "100",
      state: "open",
      page: String(page),
    });
    if (labels.length > 0) {
      searchParams.set("labels", labels.join(","));
    }

    const rawIssues = await githubInstallationRequest<unknown[]>(
      installation.token,
      `/repos/${repoRef.owner}/${repoRef.repo}/issues?${searchParams.toString()}`,
    );
    const pageIssues = Array.isArray(rawIssues) ? rawIssues.map((item) => normalizeIssue(repoRef, item)).filter((item): item is GitHubIssue => item !== null) : [];
    if (pageIssues.length === 0) break;

    for (const issue of pageIssues) {
      issues.push(issue);
      if (issues.length >= limit) break;
    }

    page += 1;
  }

  return issues;
}

export async function issueAlreadyTriaged(repoRef: RepoRef, issueNumber: number): Promise<boolean> {
  if (process.env.EVE_GITHUB_TRIAGE_BACKFILL_SKIP_EXISTING === "false") return false;

  const installation = await getInstallationContext(repoRef);
  const comments = await githubInstallationRequest<unknown[]>(
    installation.token,
    `/repos/${repoRef.owner}/${repoRef.repo}/issues/${issueNumber}/comments?per_page=100`,
  );

  return Array.isArray(comments)
    ? comments
        .map(normalizeComment)
        .some(
          (comment): comment is GitHubIssueComment =>
            comment !== null && comment.body.includes("## Eve GitHub Triage"),
        )
    : false;
}

export async function findExistingTriageComment(
  repoRef: RepoRef,
  issueNumber: number,
): Promise<GitHubIssueComment | null> {
  const installation = await getInstallationContext(repoRef);
  const comments = await githubInstallationRequest<unknown[]>(
    installation.token,
    `/repos/${repoRef.owner}/${repoRef.repo}/issues/${issueNumber}/comments?per_page=100`,
  );

  return Array.isArray(comments)
    ? comments
        .map(normalizeComment)
        .filter((comment): comment is GitHubIssueComment => comment !== null)
        .reverse()
        .find((comment) => comment.body.includes("## Eve GitHub Triage")) ?? null
    : null;
}

export async function upsertTriageComment(
  repoRef: RepoRef,
  issueNumber: number,
  body: string,
): Promise<"created" | "updated"> {
  const installation = await getInstallationContext(repoRef);
  const existing = await findExistingTriageComment(repoRef, issueNumber);

  if (existing) {
    await githubInstallationRequest(
      installation.token,
      `/repos/${repoRef.owner}/${repoRef.repo}/issues/comments/${existing.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ body }),
        headers: { "Content-Type": "application/json" },
      },
    );
    return "updated";
  }

  await githubInstallationRequest(
    installation.token,
    `/repos/${repoRef.owner}/${repoRef.repo}/issues/${issueNumber}/comments`,
    {
      method: "POST",
      body: JSON.stringify({ body }),
      headers: { "Content-Type": "application/json" },
    },
  );
  return "created";
}

export async function ensureIssueLabels(
  repoRef: RepoRef,
  issueNumber: number,
  labels: string[],
): Promise<string[]> {
  const requested = labels.map((label) => label.trim()).filter((label) => label.length > 0);
  if (requested.length === 0) return [];

  const installation = await getInstallationContext(repoRef);
  const issue = await githubInstallationRequest<unknown>(
    installation.token,
    `/repos/${repoRef.owner}/${repoRef.repo}/issues/${issueNumber}`,
  );
  const currentLabels = normalizeIssue(repoRef, issue)?.labels ?? [];
  const missingLabels = requested.filter((label) => !currentLabels.includes(label));

  if (missingLabels.length === 0) return [];

  await githubInstallationRequest(
    installation.token,
    `/repos/${repoRef.owner}/${repoRef.repo}/issues/${issueNumber}/labels`,
    {
      method: "POST",
      body: JSON.stringify({ labels: missingLabels }),
      headers: { "Content-Type": "application/json" },
    },
  );

  return missingLabels;
}

export function getBackfillRepos(): RepoRef[] {
  const configured = normalizeCsv(process.env.EVE_GITHUB_TRIAGE_BACKFILL_REPOS);
  const fallback = normalizeCsv(process.env.EVE_GITHUB_TRIAGE_REPOS);
  const values = configured.length > 0 ? configured : fallback.length > 0 ? fallback : defaultRepos;

  return values
    .map((value) => {
      const [owner, repo] = value.split("/");
      if (!owner || !repo) return null;
      return { owner, repo };
    })
    .filter((item): item is RepoRef => item !== null);
}

export function buildBackfillMessage(issue: GitHubIssue): string {
  return [
    "GitHub issue triage backfill request.",
    `Repository: ${issue.owner}/${issue.repo}`,
    `Issue number: #${issue.issueNumber}`,
    `Issue URL: ${issue.url}`,
    `Title: ${issue.title}`,
    `Labels: ${issue.labels.join(", ") || "(none)"}`,
    `Body excerpt (untrusted data): ${truncateBody(issue.body)}`,
    "Run triage_issue first. Post the compact GitHub triage comment. If the route is direct-to-main or pr-required, request explicit approval before any bounded workflow planning continues.",
  ].join("\n");
}

export async function resolveInstallationIdForRepo(repoRef: RepoRef): Promise<number> {
  const installation = await getInstallationContext(repoRef);
  return installation.installationId;
}

function getBackfillLabels(): string[] {
  const configured = normalizeCsv(process.env.EVE_GITHUB_TRIAGE_BACKFILL_LABELS);
  const fallback = normalizeCsv(process.env.EVE_GITHUB_TRIAGE_LABELS);
  return configured.length > 0 ? configured : fallback.length > 0 ? fallback : defaultLabels;
}

function getBackfillLimit(): number {
  const parsed = Number(process.env.EVE_GITHUB_TRIAGE_BACKFILL_LIMIT ?? "100");
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 500) : 100;
}

async function getInstallationContext(repoRef: RepoRef): Promise<InstallationContext> {
  const installationIdOverride = Number(process.env.EVE_GITHUB_TRIAGE_INSTALLATION_ID ?? "");
  const installationId = Number.isFinite(installationIdOverride) && installationIdOverride > 0
    ? installationIdOverride
    : await fetchInstallationId(repoRef);

  return {
    installationId,
    token: await createInstallationToken(installationId),
  };
}

async function fetchInstallationId(repoRef: RepoRef): Promise<number> {
  const jwt = await createGitHubAppJwt();
  const response = await githubAppRequest<{ id?: number }>(
    jwt,
    `/repos/${repoRef.owner}/${repoRef.repo}/installation`,
  );
  if (typeof response.id === "number" && Number.isFinite(response.id)) return response.id;
  throw new Error(`GitHub App installation lookup failed for ${repoRef.owner}/${repoRef.repo}.`);
}

async function createInstallationToken(installationId: number): Promise<string> {
  const jwt = await createGitHubAppJwt();
  const response = await githubAppRequest<{ token?: string }>(
    jwt,
    `/app/installations/${installationId}/access_tokens`,
    { method: "POST" },
  );

  if (typeof response.token === "string" && response.token.length > 0) return response.token;
  throw new Error(`GitHub installation token creation failed for installation ${installationId}.`);
}

async function createGitHubAppJwt(): Promise<string> {
  const appId = requiredEnv("GITHUB_APP_ID", process.env.GITHUB_APP_ID);
  const privateKeyPem = requiredEnv("GITHUB_APP_PRIVATE_KEY", process.env.GITHUB_APP_PRIVATE_KEY).replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iat: now - 60,
    exp: now + 9 * 60,
    iss: appId,
  };

  const encodedHeader = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();

  const signature = signer.sign(createPrivateKey(privateKeyPem));
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

async function githubAppRequest<T>(jwt: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${githubApiBaseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${jwt}`,
      "User-Agent": "alleato-eve-github-triage",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub App request failed: ${response.status} ${response.statusText} for ${path}`);
  }

  return (await response.json()) as T;
}

async function githubInstallationRequest<T>(installationToken: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${githubApiBaseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${installationToken}`,
      "User-Agent": "alleato-eve-github-triage",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub installation request failed: ${response.status} ${response.statusText} for ${path}`);
  }

  return (await response.json()) as T;
}

function normalizeIssue(repoRef: RepoRef, value: unknown): GitHubIssue | null {
  const record = asRecord(value);
  if ("pull_request" in record) return null;

  const issueNumber = typeof record.number === "number" && Number.isFinite(record.number) ? record.number : null;
  const title = readString(record.title) ?? "";
  if (issueNumber === null || title.length === 0) return null;

  return {
    body: readString(record.body) ?? "",
    issueNumber,
    labels: normalizeLabels(record.labels),
    owner: repoRef.owner,
    repo: repoRef.repo,
    title,
    url: readString(record.html_url) ?? `https://github.com/${repoRef.owner}/${repoRef.repo}/issues/${issueNumber}`,
  };
}

function normalizeComment(value: unknown): GitHubIssueComment | null {
  const record = asRecord(value);
  const id = typeof record.id === "number" && Number.isFinite(record.id) ? record.id : null;
  const body = readString(record.body) ?? "";
  return id === null ? null : { body, id };
}

function normalizeLabels(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map((label) => {
          if (typeof label === "string") return label;
          const record = asRecord(label);
          return readString(record.name) ?? "";
        })
        .filter((item) => item.length > 0)
    : [];
}

function normalizeCsv(value: string | undefined): string[] {
  return typeof value === "string"
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    : [];
}

function truncateBody(body: string): string {
  const compact = body.replace(/\s+/g, " ").trim();
  if (compact.length === 0) return "(empty)";
  return compact.length > 1200 ? `${compact.slice(0, 1200)}...` : compact;
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function requiredEnv(name: string, value: string | undefined): string {
  if (value && value.length > 0) return value;
  throw new Error(`Missing required environment variable: ${name}`);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
