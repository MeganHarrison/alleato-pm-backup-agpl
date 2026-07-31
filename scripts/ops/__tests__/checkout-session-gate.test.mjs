import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const command = path.join(repoRoot, "scripts/ops/checkout-session-gate.mjs");
const temporaryDirectories = new Set();

test.afterEach(() => {
  for (const directory of temporaryDirectories) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
  temporaryDirectories.clear();
});

function git(cwd, args) {
  execFileSync("git", args, { cwd, stdio: "pipe" });
}

function makeRepo() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "checkout-gate-"));
  temporaryDirectories.add(cwd);
  git(cwd, ["init", "-b", "main"]);
  git(cwd, ["config", "user.email", "test@example.com"]);
  git(cwd, ["config", "user.name", "Test"]);
  fs.writeFileSync(path.join(cwd, "README.md"), "test\n");
  git(cwd, ["add", "README.md"]);
  git(cwd, ["commit", "-m", "initial"]);
  return cwd;
}

function fakeLsof(cwd) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fake-lsof-"));
  temporaryDirectories.add(directory);
  const file = path.join(directory, "fake-lsof.sh");
  fs.writeFileSync(file, "#!/bin/sh\nif [ \"$FAKE_LSOF_OPEN\" = \"1\" ]; then echo 'COMMAND PID USER FD TYPE NAME'; exit 0; fi\nexit 1\n");
  fs.chmodSync(file, 0o755);
  return file;
}

function run(cwd, args, env = {}) {
  return spawnSync(process.execPath, [command, ...args], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      CODEX_CHECKOUT_GATE_LSOF_BIN: fakeLsof(cwd),
      CODEX_CHECKOUT_GATE_QUARANTINE_ROOT: path.join(os.tmpdir(), "checkout-gate-quarantine"),
      ...env,
    },
  });
}

function makeStale(cwd, relative, minutes = 120) {
  const when = new Date(Date.now() - minutes * 60_000);
  fs.utimesSync(path.join(cwd, relative), when, when);
}

test("allows non-overlapping main-checkout writers and rejects an overlapping scope", () => {
  const cwd = makeRepo();
  assert.equal(run(cwd, ["bootstrap"]).status, 0);
  assert.equal(run(cwd, ["claim", "--session", "S1", "--task", "TASK-1", "--paths", "src/a.ts"]).status, 0);
  const second = run(cwd, ["claim", "--session", "S2", "--task", "TASK-2", "--paths", "src/b.ts"]);
  assert.equal(second.status, 0, second.stderr);
  const overlap = run(cwd, ["claim", "--session", "S3", "--task", "TASK-3", "--paths", "src/a.ts"]);
  assert.equal(overlap.status, 1);
  assert.match(overlap.stderr, /overlaps active lease S1/);
  assert.equal(run(cwd, ["release", "--session", "S1"]).status, 0);
  assert.equal(run(cwd, ["release", "--session", "S2"]).status, 0);
});

