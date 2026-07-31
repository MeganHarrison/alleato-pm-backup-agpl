import { defineAgent } from "eve";
import { mockModel, type MockModelRequest, type MockModelResponse } from "eve/evals";

const useMockModel = process.env.EVE_GITHUB_TRIAGE_MOCK_MODEL === "true";

export default defineAgent({
  model: useMockModel
    ? mockModel({
        modelId: "github-issue-triage-eval",
        respond: respondForEval,
      })
    : process.env.EVE_GITHUB_TRIAGE_MODEL ?? "openai/gpt-5.4-mini",
  modelContextWindowTokens: useMockModel ? 128000 : undefined,
  reasoning: "low",
});

function respondForEval(request: MockModelRequest): MockModelResponse | string {
  if (request.toolResults.length > 0) {
    return summarizeToolResult(request);
  }

  const prompt = (request.lastUserMessage ?? "").toLowerCase();
  return {
    toolCalls: [
      {
        name: "triage_issue",
        input: buildEvalIssue(prompt),
      },
    ],
  };
}

function summarizeToolResult(request: MockModelRequest): MockModelResponse | string {
  const latest = request.toolResults.at(-1);

  if (latest?.name === "triage_issue") {
    const output = asRecord(latest.output);
    const route = readString(output.route);
    if (route === "direct-to-main" || route === "pr-required") {
      return {
        toolCalls: [
          {
            name: "request_fix_workflow",
            input: {
              boundedScopeSummary: readString(output.boundedScopeSummary) ?? "Limit execution to the issue-owned fix scope.",
              issueNumber: readNumber(output.issueNumber) ?? 1,
              owner: readString(output.owner) ?? "MeganHarrison",
              repo: readString(output.repo) ?? "alleato-pm",
              route,
              verificationPlan: readStringArray(output.verificationPlan),
            },
          },
        ],
      };
    }
    return formatRouteReply(output);
  }

  if (latest?.name === "request_fix_workflow") {
    return formatApprovedWorkflowReply(asRecord(latest.output));
  }

  return "GitHub issue triage completed.";
}

function buildEvalIssue(prompt: string) {
  const base = {
    body: prompt,
    labels: ["eve-triage"],
    owner: "MeganHarrison",
    repo: "alleato-pm",
  };

  if (prompt.includes("config is missing")) {
    return {
      ...base,
      allowedRepos: [],
      issueNumber: 851,
      requiredLabels: [],
      title: "Triage config missing",
    };
  }

  if (prompt.includes("migration") || prompt.includes("oauth") || prompt.includes("auth")) {
    return {
      ...base,
      allowedRepos: ["MeganHarrison/alleato-pm"],
      issueNumber: 849,
      requiredLabels: ["eve-triage"],
      title: "OAuth callback fix requires env and auth changes",
    };
  }

  if (prompt.includes("unclear") || prompt.includes("not sure") || prompt.includes("investigate")) {
    return {
      ...base,
      allowedRepos: ["MeganHarrison/alleato-pm"],
      issueNumber: 850,
      requiredLabels: ["eve-triage"],
      title: "Export issue needs clarification",
    };
  }

  return {
    ...base,
    allowedRepos: ["MeganHarrison/alleato-pm"],
    issueNumber: 848,
    requiredLabels: ["eve-triage"],
    title: "Commitment export button is broken",
  };
}

function formatRouteReply(output: Record<string, unknown>): string {
  const route = readString(output.route) ?? "blocked";
  const reasons = readStringArray(output.reasonCodes);
  const verificationPlan = readStringArray(output.verificationPlan);
  const clarifications = readStringArray(output.clarificationQuestions);

  const lines = [
    "## Eve GitHub Triage",
    "",
    `Path: ${route}`,
    "",
    "Why:",
    ...reasons.map((reason) => `- ${reason}`),
    "",
    "Approval:",
    route === "wait-for-clarification"
      ? "- No fix workflow requested yet."
      : "- Explicit approval is required before any bounded fix workflow can proceed.",
    "",
    "Verification:",
    ...verificationPlan.map((step) => `- ${step}`),
  ];

  if (clarifications.length > 0) {
    lines.push("", "Need from reporter:", ...clarifications.map((item) => `- ${item}`));
  }

  return lines.join("\n");
}

function formatApprovedWorkflowReply(output: Record<string, unknown>): string {
  const delivery = readString(output.deliveryMode) ?? "pull-request";
  const scope = readString(output.boundedScopeSummary) ?? "Issue-owned fix scope only.";
  const verificationPlan = readStringArray(output.verificationPlan);

  return [
    "## Eve GitHub Triage",
    "",
    `Path: ${delivery === "main" ? "direct-to-main" : "pr-required"}`,
    "",
    "Approval:",
    "- Approved. The bounded fix workflow contract is now ready.",
    "",
    "Execution scope:",
    `- ${scope}`,
    "",
    "Verification:",
    ...verificationPlan.map((step) => `- ${step}`),
    "",
    "Next step:",
    `- Run the bounded ${delivery === "main" ? "direct-to-main" : "pull-request"} fix workflow with these constraints.`,
  ].join("\n");
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}
