import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { getCodexControlPlaneData } from "../control-plane";

describe("getCodexControlPlaneData", () => {
  let workspaceRoot: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "codex-control-plane-"));
    await mkdir(path.join(workspaceRoot, "docs/ops/orchestration"), { recursive: true });
    await mkdir(path.join(workspaceRoot, "docs/ops/tasks"), { recursive: true });
    await mkdir(path.join(workspaceRoot, "docs/ops/handoffs"), { recursive: true });
    await mkdir(path.join(workspaceRoot, "frontend"), { recursive: true });

    await writeFile(
      path.join(workspaceRoot, "docs/ops/orchestration/session-board.md"),
      [
        "# Session Board",
        "",
        "| Session | Initiative | Scope | Linear issue | Owned paths | Current status | Started | Last update | Handoff | Next checkpoint |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
        "| SLEADER | Codex command center | Command-center implementation | AAI-916 | `docs/ops/tasks/2026-07-03-codex-command-center.md`, `docs/ops/handoffs/2026-07-03-SLEADER-command-center.md`, `frontend/src/app/(admin)/command-center/page.tsx` | In Progress | 2026-07-03 | 2026-07-03 | `docs/ops/handoffs/2026-07-03-SLEADER-command-center.md` | Land tabs and parser |",
        "",
      ].join("\n"),
      "utf8",
    );

    await writeFile(
      path.join(workspaceRoot, "docs/ops/orchestration/review-queue.md"),
      [
        "# Review Queue",
        "",
        "| Review ID | Session | Initiative | Linear issue | Status | Reviewer | Evidence | Disposition notes | Last update |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
        "| R-1 | SLEADER | Codex command center | AAI-916 | In Progress | Megan | `docs/ops/tasks/2026-07-03-codex-command-center.md` | Waiting on UI tabs | 2026-07-03 |",
        "",
      ].join("\n"),
      "utf8",
    );

    await writeFile(
      path.join(workspaceRoot, "docs/ops/tasks/2026-07-03-codex-command-center.md"),
      [
        "# Task: Codex Command Center",
        "",
        "Status: In Progress",
        "Owner: Codex",
        "",
        "## Objective",
        "",
        "Build the control plane.",
        "",
        "## Risks / Gaps",
        "",
        "- Existing board is still a single file.",
        "",
      ].join("\n"),
      "utf8",
    );

    await writeFile(
      path.join(workspaceRoot, "docs/ops/handoffs/2026-07-03-SLEADER-command-center.md"),
      [
        "# Handoff: Codex command center",
        "",
        "5) Current status: Pending Review",
        "10) Recommended next action (one line): Validate browser proof and accept review item",
        "",
      ].join("\n"),
      "utf8",
    );

    process.chdir(path.join(workspaceRoot, "frontend"));
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(workspaceRoot, { recursive: true, force: true });
  });

  it("parses session board, review queue, and resume packets from repo docs", async () => {
    const data = await getCodexControlPlaneData();

    expect(data.sessions).toHaveLength(1);
    expect(data.reviewQueue).toHaveLength(1);
    expect(data.resumePacks).toHaveLength(1);
    expect(data.resumePacks[0]).toMatchObject({
      session: "SLEADER",
      linearIssue: "AAI-916",
      taskTitle: "Codex Command Center",
      taskStatus: "In Progress",
      handoffStatus: "Pending Review",
    });
    expect(data.resumePacks[0].ownedPaths).toContain(
      "frontend/src/app/(admin)/command-center/page.tsx",
    );
    expect(data.issues).toEqual([]);
  });

  it("records an issue when a linked task doc cannot be read", async () => {
    await writeFile(
      path.join(workspaceRoot, "docs/ops/orchestration/session-board.md"),
      [
        "# Session Board",
        "",
        "| Session | Initiative | Scope | Linear issue | Owned paths | Current status | Started | Last update | Handoff | Next checkpoint |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
        "| SLEADER | Codex command center | Command-center implementation | AAI-916 | `docs/ops/tasks/missing.md` | In Progress | 2026-07-03 | 2026-07-03 | N/A | Land tabs and parser |",
        "",
      ].join("\n"),
      "utf8",
    );

    const data = await getCodexControlPlaneData();

    expect(data.resumePacks[0].taskPath).toBe("docs/ops/tasks/missing.md");
    expect(data.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: "task",
          path: "docs/ops/tasks/missing.md",
        }),
      ]),
    );
  });
});