test("permits a scoped writer beside unrelated dirty work but protects owned dirt", () => {
  const cwd = makeRepo();
  assert.equal(run(cwd, ["bootstrap"]).status, 0);
  fs.writeFileSync(path.join(cwd, "unowned.txt"), "uncommitted\n");
  const allowed = run(cwd, ["claim", "--session", "S1", "--task", "TASK-1", "--paths", "src/a.ts"]);
  assert.equal(allowed.status, 0, allowed.stderr);
  const result = run(cwd, ["claim", "--session", "S2", "--task", "TASK-2", "--paths", "unowned.txt"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /already dirty/);
});

test("reports scoped work as claimable instead of treating all dirt and leases as a global failure", () => {
  const cwd = makeRepo();
  assert.equal(run(cwd, ["bootstrap"]).status, 0);
  assert.equal(run(cwd, ["claim", "--session", "S1", "--task", "TASK-1", "--paths", "src/a.ts"]).status, 0);
  fs.writeFileSync(path.join(cwd, "unrelated.txt"), "other writer work\n");
  const status = run(cwd, ["status"]);
  assert.equal(status.status, 0, status.stderr);
  assert.match(status.stdout, /Active leases:\s+S1 \(TASK-1\)/);
  assert.match(status.stdout, /Unrelated dirty paths and non-overlapping active leases do not block a claim/);
  assert.equal(run(cwd, ["claim", "--session", "S2", "--task", "TASK-2", "--paths", "src/b.ts"]).status, 0);
});

test("expires an unrenewed reservation without touching its dirty files", () => {
  const cwd = makeRepo();
  assert.equal(run(cwd, ["bootstrap"]).status, 0);
  assert.equal(run(cwd, ["claim", "--session", "S1", "--task", "TASK-1", "--paths", "owned"]).status, 0);
  fs.mkdirSync(path.join(cwd, "owned"), { recursive: true });
  fs.writeFileSync(path.join(cwd, "owned/work.txt"), "preserve me\n");
  const leasePath = path.join(cwd, ".git/codex-session-write-lease.json");
  const lease = JSON.parse(fs.readFileSync(leasePath, "utf8"));
  lease.leases[0].heartbeatAt = new Date(Date.now() - 120 * 60_000).toISOString();
  fs.writeFileSync(leasePath, `${JSON.stringify(lease)}\n`);

  const claim = run(cwd, ["claim", "--session", "S2", "--task", "TASK-2", "--paths", "src/b.ts"], { CODEX_CHECKOUT_GATE_LEASE_TTL_MINUTES: "30" });
  assert.equal(claim.status, 0, claim.stderr);
  assert.match(claim.stdout, /Expired 1 stale lease reservation/);
  assert.equal(fs.readFileSync(path.join(cwd, "owned/work.txt"), "utf8"), "preserve me\n");
  const history = fs.readFileSync(path.join(cwd, ".git/codex-session-write-lease-history.jsonl"), "utf8");
  assert.match(history, /"event":"expire"/);
});

test("permits a session to resume only its own previously leased dirty scope", () => {
  const cwd = makeRepo();
  assert.equal(run(cwd, ["bootstrap"]).status, 0);
  assert.equal(run(cwd, ["claim", "--session", "S1", "--task", "TASK-1", "--paths", "owned"]).status, 0);
  fs.mkdirSync(path.join(cwd, "owned"), { recursive: true });
  fs.writeFileSync(path.join(cwd, "owned/work.txt"), "preserve me\n");
  assert.equal(run(cwd, ["release", "--session", "S1", "--handoff", "--reason", "test resume"]).status, 0);
  const resumed = run(cwd, ["claim", "--session", "S1", "--task", "TASK-1", "--paths", "owned", "--resume"]);
  assert.equal(resumed.status, 0, resumed.stderr);
  const other = run(cwd, ["claim", "--session", "S2", "--task", "TASK-2", "--paths", "owned", "--resume"]);
  assert.equal(other.status, 1);
  assert.match(other.stderr, /overlaps active lease S1/);
});

test("permits the original session to resume its dirty scope after lease expiry", () => {
  const cwd = makeRepo();
  assert.equal(run(cwd, ["bootstrap"]).status, 0);
  assert.equal(run(cwd, ["claim", "--session", "S1", "--task", "TASK-1", "--paths", "owned"]).status, 0);
  fs.mkdirSync(path.join(cwd, "owned"), { recursive: true });
  fs.writeFileSync(path.join(cwd, "owned/work.txt"), "preserve me\n");
  const leasePath = path.join(cwd, ".git/codex-session-write-lease.json");
  const lease = JSON.parse(fs.readFileSync(leasePath, "utf8"));
  lease.leases[0].heartbeatAt = new Date(Date.now() - 120 * 60_000).toISOString();
  fs.writeFileSync(leasePath, `${JSON.stringify(lease)}\n`);

  const resumed = run(
    cwd,
    ["claim", "--session", "S1", "--task", "TASK-1", "--paths", "owned", "--resume"],
    { CODEX_CHECKOUT_GATE_LEASE_TTL_MINUTES: "30" },
  );
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.match(resumed.stdout, /Expired 1 stale lease reservation/);
  assert.match(resumed.stdout, /Write lease acquired by S1/);
});

test("refuses a dirty release unless the owner records an explicit handoff", () => {
  const cwd = makeRepo();
  assert.equal(run(cwd, ["bootstrap"]).status, 0);
  assert.equal(run(cwd, ["claim", "--session", "S1", "--task", "TASK-1", "--paths", "owned"]).status, 0);
  fs.mkdirSync(path.join(cwd, "owned"), { recursive: true });
  fs.writeFileSync(path.join(cwd, "owned/work.txt"), "still working\n");
  const refused = run(cwd, ["release", "--session", "S1"]);
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /Release refused: S1 still owns 1 dirty path/);
  assert.equal(run(cwd, ["release", "--session", "S1", "--handoff"]).status, 1);
  const handedOff = run(cwd, ["release", "--session", "S1", "--handoff", "--reason", "owner handed work to reviewer"]);
  assert.equal(handedOff.status, 0, handedOff.stderr);
  const history = fs.readFileSync(path.join(cwd, ".git/codex-session-write-lease-history.jsonl"), "utf8");
  assert.match(history, /"handoff":true/);
  assert.match(history, /"dirtyPaths":\["owned\/"\]/);
});

