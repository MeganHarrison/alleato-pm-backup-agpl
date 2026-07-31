import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sourceCommand = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../isolated-session-workspace.mjs");
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "isolated-session-test-"));
  const remote = path.join(root, "remote.git");
  const canonical = path.join(root, "canonical");
  const workspaces = path.join(root, "workspaces");
  git(root, ["init", "--bare", remote]);
  git(root, ["clone", remote, canonical]);
  git(canonical, ["checkout", "-b", "main"]);
  git(canonical, ["config", "user.email", "test@example.com"]);
  git(canonical, ["config", "user.name", "Test"]);
  fs.mkdirSync(path.join(canonical, "supabase"), { recursive: true });
  fs.writeFileSync(path.join(canonical, "README.md"), "test\n");
  fs.writeFileSync(path.join(canonical, "supabase", "config.toml"), 'project_id = "fixture"\n');
  fs.writeFileSync(path.join(canonical, ".gitignore"), "supabase/.temp/\n");
  git(canonical, ["add", "README.md", ".gitignore", "supabase/config.toml"]);
  git(canonical, ["commit", "-m", "initial"]);
  git(canonical, ["push", "-u", "origin", "main"]);
  git(canonical, ["config", "--local", "codex.canonicalCheckout", canonical]);
  return { root, canonical, workspaces };
}

function run(fx, args, thread = "thread-owner") {
  return spawnSync(process.execPath, [sourceCommand, ...args], {
    cwd: fx.canonical,
    encoding: "utf8",
    env: {
      ...process.env,
      CODEX_THREAD_ID: thread,
      CODEX_ISOLATED_WORKSPACE_ROOT: fx.workspaces,
      CODEX_MACHINE_CAPABILITY_CACHE: path.join(fx.root, "capabilities.json"),
      CODEX_MACHINE_ENV_DISABLE_USER_LOOKUP: "1",
      CODEX_MACHINE_ENV_IGNORE_PROCESS: "1",
      ALLEATO_MACHINE_ENV_FILE: path.join(fx.root, "missing-machine.env"),
      ALLEATO_SUPABASE_PROJECT_REF: "lgveqfnpkxvzbnnwuled",
      ALLEATO_VERCEL_TEAM: "the-alleato-group",
      ALLEATO_VERCEL_PROJECT: "project-management-agent",
    },
  });
}

function registryPath(fx) {
  return path.join(fx.canonical, ".git", "codex-isolated-workspaces.json");
}

test("keeps worktrees optional for routine single-session delivery", () => {
  const policy = fs.readFileSync(path.join(repositoryRoot, "AGENTS.md"), "utf8");
  const command = fs.readFileSync(sourceCommand, "utf8");

  assert.match(policy, /Routine single-session Fast and Standard work must be performed in the\s+registered canonical `main` checkout/);
  assert.match(policy, /Use an isolated worktree only as an explicit exception/);
  assert.doesNotMatch(policy, /All product mutations use an isolated workspace/);
  assert.doesNotMatch(policy, /Before a session writes code, create an isolated workspace/);
  assert.match(command, /This is an opt-in exception/);
  assert.match(command, /Routine single-session work uses the canonical main checkout/);
});

test("creates independent worktrees for non-overlapping writers while canonical may be dirty", () => {
  const fx = fixture();
  fs.writeFileSync(path.join(fx.canonical, "canonical-dirt.txt"), "preserved\n");
  const first = run(fx, ["create", "--session", "S1", "--task", "T1", "--paths", "src/one", "--expires-hours", "2"], "thread-1");
  assert.equal(first.status, 0, first.stderr);
  const second = run(fx, ["create", "--session", "S2", "--task", "T2", "--paths", "src/two", "--expires-hours", "2"], "thread-2");
  assert.equal(second.status, 0, second.stderr);
  const firstPath = first.stdout.match(/Workspace: (.+)/)?.[1]?.trim();
  const secondPath = second.stdout.match(/Workspace: (.+)/)?.[1]?.trim();
  assert.ok(firstPath && secondPath && firstPath !== secondPath);
  assert.equal(fs.existsSync(path.join(fx.canonical, "canonical-dirt.txt")), true);
  assert.equal(
    fs.existsSync(path.join(firstPath, "supabase", ".temp", "project-ref")),
    false,
  );
  assert.equal(git(firstPath, ["status", "--porcelain"]), "");
});

test("records non-secret linkage metadata and never copies checkout runtime files", () => {
  const fx = fixture();
  fs.mkdirSync(path.join(fx.canonical, "frontend"), { recursive: true });
  fs.writeFileSync(path.join(fx.canonical, "frontend", ".env.local"), "SECRET_VALUE=do-not-copy\n");
  const created = run(fx, [
    "create",
    "--session",
    "S1",
    "--task",
    "T1",
    "--paths",
    "src/one",
    "--expires-hours",
    "2",
  ]);
  assert.equal(created.status, 0, created.stderr);
  const workspace = created.stdout.match(/Workspace: (.+)/)?.[1]?.trim();
  assert.ok(workspace);
  assert.equal(fs.existsSync(path.join(workspace, "frontend", ".env.local")), false);
  const registry = JSON.parse(fs.readFileSync(registryPath(fx), "utf8"));
  assert.deepEqual(registry.workspaces[0].capabilities, ["core"]);
  assert.equal(registry.workspaces[0].providerLinkage.supabaseProjectRef, null);
  assert.equal(registry.workspaces[0].providerLinkage.vercelProject, null);
  assert.doesNotMatch(JSON.stringify(registry), /do-not-copy/);
});

