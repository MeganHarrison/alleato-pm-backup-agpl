#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  checkCapabilities,
  linkWorkspace,
  provisionWorkspaceDependencies,
} from "./machine-capabilities.mjs";

function fail(message) {
  throw new Error(message);
}

function git(cwd, args) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  } catch (error) {
    fail(error?.stderr?.toString().trim() || `git ${args.join(" ")} failed`);
  }
}

function succeeds(cwd, args) {
  try {
    execFileSync("git", args, { cwd, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function blobAt(cwd, ref, file) {
  try {
    return git(cwd, ["rev-parse", `${ref}:${file}`]);
  } catch {
    return null;
  }
}

function usage() {
  return `Usage:
  node scripts/ops/isolated-session-workspace.mjs create --session <id> --task <id> --paths <path[,path...]> --expires-hours <n> [--capabilities <profile[,profile...]>]
  node scripts/ops/isolated-session-workspace.mjs status
  node scripts/ops/isolated-session-workspace.mjs handoff --session <id> --task <id>
  node scripts/ops/isolated-session-workspace.mjs retire --session <id> --task <id>
  node scripts/ops/isolated-session-workspace.mjs publish --session <id>
  node scripts/ops/isolated-session-workspace.mjs sweep --retire-published yes

This is an opt-in exception for a user-requested or confirmed runtime/dependency
isolation need. Routine single-session work uses the canonical main checkout,
path-scoped leases, and codex:finish.`;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "-h") return { command: "help" };
  if (!["create", "status", "handoff", "retire", "publish", "sweep"].includes(command)) fail(`Unknown command '${command}'.\n\n${usage()}`);
  const options = { command };
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!key?.startsWith("--") || !value || value.startsWith("--")) fail(`Invalid arguments.\n\n${usage()}`);
    options[key.slice(2)] = value;
  }
  return options;
}

function repository() {
  const cwd = process.cwd();
  const commonGitDir = fs.realpathSync(git(cwd, ["rev-parse", "--git-common-dir"]));
  const canonicalSetting = git(cwd, ["config", "--local", "--get", "codex.canonicalCheckout"]);
  const canonical = fs.realpathSync(canonicalSetting);
  return {
    root: canonical,
    canonical,
    commonGitDir,
    registryPath: path.join(commonGitDir, "codex-isolated-workspaces.json"),
  };
}

function readRegistry(repo) {
  if (!fs.existsSync(repo.registryPath)) return { schemaVersion: 1, workspaces: [] };
  const value = JSON.parse(fs.readFileSync(repo.registryPath, "utf8"));
  return { schemaVersion: 1, workspaces: Array.isArray(value.workspaces) ? value.workspaces : [] };
}

function writeRegistry(repo, registry) {
  const temporary = `${repo.registryPath}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(registry, null, 2)}\n`, { flag: "wx" });
  fs.renameSync(temporary, repo.registryPath);
}

