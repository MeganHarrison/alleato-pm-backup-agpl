import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildClaudeCodeHandoffMarkdown,
  writeClaudeCodeHandoffFile,
} from "../handoffs";
import type {
  FeatureRequestRow,
  ImplementationPlanRow,
} from "../types";

function requestFixture(overrides: Partial<FeatureRequestRow> = {}): FeatureRequestRow {
  return {
    id: "c31c6ca5-138c-40ff-a5e9-7bb4364ad5fa",
    title: "Dedicated Issue Register",
    requester_name: "Brandon",
    requester_user_id: null,
    requester_person_id: null,
    source: "ais_chat",
    project_id: null,
    company_id: null,
    request_type: "workflow_improvement",
    raw_request: "Create a dedicated issue register with AI suggestions and human approval.",
    assistant_summary: "Dedicated Issue Register page with approval-gated AI suggestions.",
    stakeholder_problem: null,
    desired_outcome: "Track and approve issues without losing source context.",
    affected_users: ["Leadership", "Project teams"],
    affected_pages: ["/ai-assistant/feature-requests"],
    affected_workflows: ["Issue review"],
    acceptance_criteria: ["AI suggestions require human approval."],
    verification_steps: ["Generate a Claude Code handoff."],
    open_questions: [],
    assumptions: [],
    priority: "medium",
    status: "plan_generated",
    ready_for_build: true,
    readiness_goal_clarity: "clear",
    readiness_data_clarity: "clear",
    readiness_ux_clarity: "clear",
    readiness_acceptance_status: "clear",
    readiness_implementation_risk: "low",
    readiness_missing_requirements: [],
    linear_issue_id: "AAI-999",
    linear_issue_url: "https://linear.app/megankharrison/issue/AAI-999/test",
    linear_draft_body: null,
    linear_sync_status: "created",
    linear_last_synced_at: null,
    linear_sync_error: null,
    claude_handoff_path: null,
    source_session_id: null,
    source_message_id: null,
    source_metadata: {},
    created_by: null,
    updated_by: null,
    created_at: "2026-06-19T12:00:00.000Z",
    updated_at: "2026-06-19T12:00:00.000Z",
    ...overrides,
  } as FeatureRequestRow;
}

function restoreEnvValue(key: "ALLEATO_WORKSPACE_ROOT" | "CODEX_WORKSPACE_ROOT" | "AIS_HANDOFF_ROOT", value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

function planFixture(overrides: Partial<ImplementationPlanRow> = {}): ImplementationPlanRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    feature_request_id: "c31c6ca5-138c-40ff-a5e9-7bb4364ad5fa",
    version: 1,
    summary: "Implement the issue register workflow.",
    affected_routes: ["/ai-assistant/feature-requests/[requestId]"],
    affected_components: ["FeatureRequestDetail"],
    affected_tables: ["feature_requests", "execution_handoffs"],
    data_requirements: ["Persist handoff metadata only after file generation succeeds."],
    implementation_steps: ["Fix handoff path resolution."],
    acceptance_criteria: ["Generated handoff path is repo-relative."],
    verification_steps: ["Run focused handoff writer tests."],
    risks: [],
    open_questions: [],
    generated_by: null,
    created_at: "2026-06-19T12:00:00.000Z",
    ...overrides,
  } as ImplementationPlanRow;
}

async function makeWorkspace() {
  const root = await mkdtemp(path.join(os.tmpdir(), "alleato-handoff-"));
  await mkdir(path.join(root, "docs", "ops"), { recursive: true });
  await writeFile(path.join(root, "AGENTS.md"), "# test repo\n", "utf8");
  return root;
}