test("infers browser runtime before creating a frontend workspace", () => {
  const fx = fixture();
  const created = run(fx, [
    "create",
    "--session",
    "S1",
    "--task",
    "T1",
    "--paths",
    "frontend/src/example.ts",
    "--expires-hours",
    "2",
  ]);
  assert.equal(created.status, 1);
  assert.match(created.stderr, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.doesNotMatch(git(fx.canonical, ["worktree", "list"]), /s1-t1-/);
});

test("infers the comprehensive machine profile for backend runtime work", () => {
  const fx = fixture();
  const created = run(fx, [
    "create",
    "--session",
    "S1",
    "--task",
    "T1",
    "--paths",
    "backend/src/example.py",
    "--expires-hours",
    "2",
  ]);
  assert.equal(created.status, 1);
  assert.match(created.stderr, /GITHUB_TOKEN or GH_TOKEN/);
  assert.match(created.stderr, /RENDER_API_KEY or RENDER_TOKEN/);
  assert.match(created.stderr, /AI_GATEWAY_API_KEY/);
  assert.doesNotMatch(git(fx.canonical, ["worktree", "list"]), /s1-t1-/);
});

test("fails before worktree creation when an explicitly required capability is absent", () => {
  const fx = fixture();
  const created = run(fx, [
    "create",
    "--session",
    "S1",
    "--task",
    "T1",
    "--paths",
    "src/one",
    "--expires-hours",
    "2",
    "--capabilities",
    "database",
  ]);
  assert.equal(created.status, 1);
  assert.match(created.stderr, /SUPABASE_ACCESS_TOKEN or DATABASE_URL/);
  assert.doesNotMatch(git(fx.canonical, ["worktree", "list"]), /s1-t1-/);
  assert.equal(git(fx.canonical, ["branch", "--list", "codex/s1-t1-*"]), "");
});

test("rejects overlapping ownership and spoofed task identity", () => {
  const fx = fixture();
  assert.equal(run(fx, ["create", "--session", "S1", "--task", "T1", "--paths", "src/shared", "--expires-hours", "2"], "thread-1").status, 0);
  const overlap = run(fx, ["create", "--session", "S2", "--task", "T2", "--paths", "src/shared/file.ts", "--expires-hours", "2"], "thread-2");
  assert.equal(overlap.status, 1);
  assert.match(overlap.stderr, /overlaps S1/);
  const spoofed = run(fx, ["handoff", "--session", "S1", "--task", "T1"], "thread-intruder");
  assert.equal(spoofed.status, 1);
  assert.match(spoofed.stderr, /A session label is not ownership/);
});

test("does not let an expired workspace reserve paths forever", () => {
  const fx = fixture();
  assert.equal(run(fx, ["create", "--session", "S1", "--task", "T1", "--paths", "src/shared", "--expires-hours", "2"], "thread-1").status, 0);
  const registry = JSON.parse(fs.readFileSync(registryPath(fx), "utf8"));
  registry.workspaces[0].expiresAt = "2000-01-01T00:00:00.000Z";
  fs.writeFileSync(registryPath(fx), `${JSON.stringify(registry, null, 2)}\n`);
  const replacement = run(fx, ["create", "--session", "S2", "--task", "T2", "--paths", "src/shared", "--expires-hours", "2"], "thread-2");
  assert.equal(replacement.status, 0, replacement.stderr);
});

test("recovers a missing active workspace record before checking path ownership", () => {
  const fx = fixture();
  const first = run(fx, ["create", "--session", "S1", "--task", "T1", "--paths", "src/shared", "--expires-hours", "2"], "thread-1");
  assert.equal(first.status, 0, first.stderr);
  const missingWorkspace = first.stdout.match(/Workspace: (.+)/)?.[1]?.trim();
  assert.ok(missingWorkspace);
  git(fx.canonical, ["worktree", "remove", "--force", missingWorkspace]);

  const replacement = run(fx, ["create", "--session", "S2", "--task", "T2", "--paths", "src/shared", "--expires-hours", "2"], "thread-2");
  assert.equal(replacement.status, 0, replacement.stderr);

  const registry = JSON.parse(fs.readFileSync(registryPath(fx), "utf8"));
  assert.equal(registry.workspaces[0].status, "missing");
  assert.match(registry.workspaces[0].missingReason, /directory and Git worktree record/);
});

test("creates a durable committed handoff and refuses dirty handoffs", () => {
  const fx = fixture();
  const created = run(fx, ["create", "--session", "S1", "--task", "T1", "--paths", "feature", "--expires-hours", "2"]);
  assert.equal(created.status, 0, created.stderr);
  const workspace = created.stdout.match(/Workspace: (.+)/)?.[1]?.trim();
  fs.writeFileSync(path.join(workspace, "feature.txt"), "work\n");
  const dirty = run(fx, ["handoff", "--session", "S1", "--task", "T1"]);
  assert.equal(dirty.status, 1);
  assert.match(dirty.stderr, /uncommitted work/);
  git(workspace, ["config", "user.email", "test@example.com"]);
  git(workspace, ["config", "user.name", "Test"]);
  git(workspace, ["add", "feature.txt"]);
  git(workspace, ["commit", "-m", "feature"]);
  const handed = run(fx, ["handoff", "--session", "S1", "--task", "T1"]);
  assert.equal(handed.status, 0, handed.stderr);
  const manifest = handed.stdout.match(/Handoff manifest: (.+)/)?.[1]?.trim();
  assert.ok(manifest && fs.existsSync(manifest));
  const parsed = JSON.parse(fs.readFileSync(manifest, "utf8"));
  assert.equal(parsed.schemaVersion, 2);
  assert.equal(parsed.commits.length, 1);
  assert.equal(parsed.commits[0], git(workspace, ["rev-parse", "HEAD"]));
  assert.match(parsed.integrationCommand, /^git cherry-pick [a-f0-9]{40}$/);
  fs.rmSync(path.dirname(manifest), { recursive: true, force: true });
});