function threadId() {
  const value = String(process.env.CODEX_THREAD_ID || "").trim();
  if (!value) fail("CODEX_THREAD_ID is unavailable; refusing an unauthenticated session workspace.");
  return value;
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

function normalizeOwnedPaths(raw) {
  const values = String(raw || "").split(",").map((value) => path.posix.normalize(value.trim()).replace(/^\.\//, "")).filter(Boolean);
  if (!values.length) fail("--paths must name at least one repository-relative path.");
  for (const value of values) {
    if (path.isAbsolute(value) || value === "." || value === ".." || value.startsWith("../")) fail(`Unsafe owned path '${value}'.`);
  }
  return [...new Set(values)];
}

function overlaps(left, right) {
  return left === right || left.startsWith(`${right.replace(/\/$/, "")}/`) || right.startsWith(`${left.replace(/\/$/, "")}/`);
}

function activeWorkspaces(registry) {
  const now = Date.now();
  return registry.workspaces.filter((workspace) => {
    if (workspace.status !== "active") return false;
    const expiresAt = Date.parse(workspace.expiresAt);
    return !Number.isFinite(expiresAt) || expiresAt > now;
  });
}

function recoverMissingActiveWorkspaces(repo, registry) {
  // `git worktree prune` only removes Git metadata for paths that are already
  // missing; it never removes a workspace directory. Do this before deciding
  // whether an active registry entry can still own a path.
  git(repo.root, ["worktree", "prune"]);
  const registered = git(repo.root, ["worktree", "list", "--porcelain"]);
  const missing = [];
  for (const workspace of activeWorkspaces(registry)) {
    const stillRegistered = registered.includes(`worktree ${workspace.worktree}\n`);
    if (stillRegistered || fs.existsSync(workspace.worktree)) continue;
    workspace.status = "missing";
    workspace.missingAt = new Date().toISOString();
    workspace.missingReason = "Workspace directory and Git worktree record were both missing during create recovery.";
    missing.push(`${workspace.session} / ${workspace.task}`);
  }
  if (missing.length > 0) writeRegistry(repo, registry);
  return missing;
}

function findOwned(registry, options) {
  const workspace = activeWorkspaces(registry).find((candidate) => candidate.session === options.session && candidate.task === options.task);
  if (!workspace) fail(`No active workspace exists for ${options.session} / ${options.task}.`);
  if (workspace.threadId !== threadId()) fail(`Workspace belongs to Codex task ${workspace.threadId}, not ${threadId()}. A session label is not ownership.`);
  return workspace;
}

function inferredCapabilities(ownedPaths, requested = "") {
  if (requested) return requested;
  const runtimeOwned = ownedPaths.some(
    (owned) =>
      owned === "backend" ||
      owned.startsWith("backend/") ||
      owned === "agents" ||
      owned.startsWith("agents/") ||
      owned === "render.yaml",
  );
  if (runtimeOwned) return "full";
  const databaseOwned = ownedPaths.some(
    (owned) =>
      owned === "supabase" ||
      owned.startsWith("supabase/") ||
      owned.endsWith("database.types.ts"),
  );
  if (databaseOwned) return "database";
  const frontendOwned = ownedPaths.some(
    (owned) => owned === "frontend" || owned.startsWith("frontend/"),
  );
  return frontendOwned ? "browser" : "core";
}

async function create(repo, registry, options) {
  if (!options.session || !options.task || !options.paths || !options["expires-hours"]) fail(`create requires --session, --task, --paths, and --expires-hours.\n\n${usage()}`);
  const hours = Number(options["expires-hours"]);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 168) fail("--expires-hours must be between 0 and 168.");
  const ownedPaths = normalizeOwnedPaths(options.paths);
  const capabilities = inferredCapabilities(ownedPaths, options.capabilities);
  const recoveredMissing = recoverMissingActiveWorkspaces(repo, registry);
  for (const workspace of recoveredMissing) {
    console.warn(`Recovered missing workspace registry entry: ${workspace}`);
  }
  for (const existing of activeWorkspaces(registry)) {
    const collision = ownedPaths.find((candidate) => existing.paths.some((owned) => overlaps(candidate, owned)));
    if (collision) fail(`Owned path '${collision}' overlaps ${existing.session} / ${existing.task}. Split ownership or finish that workspace first.`);
  }
  const capabilityResult = await checkCapabilities({ profile: capabilities });
  git(repo.root, ["fetch", "origin", "main", "--quiet"]);
  const baseRoot = path.resolve(process.env.CODEX_ISOLATED_WORKSPACE_ROOT || path.join(os.homedir(), ".codex", "isolated-workspaces"));
  if (baseRoot === repo.canonical || baseRoot.startsWith(`${repo.canonical}${path.sep}`)) fail("Isolated workspace root must be outside the canonical checkout.");
  fs.mkdirSync(baseRoot, { recursive: true });
  const suffix = crypto.randomBytes(3).toString("hex");
  const workspacePath = path.join(baseRoot, `${slug(options.session)}-${slug(options.task)}-${suffix}`);
  const branch = `codex/${slug(options.session)}-${slug(options.task)}-${suffix}`;
  git(repo.root, ["worktree", "add", "-b", branch, workspacePath, "origin/main"]);
  let providerLinkage;
  try {
    provisionWorkspaceDependencies(workspacePath, capabilityResult.profiles);
    providerLinkage = linkWorkspace(
      workspacePath,
      {},
      capabilityResult.profiles,
    );
  } catch (error) {
    const cleanupFailures = [];
    try {
      git(repo.root, ["worktree", "remove", "--force", workspacePath]);
    } catch (cleanupError) {
      try {
        fs.rmSync(workspacePath, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 200,
        });
        git(repo.root, ["worktree", "prune"]);
      } catch (fallbackError) {
        cleanupFailures.push(
          fallbackError instanceof Error
            ? fallbackError.message
            : String(fallbackError),
        );
      }
    }
    try {
      git(repo.root, ["branch", "-D", branch]);
    } catch (cleanupError) {
      cleanupFailures.push(
        cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      );
    }
    const cause = error instanceof Error ? error.message : String(error);
    fail(
      cleanupFailures.length > 0
        ? `${cause}\nTransactional cleanup also failed: ${cleanupFailures.join(" | ")}`
        : cause,
    );
  }
  const record = {
    session: options.session,
    task: options.task,
    threadId: threadId(),
    paths: ownedPaths,
    worktree: workspacePath,
    branch,
    baseCommit: git(workspacePath, ["rev-parse", "HEAD"]),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + hours * 3_600_000).toISOString(),
    status: "active",
    capabilities: capabilityResult.profiles,
    providerLinkage,
  };
  registry.workspaces.push(record);
  writeRegistry(repo, registry);
  console.log(`Workspace: ${workspacePath}`);
  console.log(`Branch: ${branch}`);
  console.log(`Expires: ${record.expiresAt}`);
  console.log(
    `Machine capabilities: ${record.capabilities.join(",")} (${capabilityResult.cached ? "cached" : "refreshed"})`,
  );
  console.log(
    `Provider linkage: Supabase ${providerLinkage.linked ? providerLinkage.supabaseProjectRef : "not-applicable"}; Vercel ${
      providerLinkage.vercelProject
        ? `${providerLinkage.vercelTeam}/${providerLinkage.vercelProject}`
        : "not-applicable"
    }`,
  );
}