describe("feature request Claude Code handoffs", () => {
  const originalCwd = process.cwd();
  const envBackup = {
    ALLEATO_WORKSPACE_ROOT: process.env.ALLEATO_WORKSPACE_ROOT,
    CODEX_WORKSPACE_ROOT: process.env.CODEX_WORKSPACE_ROOT,
    AIS_HANDOFF_ROOT: process.env.AIS_HANDOFF_ROOT,
  };
  const tempRoots: string[] = [];

  afterEach(async () => {
    process.chdir(originalCwd);
    restoreEnvValue("ALLEATO_WORKSPACE_ROOT", envBackup.ALLEATO_WORKSPACE_ROOT);
    restoreEnvValue("CODEX_WORKSPACE_ROOT", envBackup.CODEX_WORKSPACE_ROOT);
    restoreEnvValue("AIS_HANDOFF_ROOT", envBackup.AIS_HANDOFF_ROOT);
    await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  it("builds blocked handoff markdown when readiness is incomplete", () => {
    const request = requestFixture({
      ready_for_build: false,
      readiness_missing_requirements: ["Acceptance criteria missing."],
    });

    const result = buildClaudeCodeHandoffMarkdown({
      request,
      plan: planFixture({ acceptance_criteria: [] }),
    });

    expect(result.validationStatus).toBe("blocked");
    expect(result.validationErrors).toContain("Claude Code handoff");
    expect(result.markdown).toContain("## Readiness Gate");
    expect(result.markdown).toContain("Claude Code handoff");
  });

  it("writes a handoff under the explicit workspace root", async () => {
    const workspaceRoot = await makeWorkspace();
    tempRoots.push(workspaceRoot);

    const handoff = await writeClaudeCodeHandoffFile({
      request: requestFixture(),
      plan: planFixture(),
      sessionLabel: "S99",
      workspaceRoot,
    });

    expect(handoff.path).toMatch(/^docs\/ops\/handoffs\/\d{4}-\d{2}-\d{2}-S99-dedicated-issue-register\.md$/);
    expect(handoff.storage).toBe("file");
    const markdown = await readFile(path.join(workspaceRoot, handoff.path), "utf8");
    expect(markdown).toContain("# Claude Code Handoff: Dedicated Issue Register");
  });

  it("resolves the repo root by walking up from a frontend runtime cwd", async () => {
    const workspaceRoot = await makeWorkspace();
    tempRoots.push(workspaceRoot);
    const frontendRuntime = path.join(workspaceRoot, "frontend");
    await mkdir(frontendRuntime, { recursive: true });
    process.chdir(frontendRuntime);
    delete process.env.ALLEATO_WORKSPACE_ROOT;
    delete process.env.CODEX_WORKSPACE_ROOT;
    delete process.env.AIS_HANDOFF_ROOT;

    const handoff = await writeClaudeCodeHandoffFile({
      request: requestFixture({ title: "Runtime cwd proof" }),
      plan: planFixture(),
      sessionLabel: "SAIS",
    });

    expect(handoff.path).toMatch(/^docs\/ops\/handoffs\/\d{4}-\d{2}-\d{2}-SAIS-runtime-cwd-proof\.md$/);
    await expect(readFile(path.join(workspaceRoot, handoff.path), "utf8")).resolves.toContain(
      "Runtime cwd proof",
    );
  });

  it("ignores literal undefined path environment values", async () => {
    const workspaceRoot = await makeWorkspace();
    tempRoots.push(workspaceRoot);
    const frontendRuntime = path.join(workspaceRoot, "frontend", ".next", "server");
    await mkdir(frontendRuntime, { recursive: true });
    process.chdir(frontendRuntime);
    process.env.ALLEATO_WORKSPACE_ROOT = "undefined";
    process.env.CODEX_WORKSPACE_ROOT = "undefined";
    process.env.AIS_HANDOFF_ROOT = "undefined";

    const handoff = await writeClaudeCodeHandoffFile({
      request: requestFixture({ title: "Undefined env guard" }),
      plan: planFixture(),
      sessionLabel: "SAIS",
    });

    expect(handoff.path).toMatch(/^docs\/ops\/handoffs\/\d{4}-\d{2}-\d{2}-SAIS-undefined-env-guard\.md$/);
    await expect(readFile(path.join(workspaceRoot, handoff.path), "utf8")).resolves.toContain(
      "Undefined env guard",
    );
  });

  it("falls back to an inline artifact when no workspace root is available", async () => {
    const runtimeRoot = await mkdtemp(path.join(os.tmpdir(), "var-task-frontend-"));
    tempRoots.push(runtimeRoot);
    process.chdir(runtimeRoot);
    delete process.env.ALLEATO_WORKSPACE_ROOT;
    delete process.env.CODEX_WORKSPACE_ROOT;
    delete process.env.AIS_HANDOFF_ROOT;

    const handoff = await writeClaudeCodeHandoffFile({
      request: requestFixture({ title: "Serverless runtime proof" }),
      plan: planFixture(),
      sessionLabel: "SAIS",
    });

    expect(handoff.storage).toBe("inline");
    expect(handoff.path).toMatch(
      /^ais-inline:\/\/feature-requests\/c31c6ca5-138c-40ff-a5e9-7bb4364ad5fa\/handoffs\/\d{4}-\d{2}-\d{2}-SAIS-serverless-runtime-proof\.md$/,
    );
    expect(handoff.markdown).toContain("# Claude Code Handoff: Serverless runtime proof");
  });

  it("supports a custom handoff root inside the workspace", async () => {
    const workspaceRoot = await makeWorkspace();
    tempRoots.push(workspaceRoot);

    const handoff = await writeClaudeCodeHandoffFile({
      request: requestFixture({ title: "Custom handoff root" }),
      plan: planFixture(),
      sessionLabel: "T1",
      workspaceRoot,
      handoffRoot: "tmp/generated-handoffs",
    });

    expect(handoff.path).toMatch(/^tmp\/generated-handoffs\/\d{4}-\d{2}-\d{2}-T1-custom-handoff-root\.md$/);
    await expect(readFile(path.join(workspaceRoot, handoff.path), "utf8")).resolves.toContain(
      "Custom handoff root",
    );
  });

  it("refuses to write an absolute handoff root outside the workspace", async () => {
    const workspaceRoot = await makeWorkspace();
    const outsideRoot = await mkdtemp(path.join(os.tmpdir(), "outside-handoff-"));
    tempRoots.push(workspaceRoot, outsideRoot);

    await expect(
      writeClaudeCodeHandoffFile({
        request: requestFixture(),
        plan: planFixture(),
        workspaceRoot,
        handoffRoot: outsideRoot,
      }),
    ).rejects.toThrow("Refusing to write Claude Code handoff outside workspace root");
  });

  it("throws an actionable error when the handoff file cannot be written", async () => {
    const workspaceRoot = await makeWorkspace();
    tempRoots.push(workspaceRoot);
    await writeFile(path.join(workspaceRoot, "docs", "ops", "handoffs"), "not a directory", "utf8");

    await expect(
      writeClaudeCodeHandoffFile({
        request: requestFixture(),
        plan: planFixture(),
        workspaceRoot,
      }),
    ).rejects.toThrow(/Failed to write Claude Code handoff file to docs\/ops\/handoffs\/.*No handoff metadata was recorded/);
  });
});
