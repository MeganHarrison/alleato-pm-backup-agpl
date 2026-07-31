import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import type {
  ExecutionHandoffRow,
  FeatureRequestRow,
  ImplementationPlanRow,
} from "./types";
import { scoreFeatureRequestReadiness } from "./readiness";

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function checkboxList(values: string[], fallback: string): string {
  const rows = values.length > 0 ? values : [fallback];
  return rows.map((value) => `- [ ] ${value}`).join("\n");
}

function bulletList(values: string[], fallback: string): string {
  const rows = values.length > 0 ? values : [fallback];
  return rows.map((value) => `- ${value}`).join("\n");
}

function numberedList(values: string[], fallback: string): string {
  const rows = values.length > 0 ? values : [fallback];
  return rows.map((value, index) => `${index + 1}. ${value}`).join("\n");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54) || "feature-request";
}

function normalizeRelativePath(value: string): string {
  return value.split(path.sep).join("/");
}

function configuredPathValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null") return null;
  return trimmed;
}

function findWorkspaceRoot(startDirectory: string): string | null {
  let current = path.resolve(startDirectory);
  while (true) {
    const hasOpsDocs = existsSync(path.join(current, "docs", "ops"));
    const hasProjectMarker = existsSync(path.join(current, "AGENTS.md")) || existsSync(path.join(current, "package.json"));
    if (hasOpsDocs && hasProjectMarker) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function resolveWorkspaceRoot(explicitRoot?: string | null): string | null {
  const configuredRoot =
    configuredPathValue(explicitRoot) ||
    configuredPathValue(process.env.ALLEATO_WORKSPACE_ROOT) ||
    configuredPathValue(process.env.CODEX_WORKSPACE_ROOT) ||
    null;
  const root = configuredRoot
    ? path.resolve(configuredRoot)
    : findWorkspaceRoot(process.cwd());

  return root;
}

function resolveHandoffPaths(params: {
  fileName: string;
  workspaceRoot?: string | null;
  handoffRoot?: string | null;
}) {
  const workspaceRoot = resolveWorkspaceRoot(params.workspaceRoot);
  if (!workspaceRoot) {
    return null;
  }
  const configuredHandoffRoot =
    configuredPathValue(params.handoffRoot) ||
    configuredPathValue(process.env.AIS_HANDOFF_ROOT) ||
    path.join("docs", "ops", "handoffs");
  const handoffDirectory = path.isAbsolute(configuredHandoffRoot)
    ? configuredHandoffRoot
    : path.join(workspaceRoot, configuredHandoffRoot);
  const absolutePath = path.join(handoffDirectory, params.fileName);
  const relativePath = normalizeRelativePath(path.relative(workspaceRoot, absolutePath));

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(
      `Refusing to write Claude Code handoff outside workspace root: ${absolutePath}`,
    );
  }

  return { absolutePath, relativePath };
}

function inlineHandoffPath(params: { requestId: string; fileName: string }) {
  return `ais-inline://feature-requests/${params.requestId}/handoffs/${params.fileName}`;
}

export function buildClaudeCodeHandoffMarkdown(params: {
  request: FeatureRequestRow;
  plan: ImplementationPlanRow | null;
  linearIssue?: string | null;
}): { markdown: string; validationStatus: ExecutionHandoffRow["validation_status"]; validationErrors: string[] } {
  const { request, plan } = params;
  const readiness = scoreFeatureRequestReadiness({ request, latestPlan: plan });
  const acceptanceCriteria = asStringArray(plan?.acceptance_criteria ?? request.acceptance_criteria);
  const verificationSteps = asStringArray(plan?.verification_steps ?? request.verification_steps);
  const implementationSteps = asStringArray(plan?.implementation_steps);
  const affectedRoutes = asStringArray(plan?.affected_routes);
  const affectedComponents = asStringArray(plan?.affected_components);
  const affectedTables = asStringArray(plan?.affected_tables);
  const dataRequirements = asStringArray(plan?.data_requirements);
  const openQuestions = asStringArray(plan?.open_questions ?? request.open_questions);
  const assumptions = asStringArray(request.assumptions);
  const likelyFiles = [
    ...affectedRoutes.map((route) => `frontend route: ${route}`),
    ...affectedComponents,
    ...affectedTables.map((table) => `database table: ${table}`),
  ];

  return {
    validationStatus: readiness.readyForBuild ? "valid" : "blocked",
    validationErrors: readiness.missingRequirements,
    markdown: [
      `# Claude Code Handoff: ${request.title}`,
      "",
      "## Intake",
      `Requester: ${request.requester_name}`,
      `Source: ${request.source}`,
      `AIS request id: ${request.id}`,
      `Linear issue: ${params.linearIssue ?? request.linear_issue_id ?? request.linear_issue_url ?? "Draft required"}`,
      "",
      "## Stakeholder Goal",
      request.raw_request,
      "",
      "## Current Understanding",
      request.assistant_summary,
      "",
      "## Acceptance Criteria",
      checkboxList(acceptanceCriteria, "Confirm final acceptance criteria with stakeholder."),
      "",
      "## Implementation Plan",
      numberedList(implementationSteps, plan?.summary ?? "Generate and review an implementation plan before coding."),
      "",
      "## Likely Files",
      bulletList(likelyFiles, "Identify owner files during implementation discovery."),
      "",
      "## Data Requirements",
      bulletList(dataRequirements, "Confirm data requirements before implementation."),
      "",
      "## Verification Plan",
      bulletList(verificationSteps, "Add targeted verification before handoff."),
      "",
      "## Open Questions / Assumptions",
      bulletList([...openQuestions, ...assumptions.map((assumption) => `Assumption: ${assumption}`)], "No open questions recorded."),
      "",
      "## Readiness Gate",
      readiness.readyForBuild
        ? "Ready for build."
        : readiness.blockedMessage ?? "Blocked by missing readiness requirements.",
      "",
      "## Guardrails",
      "- No silent failures.",
      "- No generic errors.",
      "- Use shared primitives.",
      "- Run route checks if routes change.",
      "- Verify migration ledger if schema changes.",
      "- Attach browser evidence for frontend flows.",
      "",
    ].join("\n"),
  };
}

export async function writeClaudeCodeHandoffFile(params: {
  request: FeatureRequestRow;
  plan: ImplementationPlanRow | null;
  linearIssue?: string | null;
  sessionLabel?: string;
  workspaceRoot?: string | null;
  handoffRoot?: string | null;
}): Promise<{
  path: string;
  title: string;
  markdown: string;
  validationStatus: ExecutionHandoffRow["validation_status"];
  validationErrors: string[];
  storage: "file" | "inline";
}> {
  const built = buildClaudeCodeHandoffMarkdown(params);
  const today = new Date().toISOString().slice(0, 10);
  const session = (params.sessionLabel ?? "SAIS").replace(/[^A-Za-z0-9]/g, "") || "SAIS";
  const fileName = `${today}-${session}-${slugify(params.request.title)}.md`;
  const resolvedPath = resolveHandoffPaths({
    fileName,
    workspaceRoot: params.workspaceRoot,
    handoffRoot: params.handoffRoot,
  });
  if (!resolvedPath) {
    return {
      path: inlineHandoffPath({ requestId: params.request.id, fileName }),
      title: `Claude Code Handoff: ${params.request.title}`,
      markdown: built.markdown,
      validationStatus: built.validationStatus,
      validationErrors: built.validationErrors,
      storage: "inline",
    };
  }

  const { absolutePath, relativePath } = resolvedPath;
  try {
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, built.markdown, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      [
        `Failed to write Claude Code handoff file to ${relativePath}: ${message}`,
        "No handoff metadata was recorded.",
        "Check workspace filesystem permissions or configure AIS_HANDOFF_ROOT.",
      ].join(" "),
    );
  }

  return {
    path: relativePath,
    title: `Claude Code Handoff: ${params.request.title}`,
    markdown: built.markdown,
    validationStatus: built.validationStatus,
    validationErrors: built.validationErrors,
    storage: "file",
  };
}
