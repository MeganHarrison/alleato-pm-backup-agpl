#!/usr/bin/env node

import fs from "node:fs";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

function fail(message) {
  throw new Error(message);
}

function git(args) {
  try {
    return execFileSync("git", args, { cwd: process.cwd(), encoding: "utf8" }).trim();
  } catch (error) {
    const detail = error?.stderr?.toString().trim() || error?.message || "unknown git failure";
    fail(`Git command failed: git ${args.join(" ")}\n${detail}`);
  }
}

function gitOptional(args) {
  try {
    return execFileSync("git", args, { cwd: process.cwd(), encoding: "utf8" }).trim();
  } catch (error) {
    if (error?.status === 1) return "";
    const detail = error?.stderr?.toString().trim() || error?.message || "unknown git failure";
    fail(`Git command failed: git ${args.join(" ")}\n${detail}`);
  }
}

function usage() {
  return `Usage:
  node scripts/ops/checkout-session-gate.mjs bootstrap
  node scripts/ops/checkout-session-gate.mjs status
  node scripts/ops/checkout-session-gate.mjs audit --session <id>
  node scripts/ops/checkout-session-gate.mjs heartbeat --session <id>
  node scripts/ops/checkout-session-gate.mjs claim --session <id> --task <id> --paths <path[,path...]> [--resume]
  node scripts/ops/checkout-session-gate.mjs quarantine --session <id> --task <id> --reason <why> --paths <path[,path...]> --stale-minutes <n>
  node scripts/ops/checkout-session-gate.mjs release --session <id> [--handoff --reason <why>]

Writers may hold non-overlapping path-scoped leases. Research, review, and long-running verification may run concurrently.
Each writer must use the registered canonical checkout, be on main, and may not claim a path that is already dirty.
Leases expire after ${leaseTtlMinutes()} minutes without a heartbeat; expiry clears only the reservation, never files.`;
}

function leaseTtlMinutes() {
  const configured = Number(process.env.CODEX_CHECKOUT_GATE_LEASE_TTL_MINUTES ?? 60);
  return Number.isFinite(configured) && configured > 0 ? configured : 60;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "-h") return { command: "help" };
  const options = { command };
  for (let index = 0; index < rest.length; index += 1) {
    const key = rest[index];
    if (!key.startsWith("--")) fail(`Unexpected argument: ${key}\n\n${usage()}`);
    if (key === "--resume" || key === "--handoff") {
      options[key.slice(2)] = true;
      continue;
    }
    const value = rest[++index];
    if (!value || value.startsWith("--")) fail(`Missing value for ${key}\n\n${usage()}`);
    options[key.slice(2)] = value;
  }
  if (!["bootstrap", "status", "audit", "heartbeat", "claim", "quarantine", "release"].includes(command)) {
    fail(`Unknown command: ${command}\n\n${usage()}`);
  }
  return options;
}

function context() {
  const root = fs.realpathSync(git(["rev-parse", "--show-toplevel"]));
  const gitDir = fs.realpathSync(git(["rev-parse", "--absolute-git-dir"]));
  const canonical = gitOptional(["config", "--local", "--get", "codex.canonicalCheckout"]);
  return {
    root,
    gitDir,
    canonical: canonical ? fs.realpathSync(canonical) : null,
    branch: git(["branch", "--show-current"]) || "detached",
    dirty: git(["status", "--porcelain"]).split("\n").filter(Boolean),
    leaseFile: path.join(gitDir, "codex-session-write-lease.json"),
    historyFile: path.join(gitDir, "codex-session-write-lease-history.jsonl"),
  };
}

function readLeases(ctx) {
  if (!fs.existsSync(ctx.leaseFile)) return [];
  try {
    const stored = JSON.parse(fs.readFileSync(ctx.leaseFile, "utf8"));
    return Array.isArray(stored.leases) ? stored.leases : [stored];
  } catch (error) {
    fail(`Lease file is unreadable: ${ctx.leaseFile}. Preserve it and repair manually. ${error.message}`);
  }
}

function writeLeases(ctx, leases) {
  if (leases.length === 0) return fs.unlinkSync(ctx.leaseFile);
  fs.writeFileSync(ctx.leaseFile, `${JSON.stringify({ schemaVersion: 2, leases }, null, 2)}\n`, "utf8");
}

