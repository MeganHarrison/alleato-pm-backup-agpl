/**
 * Pure builders for the assistant's implementation-dispatch tool.
 *
 * The generated issue body MUST match the `Autofix Frontend Bug` issue-form
 * shape (`### <section>` headings) because `.github/workflows/autofix-issue.yml`
 * ("Prepare issue context") parses those exact headings to assemble the coding
 * agent's prompt. A renamed or missing heading downgrades the issue to
 * "template incomplete" and the lane posts a blocker instead of building.
 */

export const IMPLEMENTATION_GUARDRAIL_OPTIONS = [
  "Test coverage",
  "Validation tightening",
  "Shared abstraction improvement",
  "Failure-mode documentation",
] as const;

export type ImplementationGuardrail =
  (typeof IMPLEMENTATION_GUARDRAIL_OPTIONS)[number];

/**
 * Which coding agent the autofix lane should run.
 * "default" defers to the repo's `AUTOFIX_ENGINE` variable via the `autofix`
 * label; "claude" / "codex" force an engine via their explicit labels.
 */
export type ImplementationEngine = "default" | "claude" | "codex";

export type ImplementationDispatchDraft = {
  title: string;
  problemStatement: string;
  expectedBehavior: string;
  reproduction: string;
  acceptanceCriteria: string[];
  allowedEditPaths: string[];
  guardrail: ImplementationGuardrail;
  sourceContext?: string | null;
};

export const DEFAULT_ALLOWED_EDIT_PATHS = [
  "frontend/src/",
  "frontend/tests/",
];

// Mirrors the workflow's own gate (autofix-issue.yml): only frontend/src and
// frontend/tests are automatable, so a bad dispatch fails loudly here instead
// of producing an issue the lane immediately blocks.
const ALLOWED_EDIT_PATH_PATTERN = /^frontend\/(src|tests)\//;

export function invalidAllowedEditPaths(paths: string[]): string[] {
  return paths
    .map((path) => path.trim())
    .filter(Boolean)
    .filter((path) => !ALLOWED_EDIT_PATH_PATTERN.test(path));
}

export function autofixIssueTitle(title: string): string {
  const trimmed = title.trim();
  return /^\[autofix\]/i.test(trimmed) ? trimmed : `[Autofix]: ${trimmed}`;
}

export function autofixTriggerLabel(engine: ImplementationEngine): string {
  if (engine === "claude") return "claude:fix";
  if (engine === "codex") return "codex:fix";
  return "autofix";
}

export function buildAutofixIssueBody(draft: ImplementationDispatchDraft): string {
  const acceptance = draft.acceptanceCriteria
    .map((criterion) => criterion.trim())
    .filter(Boolean)
    .map((criterion) => (criterion.startsWith("- ") ? criterion : `- ${criterion}`));

  const allowedPaths = draft.allowedEditPaths
    .map((path) => path.trim())
    .filter(Boolean);

  const sections = [
    ["Automation scope", "Frontend"],
    ["Problem statement", draft.problemStatement.trim()],
    ["Expected behavior", draft.expectedBehavior.trim()],
    ["Reproduction", draft.reproduction.trim()],
    ["Acceptance criteria", acceptance.join("\n")],
    ["Allowed edit paths", allowedPaths.join("\n")],
    ["Required guardrail", draft.guardrail],
  ];

  const body = sections
    .map(([heading, content]) => `### ${heading}\n\n${content}`)
    .join("\n\n");

  const context = draft.sourceContext?.trim();
  if (!context) return body;

  // Extra context rides below the parsed sections; the workflow's section()
  // parser stops each section at the next `### ` heading, so this stays out
  // of the required-field validation.
  return `${body}\n\n### Assistant dispatch context\n\n${context}`;
}