test("heartbeat renews a lease and audit records a heartbeat", () => {
  const cwd = makeRepo();
  assert.equal(run(cwd, ["bootstrap"]).status, 0);
  assert.equal(run(cwd, ["claim", "--session", "S1", "--task", "TASK-1", "--paths", "src/a.ts"]).status, 0);
  const heartbeat = run(cwd, ["heartbeat", "--session", "S1"]);
  assert.equal(heartbeat.status, 0, heartbeat.stderr);
  assert.match(heartbeat.stdout, /Lease heartbeat recorded/);
  const audit = run(cwd, ["audit", "--session", "S1"]);
  assert.equal(audit.status, 0, audit.stderr);
  const lease = JSON.parse(fs.readFileSync(path.join(cwd, ".git/codex-session-write-lease.json"), "utf8"));
  assert.ok(lease.leases[0].heartbeatAt);
});

test("refuses work outside main and preserves recovery ownership", () => {
  const cwd = makeRepo();
  assert.equal(run(cwd, ["bootstrap"]).status, 0);
  git(cwd, ["checkout", "-b", "temporary"]);
  const result = run(cwd, ["claim", "--session", "S1", "--task", "TASK-1", "--paths", "src/a.ts"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /not main/);
});

test("removes manual recovery so fresh ownership cannot be cleared by another session", () => {
  const cwd = makeRepo();
  assert.equal(run(cwd, ["bootstrap"]).status, 0);
  assert.equal(run(cwd, ["claim", "--session", "S1", "--task", "TASK-1", "--paths", "src/a.ts"]).status, 0);
  const recovery = run(cwd, ["recover", "--session", "S1", "--reason", "owner stopped"]);
  assert.equal(recovery.status, 1);
  assert.match(recovery.stderr, /Unknown command: recover/);
  const status = run(cwd, ["status"]);
  assert.match(status.stdout, /S1 \(TASK-1\)/);
});

test("quarantines stale untracked work recoverably and permits an immediate claim", () => {
  const cwd = makeRepo();
  assert.equal(run(cwd, ["bootstrap"]).status, 0);
  fs.mkdirSync(path.join(cwd, "docs/evidence/orphan"), { recursive: true });
  fs.writeFileSync(path.join(cwd, "docs/evidence/orphan/proof.txt"), "preserve me\n");
  makeStale(cwd, "docs/evidence/orphan/proof.txt");
  const result = run(cwd, [
    "quarantine", "--session", "S1", "--task", "TASK-1",
    "--reason", "stale ownerless evidence", "--paths", "docs/evidence/orphan", "--stale-minutes", "60",
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Quarantined 1 path\(s\) without deletion/);
  assert.equal(fs.existsSync(path.join(cwd, "docs/evidence/orphan")), false);
  const manifestPath = result.stdout.match(/Manifest: (.+)/)?.[1]?.trim();
  assert.ok(manifestPath && fs.existsSync(manifestPath));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.files[0].sha256.length, 64);
  assert.equal(manifest.paths[0].originalPath, "docs/evidence/orphan");
  assert.equal(run(cwd, ["claim", "--session", "S1", "--task", "TASK-1", "--paths", "src/a.ts"]).status, 0);
  const history = fs.readFileSync(path.join(cwd, ".git/codex-session-write-lease-history.jsonl"), "utf8");
  assert.match(history, /"event":"quarantine"/);
});

test("refuses fresh, tracked, broad, and outside paths", () => {
  const cwd = makeRepo();
  assert.equal(run(cwd, ["bootstrap"]).status, 0);
  fs.writeFileSync(path.join(cwd, "fresh.txt"), "active\n");
  const fresh = run(cwd, ["quarantine", "--session", "S1", "--task", "TASK-1", "--reason", "test", "--paths", "fresh.txt", "--stale-minutes", "60"]);
  assert.equal(fresh.status, 1);
  assert.match(fresh.stderr, /refused fresh work/i);

  fs.writeFileSync(path.join(cwd, "README.md"), "tracked edit\n");
  const tracked = run(cwd, ["quarantine", "--session", "S1", "--task", "TASK-1", "--reason", "test", "--paths", "README.md", "--stale-minutes", "1"]);
  assert.equal(tracked.status, 1);
  assert.match(tracked.stderr, /Tracked work cannot be quarantined/);

  fs.mkdirSync(path.join(cwd, "docs"), { recursive: true });
  const broad = run(cwd, ["quarantine", "--session", "S1", "--task", "TASK-1", "--reason", "test", "--paths", "docs", "--stale-minutes", "1"]);
  assert.equal(broad.status, 1);
  assert.match(broad.stderr, /broad quarantine directory/);

  const outside = run(cwd, ["quarantine", "--session", "S1", "--task", "TASK-1", "--reason", "test", "--paths", "../outside", "--stale-minutes", "1"]);
  assert.equal(outside.status, 1);
  assert.match(outside.stderr, /Unsafe quarantine path/);
});

test("refuses quarantine during an active lease or when a path has an open handle", () => {
  const cwd = makeRepo();
  assert.equal(run(cwd, ["bootstrap"]).status, 0);
  assert.equal(run(cwd, ["claim", "--session", "S1", "--task", "TASK-1", "--paths", "src/a.ts"]).status, 0);
  fs.writeFileSync(path.join(cwd, "orphan.txt"), "evidence\n");
  makeStale(cwd, "orphan.txt");
  const leased = run(cwd, ["quarantine", "--session", "S2", "--task", "TASK-2", "--reason", "test", "--paths", "orphan.txt", "--stale-minutes", "60"]);
  assert.equal(leased.status, 1);
  assert.match(leased.stderr, /forbidden while active writer lease/);
  assert.equal(run(cwd, ["release", "--session", "S1"]).status, 0);
  const open = run(cwd, ["quarantine", "--session", "S2", "--task", "TASK-2", "--reason", "test", "--paths", "orphan.txt", "--stale-minutes", "60"], { FAKE_LSOF_OPEN: "1" });
  assert.equal(open.status, 1);
  assert.match(open.stderr, /open file handle/);
  assert.equal(fs.existsSync(path.join(cwd, "orphan.txt")), true);
});

test("refuses ignored paths and symbolic links", () => {
  const cwd = makeRepo();
  assert.equal(run(cwd, ["bootstrap"]).status, 0);
  fs.writeFileSync(path.join(cwd, ".gitignore"), "ignored.txt\n");
  git(cwd, ["add", ".gitignore"]);
  git(cwd, ["commit", "-m", "ignore test artifact"]);
  fs.writeFileSync(path.join(cwd, "ignored.txt"), "ignored\n");
  makeStale(cwd, "ignored.txt");
  const ignored = run(cwd, ["quarantine", "--session", "S1", "--task", "TASK-1", "--reason", "test", "--paths", "ignored.txt", "--stale-minutes", "60"]);
  assert.equal(ignored.status, 1);
  assert.match(ignored.stderr, /Ignored paths are not eligible/);

  fs.writeFileSync(path.join(cwd, "target.txt"), "target\n");
  fs.symlinkSync(path.join(cwd, "target.txt"), path.join(cwd, "link.txt"));
  makeStale(cwd, "target.txt");
  const linked = run(cwd, ["quarantine", "--session", "S1", "--task", "TASK-1", "--reason", "test", "--paths", "link.txt", "--stale-minutes", "60"]);
  assert.equal(linked.status, 1);
  assert.match(linked.stderr, /refuses symbolic links/);
});

test("lease audit distinguishes owned dirt from concurrent out-of-lease writes", () => {
  const cwd = makeRepo();
  assert.equal(run(cwd, ["bootstrap"]).status, 0);
  assert.equal(run(cwd, ["claim", "--session", "S1", "--task", "TASK-1", "--paths", "owned"]).status, 0);
  fs.mkdirSync(path.join(cwd, "owned"), { recursive: true });
  fs.writeFileSync(path.join(cwd, "owned/work.txt"), "owned\n");
  const owned = run(cwd, ["audit", "--session", "S1"]);
  assert.equal(owned.status, 0, owned.stderr);
  assert.match(owned.stdout, /no new dirty path is outside an active lease/);

  fs.writeFileSync(path.join(cwd, "intruder.txt"), "outside lease\n");
  const violated = run(cwd, ["audit", "--session", "S1"]);
  assert.equal(violated.status, 1);
  assert.match(violated.stderr, /out-of-lease dirty path/);
  assert.match(violated.stderr, /intruder.txt/);
});