function status(registry) {
  const active = activeWorkspaces(registry);
  console.log(`Active isolated workspaces: ${active.length}`);
  for (const workspace of active) console.log(`${workspace.session} ${workspace.task} ${workspace.worktree} expires=${workspace.expiresAt} paths=${workspace.paths.join(",")}`);
}

function currentWorkspace(repo, registry, session, worktree = "") {
  const current = fs.realpathSync(worktree || git(process.cwd(), ["rev-parse", "--show-toplevel"]));
  const matches = activeWorkspaces(registry).filter((workspace) => {
    if (workspace.session !== session) return false;
    try {
      return fs.realpathSync(workspace.worktree) === current;
    } catch {
      return false;
    }
  });
  if (matches.length !== 1) fail(`Expected one active workspace for ${session} at ${current}; found ${matches.length}.`);
  return matches[0];
}

function handoff(repo, registry, options) {
  const workspace = findOwned(registry, options);
  if (!fs.existsSync(workspace.worktree)) fail(`Workspace is missing: ${workspace.worktree}`);
  const dirty = git(workspace.worktree, ["status", "--porcelain"]);
  if (dirty) fail(`Workspace has uncommitted work; commit task-owned changes before handoff:\n${dirty}`);
  const head = git(workspace.worktree, ["rev-parse", "HEAD"]);
  if (head === workspace.baseCommit) fail("Workspace has no commits to hand off.");
  const commits = git(workspace.worktree, ["rev-list", "--reverse", `${workspace.baseCommit}..${head}`]).split("\n").filter(Boolean);
  const handoffRoot = path.join(os.homedir(), ".codex", "session-handoffs", `${slug(workspace.session)}-${slug(workspace.task)}-${Date.now()}`);
  fs.mkdirSync(handoffRoot, { recursive: true });
  // Commit ids are an immutable recovery receipt. Copying repository history
  // into every handoff consumed gigabytes without improving recoverability.
  const manifest = { schemaVersion: 2, ...workspace, head, commits, generatedAt: new Date().toISOString(), integrationCommand: `git cherry-pick ${commits.join(" ")}` };
  const manifestPath = path.join(handoffRoot, "manifest.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  workspace.handoff = manifestPath;
  workspace.head = head;
  writeRegistry(repo, registry);
  console.log(`Handoff manifest: ${manifestPath}`);
  console.log(`Commits: ${commits.join(" ")}`);
}

function retire(repo, registry, options) {
  const workspace = findOwned(registry, options);
  if (!workspace.handoff) fail("Create a committed handoff before retiring the workspace.");
  git(repo.root, ["fetch", "origin", "main", "--quiet"]);
  const merged = succeeds(repo.root, ["merge-base", "--is-ancestor", workspace.head, "origin/main"]);
  const exactFilePublication = !merged && workspace.paths.every((file) => {
    if (file.includes("*")) return false;
    return blobAt(repo.root, workspace.head, file) === blobAt(repo.root, "origin/main", file);
  });
  if (!merged && !exactFilePublication) {
    fail("Workspace head is not integrated on origin/main and its owned files do not match the published remote state.");
  }
  const registeredWorktrees = git(repo.root, ["worktree", "list", "--porcelain"]);
  if (registeredWorktrees.includes(`worktree ${workspace.worktree}\n`)) {
    git(repo.root, ["worktree", "remove", "--force", workspace.worktree]);
  }
  // Either ancestry or exact owned-file comparison proves publication. Local main
  // may be intentionally behind origin/main, so `-d` is too strict.
  if (git(repo.root, ["branch", "--list", workspace.branch])) {
    git(repo.root, ["branch", "-D", workspace.branch]);
  }
  workspace.status = "retired";
  workspace.retiredAt = new Date().toISOString();
  writeRegistry(repo, registry);
  console.log(`Retired ${workspace.session} / ${workspace.task}; its commit is present on origin/main.`);
}

function publish(repo, registry, options) {
  if (!options.session) fail(`publish requires --session.\n\n${usage()}`);
  const workspace = currentWorkspace(repo, registry, options.session, options.worktree);
  handoff(repo, registry, { session: workspace.session, task: workspace.task });
  workspace.publishedAt = new Date().toISOString();
  writeRegistry(repo, registry);
  console.log(`Publication receipt recorded for ${workspace.session} / ${workspace.task}. Run sweep from the canonical checkout to retire it.`);
}

function sweep(repo, registry, options) {
  const now = Date.now();
  const expired = registry.workspaces.filter((workspace) => workspace.status === "active" && Date.parse(workspace.expiresAt) <= now);
  const worktrees = git(repo.root, ["worktree", "list", "--porcelain"]);
  const prunable = (worktrees.match(/^prunable /gm) || []).length;
  const published = activeWorkspaces(registry).filter((workspace) => workspace.publishedAt);
  console.log(`Workspace sweep: ${activeWorkspaces(registry).length} active, ${published.length} published awaiting retirement, ${expired.length} expired, ${prunable} prunable Git records.`);
  for (const workspace of expired) {
    console.log(`EXPIRED (preserved): ${workspace.session} ${workspace.task} ${workspace.worktree}`);
  }
  if (prunable > 0) {
    console.log("Run git worktree prune to remove only Git records for already-missing directories; no workspace contents are deleted.");
  }
  if (options["retire-published"] !== "yes") return;
  for (const workspace of published) retire(repo, registry, { session: workspace.session, task: workspace.task });
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.command === "help") console.log(usage());
  else {
    const repo = repository();
    const registry = readRegistry(repo);
    if (options.command === "create") await create(repo, registry, options);
    else if (options.command === "status") status(registry);
    else if (options.command === "handoff") handoff(repo, registry, options);
    else if (options.command === "retire") retire(repo, registry, options);
    else if (options.command === "publish") publish(repo, registry, options);
    else if (options.command === "sweep") sweep(repo, registry, options);
  }
} catch (error) {
  console.error(`[isolated-session-workspace] ${error.message}`);
  process.exitCode = 1;
}
