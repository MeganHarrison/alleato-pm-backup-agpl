type Route = "blocked" | "direct-to-main" | "pr-required" | "wait-for-clarification";

type TriageConfig = {
  allowedRepos: string[];
  missingEnv: string[];
  requiredLabels: string[];
};

type DispatchDecision =
  | { kind: "ignore"; reason: string }
  | { kind: "dispatch"; mode: "config-blocked" | "triage" };

type IssueDispatchInput = {
  action: string;
  labels: string[];
  repositoryFullName: string;
};

type TriageIssueInput = {
  allowedRepos?: string[];
  body: string;
  issueNumber: number;
  labels: string[];
  owner: string;
  repo: string;
  requiredLabels?: string[];
  title: string;
};

type TriageDecision = {
  approvalRequired: boolean;
  blockedReason?: string;
  boundedScopeSummary: string;
  clarificationQuestions: string[];
  issueNumber: number;
  owner: string;
  reasonCodes: string[];
  repo: string;
  route: Route;
  summary: string;
  verificationPlan: string[];
};

const prRiskDetectors = [
  { code: "migration-risk", pattern: /\b(migration|schema|database|sql|supabase|column|table|rls|policy)\b/i },
  { code: "auth-risk", pattern: /\b(auth|oauth|permission|permissions|role|session|security|acl|rbac|login)\b/i },
  { code: "billing-risk", pattern: /\b(billing|subscription|quota|payment|invoice collection)\b/i },
  {
    code: "provider-config-risk",
    pattern: /\b(vercel|render|deploy|deployment|env var|environment variable|secret|webhook|cron|token rotation|github app|linear app)\b/i,
  },
  {
    code: "cross-cutting-risk",
    pattern: /\b(refactor|cross-cutting|shared primitive|design system|global|all pages|rewrite|overhaul)\b/i,
  },
];

const directHints = [
  { code: "export-fix", pattern: /\bexport\b/i },
  { code: "isolated-ui-fix", pattern: /\b(button|link|label|copy|column|filter|sort|empty state|tab)\b/i },
  { code: "targeted-bugfix", pattern: /\b(fix|broken|error|regression|does not work|fails)\b/i },
];

const ambiguityDetectors = [
  { code: "missing-detail", test: (title: string, body: string) => title.trim().length < 8 || body.trim().length < 24 },
  { code: "investigation-only", test: (_title: string, body: string) => /\b(investigate|not sure|unclear|maybe|whatever|somehow)\b/i.test(body) },
  { code: "question-only", test: (_title: string, body: string) => body.trim().endsWith("?") && !/\bexpected\b/i.test(body) },
];