function withGateLock(ctx, action) {
  const lockFile = path.join(ctx.gitDir, "codex-session-write-lease.lock");
  let descriptor;
  try {
    descriptor = fs.openSync(lockFile, "wx", 0o600);
  } catch (error) {
    if (error?.code === "EEXIST") {
      fail("Another checkout-gate command is updating lease state. Retry the same command; do not recover, release, or edit the lease file manually.");
    }
    throw error;
  }
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`);
    return action();
  } finally {
    fs.closeSync(descriptor);
    fs.unlinkSync(lockFile);
  }
}

function assertCanonicalMain(ctx) {
  if (!ctx.canonical) {
    fail(`No canonical checkout is registered. Run \`node scripts/ops/checkout-session-gate.mjs bootstrap\` once from the intended main checkout.`);
  }
  if (ctx.root !== ctx.canonical) {
    fail(`This is not the canonical checkout.\nExpected: ${ctx.canonical}\nActual:   ${ctx.root}\nDo not edit here; use the canonical checkout.`);
  }
  if (ctx.branch !== "main") {
    fail(`Canonical checkout is on ${ctx.branch}, not main. Preserve or publish the current work before switching; do not use a task branch for routine work.`);
  }
}

function parsePositiveNumber(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) fail(`${label} must be a positive number; received '${value}'.`);
  return parsed;
}

