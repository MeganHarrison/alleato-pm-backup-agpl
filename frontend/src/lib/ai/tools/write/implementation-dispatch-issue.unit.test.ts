import {
  DEFAULT_ALLOWED_EDIT_PATHS,
  autofixIssueTitle,
  autofixTriggerLabel,
  buildAutofixIssueBody,
  invalidAllowedEditPaths,
  type ImplementationDispatchDraft,
} from "./implementation-dispatch-issue";

const baseDraft: ImplementationDispatchDraft = {
  title: "Add overdue-submittal escalation banner",
  problemStatement: "Overdue submittals show no escalation on the dashboard.",
  expectedBehavior: "Submittals 3+ days overdue render an escalation banner.",
  reproduction: "1. Open /876/submittals\n2. Note overdue items show no escalation",
  acceptanceCriteria: ["Banner renders for overdue items", "No banner when nothing overdue"],
  allowedEditPaths: DEFAULT_ALLOWED_EDIT_PATHS,
  guardrail: "Test coverage",
};

// Mirrors the section() parser in .github/workflows/autofix-issue.yml —
// the body must be readable by the exact regex the workflow uses.
function workflowSection(body: string, title: string): string {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`### ${escaped}\\s*([\\s\\S]*?)(?=\\n### |$)`, "i");
  const match = body.match(regex);
  return match ? match[1].trim() : "";
}

describe("buildAutofixIssueBody", () => {
  it("emits every section the autofix workflow's parser requires, parseable by its exact regex", () => {
    const body = buildAutofixIssueBody(baseDraft);

    expect(workflowSection(body, "Automation scope")).toBe("Frontend");
    expect(workflowSection(body, "Problem statement")).toBe(baseDraft.problemStatement);
    expect(workflowSection(body, "Expected behavior")).toBe(baseDraft.expectedBehavior);
    expect(workflowSection(body, "Reproduction")).toBe(baseDraft.reproduction);
    expect(workflowSection(body, "Acceptance criteria")).toBe(
      "- Banner renders for overdue items\n- No banner when nothing overdue",
    );
    expect(workflowSection(body, "Allowed edit paths")).toBe(
      "frontend/src/\nfrontend/tests/",
    );
    expect(workflowSection(body, "Required guardrail")).toBe("Test coverage");
  });

  it("does not double-bullet acceptance criteria that already have a dash", () => {
    const body = buildAutofixIssueBody({
      ...baseDraft,
      acceptanceCriteria: ["- Already bulleted"],
    });
    expect(workflowSection(body, "Acceptance criteria")).toBe("- Already bulleted");
  });

  it("appends source context below the parsed sections without breaking them", () => {
    const body = buildAutofixIssueBody({
      ...baseDraft,
      sourceContext: "From the 2026-07-23 Goodwill morning meeting risk review.",
    });
    expect(workflowSection(body, "Required guardrail")).toBe("Test coverage");
    expect(workflowSection(body, "Assistant dispatch context")).toBe(
      "From the 2026-07-23 Goodwill morning meeting risk review.",
    );
  });
});

describe("invalidAllowedEditPaths", () => {
  it("accepts the workflow's automatable scope and rejects everything else", () => {
    expect(invalidAllowedEditPaths(DEFAULT_ALLOWED_EDIT_PATHS)).toEqual([]);
    expect(invalidAllowedEditPaths(["frontend/src/lib/ai/"])).toEqual([]);
    expect(
      invalidAllowedEditPaths(["backend/src/", "supabase/migrations/", "frontend/tests/e2e/"]),
    ).toEqual(["backend/src/", "supabase/migrations/"]);
  });

  it("ignores blank entries instead of flagging them", () => {
    expect(invalidAllowedEditPaths(["  ", "frontend/src/"])).toEqual([]);
  });
});

describe("autofixIssueTitle", () => {
  it("prefixes [Autofix]: exactly once", () => {
    expect(autofixIssueTitle("Fix banner")).toBe("[Autofix]: Fix banner");
    expect(autofixIssueTitle("[Autofix]: Fix banner")).toBe("[Autofix]: Fix banner");
  });
});

describe("autofixTriggerLabel", () => {
  it("maps engines to the labels the workflow gates on", () => {
    expect(autofixTriggerLabel("default")).toBe("autofix");
    expect(autofixTriggerLabel("claude")).toBe("claude:fix");
    expect(autofixTriggerLabel("codex")).toBe("codex:fix");
  });
});