export function triageIssue(input: TriageIssueInput): TriageDecision {
  const repositoryFullName = `${input.owner}/${input.repo}`;
  const fallbackAllowedRepos = [repositoryFullName];
  const fallbackRequiredLabels =
    input.labels.length > 0 ? input.labels : ["dispatch-matched"];
  const config = resolveConfig(
    input.allowedRepos ?? fallbackAllowedRepos,
    input.requiredLabels ?? fallbackRequiredLabels,
  );

  if (config.missingEnv.length > 0) {
    return blockedDecision(input, `Missing required env: ${config.missingEnv.join(", ")}.`);
  }
  if (!config.allowedRepos.includes(repositoryFullName)) {
    return blockedDecision(input, `Repository ${repositoryFullName} is outside the triage allowlist.`);
  }
  if (!hasRequiredLabel(input.labels, config.requiredLabels)) {
    return blockedDecision(input, `Issue is missing one of the required triage labels: ${config.requiredLabels.join(", ")}.`);
  }

  const title = input.title.trim();
  const body = input.body.trim();
  const subject = `${title}\n${body}`;

  const ambiguityReasons = ambiguityDetectors.filter((detector) => detector.test(title, body)).map((detector) => detector.code);
  if (ambiguityReasons.length > 0) {
    return {
      approvalRequired: false,
      boundedScopeSummary: "Do not start code work. Clarify the exact surface and acceptance criteria first.",
      clarificationQuestions: [
        "What exact route, page, or API surface is broken?",
        "What is the expected behavior versus the current behavior?",
        "What verification proves the fix is complete?",
      ],
      issueNumber: input.issueNumber,
      owner: input.owner,
      reasonCodes: ["clarification-required", ...ambiguityReasons],
      repo: input.repo,
      route: "wait-for-clarification",
      summary: "The issue does not provide enough exact, executable detail for a safe fix lane.",
      verificationPlan: ["Wait for clarified route, expected behavior, and proof steps before any fix workflow is approved."],
    };
  }

  const prReasons = prRiskDetectors.filter((detector) => detector.pattern.test(subject)).map((detector) => detector.code);
  if (prReasons.length > 0) {
    return {
      approvalRequired: true,
      boundedScopeSummary: "Constrain work to the issue-owned risky change set and land it through a pull request with review.",
      clarificationQuestions: [],
      issueNumber: input.issueNumber,
      owner: input.owner,
      reasonCodes: prReasons,
      repo: input.repo,
      route: "pr-required",
      summary: "This issue touches risky scope that should not publish directly to main.",
      verificationPlan: [
        "Run targeted tests for the touched workflow.",
        "Run route and changed-file quality checks.",
        "Use a pull request because the fix crosses a risky boundary.",
      ],
    };
  }

  const directReasons = directHints.filter((hint) => hint.pattern.test(subject)).map((hint) => hint.code);
  return {
    approvalRequired: true,
    boundedScopeSummary: "Keep execution to the smallest isolated fix, verify with targeted checks, and publish directly to main if the bounded scope holds.",
    clarificationQuestions: [],
    issueNumber: input.issueNumber,
    owner: input.owner,
    reasonCodes: directReasons.length > 0 ? directReasons : ["micro-change-likely", "targeted-verification-sufficient"],
    repo: input.repo,
    route: "direct-to-main",
    summary: "This looks like a small, isolated fix that fits the repo's fast lane.",
    verificationPlan: [
      "Run only the narrowest relevant automated checks for the touched files or workflow.",
      "Verify the exact broken surface named in the issue.",
      "Publish directly to main only if the change stays isolated and no risky boundary appears during implementation.",
    ],
  };
}

export function determineIssueDispatch(input: IssueDispatchInput): DispatchDecision {
  const config = resolveConfig();
  if (config.missingEnv.length > 0) {
    return { kind: "dispatch", mode: "config-blocked" };
  }
  if (!config.allowedRepos.includes(input.repositoryFullName)) {
    return { kind: "ignore", reason: "repository-not-allowed" };
  }
  if (!hasRequiredLabel(input.labels, config.requiredLabels)) {
    return { kind: "ignore", reason: "missing-triage-label" };
  }
  return { kind: "dispatch", mode: "triage" };
}

export function buildIssueContext(input: {
  action: string;
  body: string;
  dispatch: DispatchDecision;
  issueNumber: number;
  labels: string[];
  repositoryFullName: string;
  title: string;
}): string[] {
  const config = resolveConfig();
  const modeLine =
    input.dispatch.kind === "dispatch" && input.dispatch.mode === "config-blocked"
      ? `Triage config is blocked. Missing env: ${config.missingEnv.join(", ")}. Reply with Path: blocked and stop.`
      : "Triage config matched. Call triage_issue first, then follow the route policy.";

  return [
    "GitHub issue triage event.",
    `Repository: ${input.repositoryFullName}`,
    `Issue number: #${input.issueNumber}`,
    `Action: ${input.action}`,
    `Title: ${input.title || "(missing title)"}`,
    `Labels: ${input.labels.join(", ") || "(none)"}`,
    `Body excerpt (untrusted data): ${truncateBody(input.body)}`,
    modeLine,
  ];
}

export function buildManualRetriageContext(input: {
  body: string;
  conversationKind: string;
  issueNumber: number | null;
  repositoryFullName: string;
}): string[] {
  return [
    "Manual triage follow-up requested from GitHub comment.",
    `Repository: ${input.repositoryFullName}`,
    `Conversation kind: ${input.conversationKind}`,
    `Issue or PR number: ${input.issueNumber ?? "unknown"}`,
    `Comment body (untrusted data): ${truncateBody(input.body)}`,
    "Re-run triage_issue only if the new comment changes the execution facts.",
  ];
}