function normalizeQuarantinePath(ctx, value) {
  const raw = String(value ?? "").trim();
  if (!raw) fail("Quarantine paths cannot be empty.");
  if (path.isAbsolute(raw)) fail(`Quarantine path must be repository-relative, received absolute path '${raw}'.`);
  const relative = path.normalize(raw).replace(/^\.\//, "");
  if (!relative || relative === "." || relative === ".." || relative.startsWith(`..${path.sep}`)) {
    fail(`Unsafe quarantine path '${raw}'. Name one exact path inside the checkout.`);
  }
  const absolute = path.resolve(ctx.root, relative);
  if (!absolute.startsWith(`${ctx.root}${path.sep}`)) fail(`Quarantine path escapes the checkout: '${raw}'.`);
  if (absolute === ctx.gitDir || absolute.startsWith(`${ctx.gitDir}${path.sep}`)) fail("Quarantining Git metadata is forbidden.");
  if (!fs.existsSync(absolute)) fail(`Quarantine path does not exist: '${relative}'.`);
  const broadDirectories = new Set(["frontend", "backend", "scripts", "docs", "supabase"]);
  if (fs.statSync(absolute).isDirectory() && broadDirectories.has(relative)) {
    fail(`Refusing broad quarantine directory '${relative}'. Name the exact owned subpath.`);
  }
  return { relative, absolute };
}

function listTreeFiles(absolute, relative) {
  const stat = fs.lstatSync(absolute);
  if (stat.isSymbolicLink()) fail(`Quarantine refuses symbolic links: '${relative}'.`);
  if (stat.isFile()) return [{ absolute, relative, stat }];
  if (!stat.isDirectory()) fail(`Quarantine supports only regular files and directories: '${relative}'.`);
  return fs.readdirSync(absolute, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => listTreeFiles(path.join(absolute, entry.name), path.join(relative, entry.name)));
}

function sha256(absolute) {
  return crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex");
}

function assertUntrackedDirtyPath(ctx, target) {
  if (gitOptional(["check-ignore", "--no-index", "--", target.relative])) {
    fail(`Ignored paths are not eligible for quarantine: '${target.relative}'.`);
  }
  const tracked = gitOptional(["ls-files", "--", target.relative]);
  if (tracked) fail(`Tracked work cannot be quarantined: '${target.relative}'. Publish or hand it off to its owner.`);
  const status = git(["status", "--porcelain", "--untracked-files=all", "--", target.relative])
    .split("\n")
    .filter(Boolean);
  if (!status.length) fail(`Path is not reported dirty by Git: '${target.relative}'.`);
  const nonUntracked = status.filter((line) => !line.startsWith("?? "));
  if (nonUntracked.length) {
    fail(`Path contains tracked or non-untracked work and cannot be quarantined: '${target.relative}'.\n${nonUntracked.join("\n")}`);
  }
}

function assertStale(files, staleMinutes, now = Date.now()) {
  const newest = Math.max(...files.map((file) => file.stat.mtimeMs));
  const ageMinutes = (now - newest) / 60_000;
  if (ageMinutes < staleMinutes) {
    fail(
      `Quarantine refused fresh work: newest file age=${ageMinutes.toFixed(1)} minutes, required=${staleMinutes}. ` +
        "Wait for the owner or use an evidence-backed threshold that the files actually satisfy.",
    );
  }
  return { newestMtime: new Date(newest).toISOString(), ageMinutes };
}

function assertNoOpenHandles(targets) {
  const lsof = process.env.CODEX_CHECKOUT_GATE_LSOF_BIN || "lsof";
  for (const target of targets) {
    const args = fs.statSync(target.absolute).isDirectory() ? ["+D", target.absolute] : [target.absolute];
    const result = spawnSync(lsof, args, { encoding: "utf8" });
    if (result.error?.code === "ENOENT") {
      fail(`Cannot prove '${target.relative}' is inactive because lsof is unavailable. Install lsof or preserve the path for its owner.`);
    }
    if (result.error) fail(`Open-handle check failed for '${target.relative}': ${result.error.message}`);
    if (result.status === 0) {
      fail(`Quarantine refused active work with an open file handle: '${target.relative}'.\n${String(result.stdout || "").trim()}`);
    }
    if (result.status !== 1) {
      fail(`Open-handle check returned unexpected status ${result.status} for '${target.relative}'.`);
    }
  }
}

function quarantinePaths(ctx, leases, options) {
  assertCanonicalMain(ctx);
  if (leases.length) {
    fail(`Quarantine is forbidden while active writer lease(s) exist. Coordinate with the owner.`);
  }
  if (!options.session || !options.task || !options.reason || !options.paths || !options["stale-minutes"]) {
    fail(`quarantine requires --session, --task, --reason, --paths, and --stale-minutes.\n\n${usage()}`);
  }
  const staleMinutes = parsePositiveNumber(options["stale-minutes"], "--stale-minutes");
  const rawPaths = options.paths.split(",").map((value) => value.trim()).filter(Boolean);
  if (!rawPaths.length) fail("--paths must name at least one exact path.");
  const targets = rawPaths.map((value) => normalizeQuarantinePath(ctx, value));
  if (new Set(targets.map((target) => target.relative)).size !== targets.length) fail("Duplicate quarantine paths are not allowed.");
  for (let index = 0; index < targets.length; index += 1) {
    for (let other = index + 1; other < targets.length; other += 1) {
      if (targets[other].absolute.startsWith(`${targets[index].absolute}${path.sep}`) || targets[index].absolute.startsWith(`${targets[other].absolute}${path.sep}`)) {
        fail("Quarantine paths cannot overlap; name the parent or the children, not both.");
      }
    }
  }
  for (const target of targets) assertUntrackedDirtyPath(ctx, target);
  const files = targets.flatMap((target) => listTreeFiles(target.absolute, target.relative));
  if (!files.length) fail("Quarantine refuses empty directories because there is no recoverable file evidence.");
  const stale = assertStale(files, staleMinutes);
  assertNoOpenHandles(targets);

  const safeSession = options.session.replace(/[^a-zA-Z0-9_-]+/g, "-");
  const safeTask = options.task.replace(/[^a-zA-Z0-9_-]+/g, "-");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const quarantineRoot = path.resolve(
    process.env.CODEX_CHECKOUT_GATE_QUARANTINE_ROOT || path.join(os.homedir(), ".codex", "session-quarantine"),
  );
  if (quarantineRoot === ctx.root || quarantineRoot.startsWith(`${ctx.root}${path.sep}`)) {
    fail(`Quarantine root must be outside the canonical checkout: '${quarantineRoot}'.`);
  }
  const destinationRoot = path.join(quarantineRoot, `${stamp}-${safeSession}-${safeTask}-${crypto.randomBytes(4).toString("hex")}`);
  const fileRecords = files.map((file) => ({
    path: file.relative,
    size: file.stat.size,
    modifiedAt: file.stat.mtime.toISOString(),
    sha256: sha256(file.absolute),
  }));
  const moved = [];
  try {
    for (const target of targets) {
      const destination = path.join(destinationRoot, "checkout", target.relative);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.renameSync(target.absolute, destination);
      moved.push({ ...target, destination });
    }
    const manifest = {
      schemaVersion: 1,
      quarantinedAt: new Date().toISOString(),
      session: options.session,
      task: options.task,
      reason: options.reason,
      checkout: ctx.root,
      checkoutHead: git(["rev-parse", "HEAD"]),
      staleMinutesRequired: staleMinutes,
      newestSourceMtime: stale.newestMtime,
      paths: moved.map((target) => ({
        originalPath: target.relative,
        quarantinedPath: path.relative(destinationRoot, target.destination),
        restoreCommand: `mv ${JSON.stringify(target.destination)} ${JSON.stringify(target.absolute)}`,
      })),
      files: fileRecords,
    };
    const manifestPath = path.join(destinationRoot, "manifest.json");
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    if (git(["status", "--porcelain"]).trim()) {
      fail("Quarantine completed, but unrelated dirty paths remain. Review status before claiming a writer lease.");
    }
    appendHistory(ctx, {
      event: "quarantine",
      session: options.session,
      task: options.task,
      at: manifest.quarantinedAt,
      reason: options.reason,
      manifest: manifestPath,
      paths: targets.map((target) => target.relative),
    });
    console.log(`Quarantined ${targets.length} path(s) without deletion.`);
    console.log(`Manifest: ${manifestPath}`);
    console.log(`Next: node scripts/ops/checkout-session-gate.mjs claim --session ${options.session} --task ${options.task} --paths <owned-paths>`);
  } catch (error) {
    for (const target of moved.reverse()) {
      if (!fs.existsSync(target.destination)) continue;
      fs.mkdirSync(path.dirname(target.absolute), { recursive: true });
      fs.renameSync(target.destination, target.absolute);
    }
    fs.rmSync(destinationRoot, { recursive: true, force: true });
    throw error;
  }
}

function appendHistory(ctx, entry) {
  fs.appendFileSync(ctx.historyFile, `${JSON.stringify(entry)}\n`, "utf8");
}

function mayResumeOwnScope(ctx, { session, task, paths }) {
  if (!fs.existsSync(ctx.historyFile)) return false;
  const records = fs.readFileSync(ctx.historyFile, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const lastRecord = [...records].reverse().find((record) => record.session === session && record.task === task);
  if (!lastRecord || !["claim", "release", "recover", "expire"].includes(lastRecord.event)) return false;
  const originalClaim = [...records].reverse().find((record) => (
    record.event === "claim" && record.session === session && record.task === task && Array.isArray(record.paths)
  ));
  return Boolean(originalClaim && paths.every((owned) => originalClaim.paths.some((prior) => pathsOverlap(owned, prior))));
}

function leaseLastSeenAt(lease) {
  return Date.parse(lease.heartbeatAt ?? lease.claimedAt ?? 0);
}

function leaseAgeMinutes(lease, now = Date.now()) {
  const lastSeenAt = leaseLastSeenAt(lease);
  return Number.isFinite(lastSeenAt) ? (now - lastSeenAt) / 60_000 : Infinity;
}

function isLeaseStale(lease, now = Date.now()) {
  return leaseAgeMinutes(lease, now) >= leaseTtlMinutes();
}

function reapStaleLeases(ctx, leases, { reason = "lease heartbeat expired" } = {}) {
  const stale = leases.filter((lease) => isLeaseStale(lease));
  if (!stale.length) return { active: leases, stale: [] };
  const active = leases.filter((lease) => !isLeaseStale(lease));
  writeLeases(ctx, active);
  for (const lease of stale) {
    appendHistory(ctx, {
      event: "expire",
      session: lease.session,
      task: lease.task,
      at: new Date().toISOString(),
      reason,
      lastSeenAt: lease.heartbeatAt ?? lease.claimedAt,
      ttlMinutes: leaseTtlMinutes(),
      paths: lease.paths,
    });
  }
  return { active, stale };
}

function printStatus(ctx, leases) {
  const stale = leases.filter((lease) => isLeaseStale(lease));
  const active = leases.filter((lease) => !isLeaseStale(lease));
  console.log(`Canonical checkout: ${ctx.canonical ?? "UNREGISTERED"}`);
  console.log(`Current checkout:   ${ctx.root}`);
  console.log(`Branch:             ${ctx.branch}`);
  console.log(`Dirty paths:        ${ctx.dirty.length}`);
  console.log(`Active leases:      ${active.length ? active.map((lease) => `${lease.session} (${lease.task})`).join(", ") : "none"}`);
  console.log(`Expired leases:     ${stale.length ? stale.map((lease) => `${lease.session} (${lease.task})`).join(", ") : "none"}`);
  for (const lease of active) console.log(`Lease paths [${lease.session}]: ${lease.paths.join(", ")}`);
  for (const lease of stale) console.log(`Expired paths [${lease.session}]: ${lease.paths.join(", ")}`);
  console.log("Next: claim exact task-owned paths. Unrelated dirty paths and non-overlapping active leases do not block a claim.");
}

function dirtyPathFromStatus(line) {
  const raw = String(line);
  // `git()` trims the aggregate output, so the first porcelain line can lose
  // its leading space when it represents an unstaged modification. Accept both
  // canonical two-column porcelain and that first-line trimmed form.
  const value = raw.slice(raw[1] === " " ? 2 : 3).trim();
  const renamed = value.includes(" -> ") ? value.split(" -> ").at(-1) : value;
  return renamed.replace(/^"|"$/g, "");
}

function leaseOwnsPath(lease, candidate) {
  return lease.paths.some((owned) => candidate === owned || candidate.startsWith(`${owned.replace(/\/$/, "")}/`));
}

function pathsOverlap(left, right) {
  return left === right || left.startsWith(`${right.replace(/\/$/, "")}/`) || right.startsWith(`${left.replace(/\/$/, "")}/`);
}

function outOfLeaseDirtyPaths(ctx, leases, baselineDirty = []) {
  return ctx.dirty
    .map(dirtyPathFromStatus)
    .filter(Boolean)
    .filter((candidate) => !baselineDirty.includes(candidate))
    .filter((candidate) => !leases.some((lease) => leaseOwnsPath(lease, candidate)));
}

function ownedDirtyPaths(ctx, lease) {
  return ctx.dirty
    .map(dirtyPathFromStatus)
    .filter(Boolean)
    .filter((candidate) => leaseOwnsPath(lease, candidate));
}

function auditLease(ctx, leases, session) {
  assertCanonicalMain(ctx);
  if (!session) fail(`audit requires --session.\n\n${usage()}`);
  const lease = leases.find((candidate) => candidate.session === session);
  if (!lease) fail("Lease audit failed: no active writer lease exists for this session.");
  const violations = outOfLeaseDirtyPaths(ctx, leases, lease.baselineDirty ?? []);
  if (violations.length) {
    fail(
      `Lease audit found ${violations.length} out-of-lease dirty path(s) while ${lease.session} owns ${lease.task}:\n` +
        `${violations.join("\n")}\n` +
        "Do not stage or absorb them. Identify the violating session and use an isolated session workspace for concurrent mutation.",
    );
  }
  console.log(`Lease audit passed for ${lease.session} (${lease.task}); no new dirty path is outside an active lease.`);
}

function heartbeatLease(ctx, leases, session, event = "heartbeat") {
  assertCanonicalMain(ctx);
  if (!session) fail(`${event} requires --session.\n\n${usage()}`);
  const leaseIndex = leases.findIndex((candidate) => candidate.session === session);
  if (leaseIndex === -1) fail(`Lease ${event} failed: no active writer lease exists for this session.`);
  if (isLeaseStale(leases[leaseIndex])) {
    fail(`Lease ${event} failed: ${session} expired after ${leaseAgeMinutes(leases[leaseIndex]).toFixed(1)} minutes without a heartbeat. Claim a clean non-overlapping scope; dirty owned files remain protected.`);
  }
  const now = new Date().toISOString();
  const updated = { ...leases[leaseIndex], heartbeatAt: now };
  const next = [...leases];
  next[leaseIndex] = updated;
  writeLeases(ctx, next);
  appendHistory(ctx, { event, session, task: updated.task, at: now });
  return updated;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.command === "help") return console.log(usage());
  const ctx = context();

  return withGateLock(ctx, () => mainWithLock(options, ctx));
}

function mainWithLock(options, ctx) {

  if (options.command === "bootstrap") {
    if (ctx.branch !== "main") {
      fail(`Refusing to register ${ctx.root}: it is on ${ctx.branch}, not main. Recover the checkout first.`);
    }
    git(["config", "--local", "codex.canonicalCheckout", ctx.root]);
    console.log(`Canonical checkout registered: ${ctx.root}`);
    return;
  }

  const leases = readLeases(ctx);
  if (options.command === "status") {
    printStatus(ctx, leases);
    if (!ctx.canonical || ctx.root !== ctx.canonical || ctx.branch !== "main") {
      process.exitCode = 2;
    }
    return;
  }

  const { active: activeLeases, stale: expiredLeases } = reapStaleLeases(ctx, leases);
  if (expiredLeases.length) {
    console.log(`Expired ${expiredLeases.length} stale lease reservation(s); no files were moved or deleted.`);
  }

  if (options.command === "audit") {
    auditLease(ctx, activeLeases, options.session);
    heartbeatLease(ctx, activeLeases, options.session, "audit");
    return;
  }

  if (options.command === "heartbeat") {
    const lease = heartbeatLease(ctx, activeLeases, options.session);
    console.log(`Lease heartbeat recorded for ${lease.session} (${lease.task}).`);
    return;
  }

  if (options.command === "quarantine") {
    quarantinePaths(ctx, activeLeases, options);
    return;
  }

  if (options.command === "claim") {
    if (!options.session || !options.task || !options.paths) fail(`claim requires --session, --task, and --paths.\n\n${usage()}`);
    assertCanonicalMain(ctx);
    const record = {
      session: options.session,
      task: options.task,
      paths: options.paths.split(",").map((value) => value.trim()).filter(Boolean),
      claimedAt: new Date().toISOString(),
      checkout: ctx.root,
      head: git(["rev-parse", "HEAD"]),
      baselineDirty: ctx.dirty.map(dirtyPathFromStatus).filter(Boolean),
    };
    if (!record.paths.length) fail("--paths must name at least one owned path.");
    const conflictingLease = activeLeases.find((lease) => record.paths.some((owned) => lease.paths.some((active) => pathsOverlap(owned, active))));
    if (conflictingLease) fail(`Requested paths overlaps active lease ${conflictingLease.session} (${conflictingLease.task}).`);
    const alreadyDirty = record.paths.filter((owned) => record.baselineDirty.some((dirty) => pathsOverlap(owned, dirty)));
    if (alreadyDirty.length && !(options.resume && mayResumeOwnScope(ctx, record))) {
      fail(`Requested path is already dirty and unowned: ${alreadyDirty.join(", ")}.`);
    }
    if (options.resume && !alreadyDirty.length) {
      fail("--resume is only for recovering this session's previously leased dirty scope; use a normal claim for clean paths.");
    }
    if (options.resume) record.resumedAt = new Date().toISOString();
    writeLeases(ctx, [...activeLeases, record]);
    appendHistory(ctx, { event: "claim", ...record });
    console.log(`Write lease acquired by ${record.session} for ${record.task}.`);
    return;
  }

  if (!options.session) fail(`${options.command} requires --session.\n\n${usage()}`);
  const lease = activeLeases.find((candidate) => candidate.session === options.session);
  if (!lease) {
    const owners = activeLeases.map((candidate) => candidate.session).join(", ");
    fail(owners ? `Lease belongs to ${owners}; recover or release the owning session.` : "No active write lease exists for this session.");
  }
  const ownedDirty = ownedDirtyPaths(ctx, lease);
  if (ownedDirty.length && !options.handoff) {
    fail(
      `Release refused: ${lease.session} still owns ${ownedDirty.length} dirty path(s):\n${ownedDirty.join("\n")}\n` +
      "Publish the owned scope first. For a deliberate transfer, rerun with --handoff --reason \"why this work is being handed off\"; the lease history will retain the handoff evidence.",
    );
  }
  if (options.handoff && !options.reason) {
    fail("release --handoff requires --reason so the handoff records why dirty work remains.");
  }
  writeLeases(ctx, activeLeases.filter((candidate) => candidate.session !== options.session));
  appendHistory(ctx, {
    event: options.command,
    session: options.session,
    task: lease.task,
    at: new Date().toISOString(),
    reason: options.reason ?? "normal publish or handoff",
    handoff: Boolean(options.handoff),
    dirtyPaths: ownedDirty,
  });
  console.log(`Write lease released for ${options.session}.`);
}

try {
  main();
} catch (error) {
  console.error(`[checkout-session-gate] ${error.message}`);
  process.exitCode = 1;
}
