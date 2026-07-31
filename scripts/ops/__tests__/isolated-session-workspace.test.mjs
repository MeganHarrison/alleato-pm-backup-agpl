import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sourceCommand = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../isolated-session-workspace.mjs");

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
  fs.writeFileSync(path.join(canonical, "README.md"), "test\n");
  git(canonical, ["add", "README.md"]);
  git(canonical, ["commit", "-m", "initial"]);
  git(canonical, ["push", "-u", "origin", "main"]);
  git(canonical, ["config", "--local", "codex.canonicalCheckout", canonical]);
  return { root, canonical, workspaces };
}

function run(fx, args, thread = "thread-owner") {
  return spawnSync(process.execPath, [sourceCommand, ...args], {
    cwd: fx.canonical,
    encoding: "utf8",
    env: { ...process.env, CODEX_THREAD_ID: thread, CODEX_ISOLATED_WORKSPACE_ROOT: fx.workspaces },
  });
}

function registryPath(fx) {
  return path.join(fx.canonical, ".git", "codex-isolated-workspaces.json");
}

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
  assert.equal(parsed.commits.length, 1);
  assert.equal(fs.existsSync(parsed.bundle), true);
  const verification = git(fx.canonical, ["bundle", "verify", parsed.bundle]);
  assert.match(verification, /The bundle requires this ref:/);
  assert.match(verification, new RegExp(parsed.baseCommit));
  fs.rmSync(path.dirname(parsed.bundle), { recursive: true, force: true });
});