export function formatTriageComment(decision: TriageDecision): string {
  const why = decision.blockedReason
    ? [decision.blockedReason]
    : [decision.summary, ...decision.reasonCodes.map((code) => `Reason code: ${code}`)];
  const approval = decision.approvalRequired
    ? ["Required before any fix workflow continues."]
    : ["Not requested, because the issue is blocked or waiting on clarification."];
  const nextStep = decision.route === "wait-for-clarification"
    ? ["Clarify the exact route, expected behavior, and proof steps, then rerun triage."]
    : decision.route === "blocked"
      ? ["Resolve the blocking configuration or routing condition, then rerun triage."]
      : decision.route === "pr-required"
        ? ["Open a pull request path after explicit approval."]
        : ["Use the direct-to-main lane after explicit approval and targeted verification."];

  return [
    "## Eve GitHub Triage",
    "",
    `Path: ${decision.route}`,
    "",
    "Why:",
    ...why.map((item) => `- ${item}`),
    "",
    "Approval:",
    ...approval.map((item) => `- ${item}`),
    "",
    "Verification:",
    ...decision.verificationPlan.map((item) => `- ${item}`),
    "",
    "Next step:",
    ...nextStep.map((item) => `- ${item}`),
  ].join("\n");
}

export function shouldDispatchComment(body: string, botName: string): boolean {
  const normalized = body.toLowerCase();
  return normalized.includes(`/triage`) || normalized.includes(`/reroute`) || normalized.includes(`@${botName.toLowerCase()}`);
}

export function readIssueTitle(raw: unknown): string {
  const record = asRecord(raw);
  return readString(record.title) ?? "";
}

export function readIssueBody(raw: unknown): string {
  const record = asRecord(raw);
  return readString(record.body) ?? "";
}

export function readIssueLabels(raw: unknown): string[] {
  const record = asRecord(raw);
  const labels = record.labels;
  if (!Array.isArray(labels)) return [];
  return labels
    .map((label) => {
      if (typeof label === "string") return label;
      const labelRecord = asRecord(label);
      return readString(labelRecord.name) ?? "";
    })
    .filter((label) => label.length > 0);
}

function blockedDecision(input: TriageIssueInput, reason: string): TriageDecision {
  return {
    approvalRequired: false,
    blockedReason: reason,
    boundedScopeSummary: "Do not start a fix workflow until the block is resolved.",
    clarificationQuestions: [],
    issueNumber: input.issueNumber,
    owner: input.owner,
    reasonCodes: ["blocked"],
    repo: input.repo,
    route: "blocked",
    summary: reason,
    verificationPlan: ["Resolve the configuration or routing block before re-running issue triage."],
  };
}

const defaultAllowedRepos = ["MeganHarrison/alleato-pm"];
const defaultRequiredLabels = ["admin-feedback"];

function resolveConfig(allowedReposOverride?: string[], requiredLabelsOverride?: string[]): TriageConfig {
  const configuredAllowedRepos = allowedReposOverride ?? splitCsv(process.env.EVE_GITHUB_TRIAGE_REPOS);
  const configuredRequiredLabels = requiredLabelsOverride ?? splitCsv(process.env.EVE_GITHUB_TRIAGE_LABELS);
  const allowedRepos = normalizeList(
    configuredAllowedRepos.length > 0 ? configuredAllowedRepos : defaultAllowedRepos,
  );
  const requiredLabels = normalizeList(
    configuredRequiredLabels.length > 0 ? configuredRequiredLabels : defaultRequiredLabels,
  );

  return {
    allowedRepos,
    missingEnv: [],
    requiredLabels,
  };
}

function hasRequiredLabel(labels: string[], requiredLabels: string[]): boolean {
  if (requiredLabels.includes("dispatch-matched")) return true;
  const normalizedLabels = new Set(labels.map((label) => label.toLowerCase()));
  return requiredLabels.some((label) => normalizedLabels.has(label.toLowerCase()));
}

function normalizeList(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));
}

function splitCsv(value: string | undefined): string[] {
  if (typeof value !== "string") return [];
  const items = value.split(",").map((item) => item.trim()).filter((item) => item.length > 0);
  return items;
}

function truncateBody(body: string): string {
  const compact = body.replace(/\s+/g, " ").trim();
  if (compact.length === 0) return "(empty)";
  return compact.length > 600 ? `${compact.slice(0, 600)}...` : compact;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
